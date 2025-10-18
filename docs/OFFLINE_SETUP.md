# Offline Setup Guide

This guide explains how to make your letter database completely self-contained and offline-ready by localizing all external image references.

## The Problem

By default, when you sync emails from Buttondown, the image URLs in the markdown content still point to external Buttondown servers:

```markdown
![Image](https://buttondown.email/api/emails/image.jpg)
```

This means your database requires internet connectivity to display images.

## The Solution

We download all images and store them as BLOBs in the SQLite database, then replace external URLs with local API references:

```markdown
![Image](/api/images/123)
```

Now your database is truly self-contained and works completely offline! The reader app serves images directly from the database via the `/api/images/:id` endpoint.

## Benefits Over Data URIs

This reference-based approach has several advantages:

✅ **Smaller database** - No base64 encoding bloat in markdown  
✅ **Readable content** - Clean, simple references in markdown  
✅ **Bulk operations** - Query, update, or delete images independently  
✅ **Deduplication** - Same image can be referenced multiple times  
✅ **Better performance** - Browser caching of individual images  
✅ **Easier debugging** - Can inspect images separately from content

## Step-by-Step Setup

### 1. Download Images (if not already done)

If you haven't already downloaded images during sync, run:

```bash
npm run images:download
```

This will:

- Scan all emails for image URLs
- Download images from external sources
- Store them as BLOBs in the `embedded_images` table
- Preserve image metadata (mime type, dimensions, file size)

### 2. Localize Image References

Replace external URLs with local API references:

```bash
npm run images:localize
```

This will:

- Read all emails from the database
- For each email with embedded images, replace external URLs with `/api/images/{id}`
- Update the `normalized_markdown` field in the database

### 3. Verify

Check the results:

```bash
npm run images:stats
```

This shows:

- How many emails have embedded images
- Number of images per email
- Total storage used by images

### 4. Future Syncs

For all future syncs, use the `--download-images` flag to automatically download and localize images:

```bash
npm run sync -- --download-images
```

This will:

- Sync new/updated emails
- Download embedded images
- Automatically replace URLs with local references
- Store everything in the database

## How It Works

### Database Schema

The `embedded_images` table stores downloaded images:

```sql
CREATE TABLE embedded_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id TEXT NOT NULL,
  original_url TEXT NOT NULL,
  image_data BLOB NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  downloaded_at TEXT NOT NULL,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
  UNIQUE(email_id, original_url)
);
```

### Local References

Images are referenced using simple API paths:

```
/api/images/123
```

These references work anywhere a regular URL works:

- In markdown: `![Alt](/api/images/123)`
- In HTML: `<img src="/api/images/123" />`
- In CSS: `background-image: url(/api/images/123)`

### Reader App

The reader app serves images via the `/api/images/:id` endpoint:

1. Request comes in for `/api/images/123`
2. Server queries database: `SELECT * FROM embedded_images WHERE id = 123`
3. Returns raw image data with appropriate `Content-Type` header
4. Browser renders the image normally

### Bulk Operations

Since images are separate entities, you can easily:

**Find all images:**

```sql
SELECT * FROM embedded_images;
```

**Find large images:**

```sql
SELECT * FROM embedded_images WHERE file_size > 1000000 ORDER BY file_size DESC;
```

**Find images by type:**

```sql
SELECT * FROM embedded_images WHERE mime_type = 'image/png';
```

**Count images per email:**

```sql
SELECT email_id, COUNT(*) as image_count
FROM embedded_images
GROUP BY email_id
ORDER BY image_count DESC;
```

**Delete unused images:**

```sql
DELETE FROM embedded_images WHERE email_id NOT IN (SELECT id FROM emails);
```

## Storage Considerations

### Database Size

Unlike data URIs, this approach doesn't add base64 encoding overhead. Images are stored in their original binary format, making the database ~25% smaller than the data URI approach.

### Checking Storage

See how much space images are using:

```bash
npm run images:stats
```

### Database Location

Your database is stored at:

```
/Users/justinwolfe/Projects/letters/data/newsletters.db
```

You can copy this file to another machine and it will work completely offline! Just run the reader app and all images will be served from the database.

## Commands Reference

| Command                             | Description                                 |
| ----------------------------------- | ------------------------------------------- |
| `npm run sync -- --download-images` | Sync emails and download images             |
| `npm run images:download`           | Download images for existing emails         |
| `npm run images:localize`           | Replace external URLs with local references |
| `npm run images:stats`              | Show image statistics                       |

## Troubleshooting

### Images still pointing to external URLs

If images are still showing external URLs after localization:

1. Check that images were downloaded:

   ```bash
   npm run images:stats
   ```

2. Re-run localization:

   ```bash
   npm run images:localize
   ```

3. Verify in the reader app by opening a letter and checking that images load

### Database too large

If the database is getting too large, you can:

1. **Delete large images:**

   ```bash
   sqlite3 data/newsletters.db "DELETE FROM embedded_images WHERE file_size > 5000000;"
   ```

2. **Keep only recent email images:**

   ```bash
   sqlite3 data/newsletters.db "DELETE FROM embedded_images WHERE email_id NOT IN (SELECT id FROM emails WHERE publish_date > date('now', '-1 year'));"
   ```

3. **Store only certain image types:**
   Edit the sync logic to skip GIFs or other large formats

### Re-syncing everything

To start fresh with full offline support:

```bash
# Reset database (WARNING: deletes all data)
npm run db:reset

# Sync with images
npm run sync -- --full --download-images
```

The `--download-images` flag now automatically localizes images during sync, so you don't need a separate localization step!

## Benefits

✅ **Fully offline** - No internet required to read newsletters  
✅ **Portable** - Copy the database file anywhere  
✅ **Self-contained** - Everything in one SQLite file  
✅ **Fast** - No network latency for images  
✅ **Private** - Images not loaded from external servers  
✅ **Archival** - Images preserved even if deleted from source  
✅ **Queryable** - Bulk operations on images as separate entities  
✅ **Efficient** - No base64 encoding overhead  
✅ **Cacheable** - Browser can cache images individually

## Technical Details

The implementation consists of:

1. **Image Processor** (`lib/utils/image-processor.ts`)

   - Extracts image URLs from HTML/markdown
   - Downloads images
   - Replaces URLs in content with local references

2. **Database Queries** (`lib/db/queries.ts`)

   - Stores embedded images as BLOBs
   - Retrieves images with metadata
   - Updates normalized markdown
   - Serves individual images by ID

3. **Sync Engine** (`apps/sync/engine.ts`)

   - Downloads images during sync
   - Automatically localizes URLs when `--download-images` is used
   - Replaces external URLs with `/api/images/{id}` references

4. **Reader API** (`apps/reader/index.ts`)

   - Serves images via `/api/images/:id` endpoint
   - Sets proper Content-Type and caching headers
   - Returns raw binary image data

5. **Localize Script** (`apps/sync/index.ts` - `localize-images` command)
   - Batch processes existing emails
   - Replaces URLs with local references
   - Updates database

## Example Workflow

### Initial Setup

```bash
# 1. Download all images for existing emails
npm run images:download

# 2. Replace external URLs with local references
npm run images:localize

# 3. Check the results
npm run images:stats

# 4. Start the reader
npm run reader
```

### Future Updates

```bash
# Just sync with the --download-images flag
npm run sync -- --download-images
```

That's it! New emails will automatically have their images downloaded and localized.

Enjoy your fully offline, queryable newsletter archive! 📚
