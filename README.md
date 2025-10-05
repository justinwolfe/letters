# Letters - Buttondown Newsletter Sync

A TypeScript system for syncing newsletters from Buttondown into a version-controlled SQLite database.

## Features

- 🔄 **Incremental Sync**: Only fetches new/modified emails after initial sync
- 💾 **SQLite Storage**: All data stored in a single, portable database file
- 🎯 **Type-Safe**: Full TypeScript implementation with API types
- 📦 **Version Controlled**: Database checked into git for full history
- 🔌 **Offline-First**: All newsletter content available locally
- 🛡️ **Idempotent**: Safe to run multiple times
- 🖼️ **Image Archiving**: Downloads and embeds all remote images locally

## Setup

### Prerequisites

- Node.js 18+ (for native fetch support)
- A Buttondown account with API access
- Your Buttondown API key

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with your API key:

   ```bash
   BUTTONDOWN_API_KEY=your_api_key_here
   ```

4. Run the initial sync:
   ```bash
   npm run sync
   ```

## Usage

### Sync Commands

```bash
# Run incremental sync (default)
npm run sync

# Force full sync (re-fetch everything)
npm run sync -- --full

# Sync emails and download embedded images
npm run sync -- --download-images

# Preview changes without writing to database
npm run sync -- --dry-run

# Verbose logging
npm run sync -- --verbose

# View sync status
npm run sync:status

# View database info
npm run sync:info

# Sync attachment metadata
npm run sync:attachments
```

### Image Archiving

```bash
# Download embedded images for all existing emails
npm run images:download

# View statistics about embedded images
npm run images:stats

# Export a single email as standalone HTML with embedded images
npm run export:email <email-id> [output.html]
```

#### How Image Archiving Works

When you run image archiving:

1. Extracts all image URLs from email HTML (`<img>` tags and CSS backgrounds)
2. Downloads each image from remote servers
3. Stores images as BLOBs directly in the SQLite database
4. Replaces remote URLs with data URIs when exporting

This means:

- ✅ **Fully self-contained**: All images stored in one SQLite file
- ✅ **No broken links**: Images preserved even if originals are removed
- ✅ **Offline access**: View complete emails without internet
- ✅ **Version controlled**: Image history preserved in git

### Database Operations

```bash
# Reset database (destructive - for testing only)
npm run db:reset
```

## Project Structure

```
letters/
├── data/
│   └── newsletters.db      # SQLite database (checked into git)
├── src/
│   ├── index.ts            # CLI entry point
│   ├── sync.ts             # Sync orchestration
│   ├── api/
│   │   ├── client.ts       # Buttondown API client
│   │   └── types.ts        # TypeScript types
│   ├── db/
│   │   ├── schema.ts       # Database schema
│   │   └── queries.ts      # Database queries
│   └── utils/
│       ├── logger.ts       # Logging utilities
│       └── image-processor.ts  # Image extraction and download
└── scripts/
    ├── reset-db.ts         # Database reset script
    ├── export-email.ts     # Export email as standalone HTML
    ├── check-attachments.ts
    └── debug-attachments.ts
```

## Database Schema

### Tables

- **emails**: Newsletter content and metadata
- **attachments**: File attachments and their URLs
- **email_attachments**: Links emails to their attachments
- **embedded_images**: Downloaded images stored as BLOBs
- **sync_metadata**: Tracks sync status and timestamps

### Image Storage

Images are stored as BLOBs in the `embedded_images` table with:

- Original URL (for reference)
- Binary image data (PNG, JPEG, GIF, etc.)
- MIME type
- File size
- Dimensions (width/height when available)
- Download timestamp

When exporting emails, images are converted to data URIs (`data:image/...;base64,...`) for complete portability.

## How It Works

### Initial Sync

1. Fetches all historical emails from Buttondown API
2. Stores email content and metadata in SQLite
3. Tracks attachment references
4. Records sync timestamp

### Incremental Sync

1. Checks last sync timestamp from database
2. Fetches only emails modified since last sync
3. Updates existing records or inserts new ones
4. Updates sync timestamp

### API Integration

- Uses Buttondown's REST API with pagination
- Fetches emails with statuses: `sent`, `imported`, and `draft`
  - **Important**: By default, Buttondown's API only returns `sent` emails
  - We explicitly include `imported` (from bulk imports) and `draft` emails
- Implements retry logic for rate limits and network errors
- Processes emails in batches for memory efficiency
- Respects API rate limits with delays between requests

## Future Projects

This database serves as the foundation for:

- 📊 Word clouds and content indexes
- 📚 Offline PWA reader
- 📖 Automatic EPUB generation
- 🖼️ Image optimization
- 🤖 LLM-assisted content editing
- 💾 Versioned backups

## Development

### Build

```bash
# Type check
npm run type-check

# Build to JavaScript
npm run build
```

### Watch Mode

```bash
# Run with auto-reload
npm run dev
```

## Technical Details

### Why SQLite?

- Single file, easy to version control
- Fast for read-heavy workloads
- No server required
- Built-in full-text search (FTS5) available
- Excellent for datasets < 1GB

### Why better-sqlite3?

- Synchronous API (simpler code)
- Faster than async alternatives
- Better TypeScript support
- More reliable

### Git Strategy

The SQLite database is committed to git for:

- Complete content history
- Easy clone and use
- Offline access
- No separate database setup

Database is marked as binary in `.gitattributes` for proper handling.

## Troubleshooting

### API Key Not Found

```
BUTTONDOWN_API_KEY not found in environment
```

**Solution**: Create a `.env` file with your API key:

```bash
echo "BUTTONDOWN_API_KEY=your_key_here" > .env
```

### Rate Limiting

If you encounter rate limits, the system will automatically retry with exponential backoff. You can also:

- Run incremental syncs more frequently
- Add delays between requests (edit `src/api/client.ts`)

### Database Locked

If you get a "database is locked" error:

- Ensure no other process is accessing the database
- Close any SQLite browser tools
- Try running the command again

## License

ISC

## See Also

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed technical specification
- [Buttondown API Documentation](https://api.buttondown.email/v1/schema)
