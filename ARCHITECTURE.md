# Architecture Documentation

**For AI Agents and Future Developers**

This document explains how the `letters` codebase is organized and how to work with it effectively.

## Overview

The `letters` project is a newsletter sync and management system built around:

- A central **SQLite database** containing all newsletter data
- **Shared libraries** for database access, API calls, and utilities
- **Independent applications** that use the shared libraries for specific tasks
- **Utility scripts** for one-off operations

## Directory Structure

```
letters/
├── lib/                    # Shared core libraries (reusable)
│   ├── db/                 # Database layer
│   │   ├── schema.ts       # Database initialization & schema
│   │   └── queries.ts      # Database query methods
│   ├── api/                # Buttondown API client
│   │   ├── client.ts       # HTTP client with retry logic
│   │   └── types.ts        # TypeScript types for API
│   └── utils/              # Shared utilities
│       ├── logger.ts       # Logging utility
│       ├── image-processor.ts  # Image download & processing
│       └── markdown-normalizer.ts  # HTML to Markdown conversion
│
├── apps/                   # Independent applications
│   ├── sync/               # Main newsletter sync CLI
│   │   ├── index.ts        # CLI entry point
│   │   └── engine.ts       # Sync orchestration logic
│   └── _template/          # Template for new apps
│       ├── index.ts        # Example app structure
│       └── README.md       # Template documentation
│
├── scripts/                # One-off utility scripts
│   ├── export-email.ts     # Export single email as HTML
│   ├── inspect-email.ts    # Inspect email for debugging
│   ├── migrate-schema.ts   # Database schema migrations
│   ├── normalize-markdown.ts  # Backfill markdown normalization
│   ├── reset-db.ts         # Reset database (destructive)
│   ├── check-attachments.ts   # Check attachment status
│   └── debug-attachments.ts   # Debug attachment API calls
│
├── data/
│   └── newsletters.db      # Central SQLite database (checked into git)
│
├── package.json            # Root package config
├── tsconfig.json           # TypeScript configuration
└── README.md               # User-facing documentation
```

## Key Design Principles

### 1. Shared Libraries (`lib/`)

The `lib/` directory contains **reusable code** that multiple applications can depend on:

- **No dependencies on apps**: Libraries never import from `apps/`
- **Stable interfaces**: Libraries should have stable APIs
- **Well-documented**: Each module should be self-explanatory
- **Single responsibility**: Each module has one clear purpose

**Import pattern from apps/scripts:**

```typescript
import { initializeDatabase } from '../../lib/db/schema.js';
import { DatabaseQueries } from '../../lib/db/queries.js';
import { ButtondownClient } from '../../lib/api/client.js';
import { logger } from '../../lib/utils/logger.js';
```

### 2. Independent Applications (`apps/`)

Each app in `apps/` is a **standalone program** with its own entry point:

- **Self-contained**: Has its own `index.ts` entry point
- **Uses lib/**: Imports from `../../lib/` for shared functionality
- **Registered in package.json**: Has a script command to run it
- **Single purpose**: Each app solves one specific problem

**Creating a new app:**

1. Copy `apps/_template/` to `apps/your-app/`
2. Implement your logic in `apps/your-app/index.ts`
3. Add script to `package.json`: `"your-app": "tsx apps/your-app/index.ts"`
4. Run with: `npm run your-app`

### 3. Utility Scripts (`scripts/`)

Scripts are **one-off utilities** for maintenance and debugging:

- **Not for regular use**: Unlike apps, these are occasional tools
- **Can be simple**: Don't need the full app structure
- **Direct database access**: Can access database directly if needed

### 4. Central Database (`data/newsletters.db`)

**All data lives in one place** - the SQLite database:

- **Single source of truth**: All apps read/write to same database
- **Checked into git**: Full history and easy cloning
- **Accessed via queries**: Use `DatabaseQueries` class, don't write raw SQL in apps

## Database Schema

### Tables

1. **emails**: Newsletter content and metadata

   - Primary key: `id` (from Buttondown API)
   - Contains both original HTML (`body`) and normalized markdown
   - Indexed by `modification_date`, `publish_date`, `status`

2. **attachments**: File attachments metadata

   - Primary key: `id` (from Buttondown API)
   - Stores URL to file, not file content

3. **email_attachments**: Links emails to attachments (many-to-many)

4. **embedded_images**: Downloaded images stored as BLOBs

   - Linked to emails via `email_id`
   - Contains binary image data, dimensions, MIME type
   - Unique constraint on `(email_id, original_url)`

5. **sync_metadata**: System metadata
   - Key-value store for sync state
   - Tracks: `last_sync_date`, `last_sync_status`, `schema_version`

### Database Access Patterns

**Always use the `DatabaseQueries` class:**

```typescript
const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Good: Use query methods
const emails = queries.getAllEmails();
const email = queries.emailExists('id');

// Avoid: Writing raw SQL in apps
// const emails = db.prepare('SELECT * FROM emails').all();
```

**Use transactions for multiple writes:**

```typescript
queries.transaction(() => {
  queries.upsertEmail(email1);
  queries.upsertEmail(email2);
  queries.linkEmailAttachment(email1.id, attachment.id);
});
```

**Always close database when done:**

```typescript
const db = initializeDatabase();
try {
  // Your logic
} finally {
  db.close();
}
```

## Import Path Conventions

All TypeScript files use ESM imports with `.js` extensions (for compiled output):

```typescript
// From apps/sync/
import { initializeDatabase } from '../../lib/db/schema.js';
import { ButtondownClient } from '../../lib/api/client.js';

// From scripts/
import { initializeDatabase } from '../lib/db/schema.js';

// Within lib/
import { logger } from '../utils/logger.js'; // Relative within lib/
```

**Why `.js` extension?**
TypeScript's ESM mode requires `.js` extensions even though the source files are `.ts`. This is for compatibility with Node.js ESM.

## Common Development Tasks

### Create a New App

1. **Copy the template:**

   ```bash
   cp -r apps/_template apps/my-app
   ```

2. **Implement your logic** in `apps/my-app/index.ts`:

   ```typescript
   import { initializeDatabase } from '../../lib/db/schema.js';
   import { DatabaseQueries } from '../../lib/db/queries.js';

   const db = initializeDatabase();
   const queries = new DatabaseQueries(db);

   try {
     // Your app logic
   } finally {
     db.close();
   }
   ```

3. **Add to package.json:**

   ```json
   {
     "scripts": {
       "my-app": "tsx apps/my-app/index.ts"
     }
   }
   ```

4. **Run it:**
   ```bash
   npm run my-app
   ```

### Add a Database Query Method

Add new methods to `lib/db/queries.ts`:

```typescript
export class DatabaseQueries {
  // ... existing methods

  /**
   * Your new query method
   */
  getEmailsByTag(tag: string): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM emails 
      WHERE metadata LIKE ?
      ORDER BY publish_date DESC
    `);

    return stmt.all(`%"${tag}"%`);
  }
}
```

All apps automatically get access to new query methods.

### Add a Utility Function

Add new utilities to `lib/utils/`:

```typescript
// lib/utils/text-analyzer.ts
export function countWords(text: string): number {
  return text.split(/\s+/).length;
}

export function extractKeywords(text: string): string[] {
  // Your implementation
}
```

Then import in any app:

```typescript
import { countWords } from '../../lib/utils/text-analyzer.js';
```

### Migrate Database Schema

1. Create migration in `scripts/migrate-schema.ts`
2. Update schema in `lib/db/schema.ts` (for new databases)
3. Add query methods in `lib/db/queries.ts`
4. Run migration: `npm run db:migrate`

## API Client Usage

The `ButtondownClient` handles all Buttondown API interactions:

```typescript
import { ButtondownClient } from '../../lib/api/client.js';

const apiKey = process.env.BUTTONDOWN_API_KEY;
const client = new ButtondownClient(apiKey);

// Fetch single email
const email = await client.fetchEmail('email-id');

// Fetch all emails (uses pagination automatically)
for await (const email of client.fetchAllEmails()) {
  console.log(email.subject);
}

// Fetch with filters
for await (const email of client.fetchAllEmails({
  status: ['sent', 'draft'],
  publish_date__start: '2024-01-01',
})) {
  // Process email
}
```

**Features:**

- Automatic pagination
- Retry logic for rate limits and network errors
- Type-safe with TypeScript types from `lib/api/types.ts`
- Small delays between requests to be nice to API

## Logging

Use the shared logger from `lib/utils/logger.ts`:

```typescript
import { logger, LogLevel } from '../../lib/utils/logger.js';

logger.info('Starting process...');
logger.debug('Debug details...');
logger.warn('Warning message...');
logger.error('Error occurred:', error);
logger.success('Completed successfully!');

// Change log level
logger.setLevel(LogLevel.DEBUG);
```

## Testing Changes

After making changes:

1. **Type check:**

   ```bash
   npm run type-check
   ```

2. **Test the sync app:**

   ```bash
   npm run sync:status
   npm run sync -- --dry-run
   ```

3. **Test your new app:**
   ```bash
   npm run your-app
   ```

## Environment Variables

Create a `.env` file in the project root:

```bash
BUTTONDOWN_API_KEY=your_api_key_here
```

All apps automatically load this via:

```typescript
import { config } from 'dotenv';
config();
```

## Git Strategy

- **Database is checked in**: `data/newsletters.db` is in git for history
- **Marked as binary**: `.gitattributes` treats it as binary
- **Small commits**: Database changes are transparent in git history
- **Easy cloning**: New users get full data immediately

## Common Patterns

### Pattern: CLI with Commands

See `apps/sync/index.ts` for example of:

- Command parsing (`sync`, `status`, `info`, etc.)
- Flag parsing (`--verbose`, `--dry-run`, etc.)
- Help text
- Error handling

### Pattern: Progress Reporting

```typescript
const items = queries.getAllEmails();
logger.info(`Processing ${items.length} items...`);

for (let i = 0; i < items.length; i++) {
  logger.info(`[${i + 1}/${items.length}] Processing: ${items[i].subject}`);
  // Process item
}
```

### Pattern: Dry Run Mode

```typescript
async function main() {
  const dryRun = args.includes('--dry-run');

  logger.info(`Would process ${count} items`);

  if (!dryRun) {
    // Actually do the work
    queries.upsertEmail(email);
  }
}
```

### Pattern: Graceful Error Handling

```typescript
try {
  await processItem(item);
  logger.success(`✓ Processed: ${item.name}`);
} catch (error) {
  logger.warn(`✗ Failed: ${item.name} - ${error}`);
  // Continue processing other items
}
```

## Future Expansion Ideas

Apps you could build with this infrastructure:

- **Word Cloud Generator**: Analyze content frequency
- **EPUB Builder**: Create ebook from newsletters
- **Static Site Generator**: Build archive website
- **Full-Text Search**: Add SQLite FTS5 index
- **Link Checker**: Verify all external links
- **Image Optimizer**: Compress embedded images
- **Content Analyzer**: Generate readability scores
- **Backup Tool**: Create compressed backups
- **Duplicate Detector**: Find similar content
- **Report Generator**: Monthly/yearly statistics

## Troubleshooting

### Import Errors

If you get "Cannot find module" errors:

1. Check you're using `.js` extension: `import X from './file.js'`
2. Check relative path depth: `../../lib/` from apps, `../lib/` from scripts
3. Run `npm run type-check` to see TypeScript errors

### Database Locked

If you get "database is locked":

1. Ensure no other process is accessing the database
2. Always close database in `finally` blocks
3. Check for unclosed connections in your code

### Type Errors

If TypeScript complains about types:

1. Import types from `lib/api/types.ts`
2. Use `any` temporarily, then refine
3. Run `npm run type-check` for full type checking

## Summary

**Core Concept**: One database, many applications, shared libraries.

**To create new functionality:**

1. Check if it's a reusable library function → Add to `lib/`
2. Check if it's a standalone program → Create in `apps/`
3. Check if it's a one-off script → Create in `scripts/`

**Always:**

- Import from `lib/` for shared functionality
- Use `DatabaseQueries` for database access
- Close database connections
- Handle errors gracefully
- Use the shared logger

**Never:**

- Import from `apps/` in libraries
- Write raw SQL in apps (use `DatabaseQueries`)
- Hardcode paths (use `getDbPath()`)
- Access database without `try/finally`

This architecture supports independent development of new features while maintaining a clean, shared foundation.
