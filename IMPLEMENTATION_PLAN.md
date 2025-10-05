# Buttondown Newsletter Sync System - Implementation Plan

## Overview

A TypeScript-based system to sync newsletters from Buttondown API into a version-controlled SQLite database, serving as the foundation for future projects including word clouds, indexes, offline PWA readers, EPUB generation, image optimization, and LLM-assisted content editing.

## Architecture

### Core Principles

- **Single Source of Truth**: SQLite database checked into git
- **Incremental Sync**: Only fetch new/modified content after initial sync
- **Idempotent Operations**: Safe to run multiple times
- **Offline-First**: All data available locally
- **Type-Safe**: Full TypeScript implementation

### Technical Stack

- **Language**: TypeScript/Node.js (18+)
- **Database**: better-sqlite3 (synchronous SQLite)
- **HTTP**: Native fetch API
- **Environment**: dotenv for configuration
- **Dev Tools**: tsx for TypeScript execution

## Database Schema

### `emails` table

```sql
CREATE TABLE emails (
  id TEXT PRIMARY KEY,                    -- UUID from Buttondown
  subject TEXT NOT NULL,
  body TEXT NOT NULL,                     -- HTML/markdown content
  status TEXT NOT NULL,                   -- draft, sent, etc.
  publish_date TEXT,                      -- ISO 8601 datetime
  creation_date TEXT NOT NULL,
  modification_date TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  image_url TEXT,
  canonical_url TEXT,
  email_type TEXT,
  secondary_id INTEGER,                   -- Issue number
  absolute_url TEXT,
  metadata TEXT,                          -- JSON string
  featured INTEGER DEFAULT 0,             -- boolean
  synced_at TEXT NOT NULL                 -- When we fetched it
);

CREATE INDEX idx_emails_modification_date ON emails(modification_date);
CREATE INDEX idx_emails_publish_date ON emails(publish_date);
CREATE INDEX idx_emails_status ON emails(status);
```

### `attachments` table

```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,                    -- UUID from Buttondown
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,                 -- Original Buttondown S3 URL
  local_path TEXT,                        -- Optional local file path
  creation_date TEXT NOT NULL,
  file_size INTEGER,                      -- bytes
  mime_type TEXT,
  synced_at TEXT NOT NULL
);

CREATE INDEX idx_attachments_name ON attachments(name);
```

### `email_attachments` junction table

```sql
CREATE TABLE email_attachments (
  email_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  PRIMARY KEY (email_id, attachment_id),
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
);
```

### `sync_metadata` table

```sql
CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tracks:
-- - last_sync_date: ISO 8601 timestamp of last successful sync
-- - total_emails_synced: Count of emails in database
-- - last_sync_status: 'success' | 'error' | 'in_progress'
-- - schema_version: For future migrations
```

## Project Structure

```
letters/
├── .env                        # BUTTONDOWN_API_KEY
├── .gitignore                  # Ignore node_modules, .env
├── .gitattributes              # Mark *.db as binary
├── package.json
├── tsconfig.json
├── buttondownOpenAPI.json      # API specification
├── IMPLEMENTATION_PLAN.md      # This document
├── README.md                   # User-facing documentation
├── data/
│   ├── newsletters.db          # SQLite database (checked into git)
│   └── attachments/            # Optional: local attachment files
│       └── {attachment-id}/
│           └── {filename}
├── src/
│   ├── index.ts                # Main CLI entry point
│   ├── sync.ts                 # Sync orchestration
│   ├── api/
│   │   ├── client.ts           # Buttondown API wrapper
│   │   └── types.ts            # TypeScript types from OpenAPI
│   ├── db/
│   │   ├── schema.ts           # Database initialization & schema
│   │   ├── queries.ts          # SQL queries and helpers
│   │   └── migrations.ts       # Schema versioning system
│   └── utils/
│       ├── logger.ts           # Logging utilities
│       └── download.ts         # Attachment downloader
└── scripts/
    ├── sync.ts                 # Manual sync script
    └── reset-db.ts             # Database reset for testing
```

## API Integration

### Buttondown API Endpoints

**List Emails**: `GET /emails`

- Supports pagination via `next` URL
- Filters: `modification_date__start`, `modification_date__end`, `status`, `ordering`
- Returns: `EmailPage` with `results[]`, `next`, `previous`, `count`

**Get Email**: `GET /emails/{id}`

- Returns: Complete `Email` object with all fields

**List Attachments**: `GET /attachments`

- Paginated list of all attachments
- Returns: `AttachmentPage` with attachment objects

**Email Schema** (key fields):

- `id`: UUID
- `subject`: string (max 2000 chars)
- `body`: HTML or markdown
- `status`: EmailStatus enum
- `publish_date`, `creation_date`, `modification_date`: ISO 8601
- `attachments`: array of attachment IDs
- `metadata`: object with string values

**Attachment Schema**:

- `id`: UUID
- `name`: filename
- `file`: S3 URL
- `creation_date`: ISO 8601

### Authentication

```
Authorization: Token {BUTTONDOWN_API_KEY}
```

### Base URL

```
https://api.buttondown.com/v1
```

## Sync Strategy

### Initial Sync (First Run)

```typescript
1. Check if database exists
2. Initialize schema if needed
3. Fetch ALL emails (paginate through entire history)
   - Use ordering=creation_date for consistent ordering
   - Follow `next` URLs until exhausted
4. For each email:
   - Insert into emails table
   - Parse attachments array
   - Fetch/upsert attachment records
   - Create email_attachments relationships
   - Optionally download attachment files
5. Update sync_metadata:
   - last_sync_date = current timestamp
   - total_emails_synced = count
   - last_sync_status = 'success'
```

### Incremental Sync (Subsequent Runs)

```typescript
1. Read last_sync_date from sync_metadata
2. Fetch emails WHERE modification_date > last_sync_date
3. For each modified email:
   - UPSERT into emails table (update if exists)
   - Compare attachments with existing records
   - Add new attachments, update changed ones
4. Update sync_metadata:
   - last_sync_date = current timestamp
   - Update counts
   - last_sync_status = 'success'
```

### Pagination Pattern

```typescript
async function* fetchAllEmails(
  client: ButtondownClient,
  params?: EmailQueryParams
): AsyncGenerator<Email> {
  let nextUrl: string | null = '/emails';

  // Add query parameters
  if (params) {
    const query = new URLSearchParams(params);
    nextUrl += `?${query}`;
  }

  while (nextUrl) {
    const response = await client.get<EmailPage>(nextUrl);
    yield* response.results;

    // Use the full next URL (includes all params)
    nextUrl = response.next;
  }
}
```

### Idempotent Upsert Pattern

```typescript
// Upsert email (insert or update if exists)
db.prepare(
  `
  INSERT INTO emails (
    id, subject, body, status, publish_date,
    creation_date, modification_date, synced_at, ...
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ...)
  ON CONFLICT(id) DO UPDATE SET
    subject = excluded.subject,
    body = excluded.body,
    modification_date = excluded.modification_date,
    synced_at = excluded.synced_at,
    ...
  WHERE emails.modification_date <= excluded.modification_date
`
).run(...values);
```

## CLI Interface

### Commands

```bash
# Full sync (initial run or force full re-sync)
npm run sync

# Incremental sync (default after first run)
npm run sync:incremental

# Force full re-sync (re-fetch everything)
npm run sync -- --full

# Dry run (preview without writing)
npm run sync -- --dry-run

# Verbose logging
npm run sync -- --verbose

# Check sync status
npm run sync:status

# Reset database (destructive - for testing)
npm run db:reset

# Database info
npm run db:info
```

### package.json scripts

```json
{
  "scripts": {
    "sync": "tsx src/index.ts sync",
    "sync:status": "tsx src/index.ts status",
    "db:reset": "tsx scripts/reset-db.ts",
    "db:info": "tsx src/index.ts info",
    "dev": "tsx --watch src/index.ts",
    "build": "tsc",
    "type-check": "tsc --noEmit"
  }
}
```

## Error Handling

### Retry Logic

- API rate limits: Exponential backoff
- Network errors: 3 retries with delays
- Failed downloads: Log and continue

### Transaction Safety

```typescript
// Wrap sync operations in transaction
const transaction = db.transaction((emails) => {
  for (const email of emails) {
    upsertEmail(email);
    upsertAttachments(email.attachments);
  }
  updateSyncMetadata();
});

try {
  transaction(emails);
} catch (error) {
  // Transaction automatically rolls back
  logger.error('Sync failed, rolled back', error);
  updateSyncMetadata({ status: 'error' });
}
```

### Logging Strategy

- **INFO**: Sync start/complete, counts
- **DEBUG**: Each API request, each record processed
- **WARN**: Skipped records, missing attachments
- **ERROR**: API failures, database errors

## Git Strategy

### What to Commit

- ✅ `newsletters.db` - SQLite database (binary)
- ✅ Source code
- ✅ package.json, tsconfig.json
- ✅ This plan document
- ❌ `.env` - Contains API key
- ❌ `node_modules/`
- ⚠️ `data/attachments/` - Optional (can be large)

### .gitattributes

```
*.db binary
*.db diff=sqlite3
```

### .gitignore

```
node_modules/
.env
.DS_Store
*.log
data/attachments/
```

### Database Size Considerations

- If database > 100MB: Consider Git LFS
- Alternative: Commit gzipped exports instead
- SQLite has excellent compression for text

## Dependencies

### Production Dependencies

```json
{
  "better-sqlite3": "^11.0.0", // Fast synchronous SQLite
  "dotenv": "^16.4.0" // Environment variables
}
```

### Development Dependencies

```json
{
  "@types/better-sqlite3": "^7.6.0",
  "@types/node": "^20.0.0",
  "tsx": "^4.0.0", // Run TypeScript directly
  "typescript": "^5.0.0"
}
```

## Implementation Phases

### Phase 1: Foundation ✓ (This phase)

- [x] Project planning and documentation
- [ ] Project setup (package.json, tsconfig.json)
- [ ] Database schema and initialization
- [ ] API client with types
- [ ] Basic logging utilities

### Phase 2: Core Sync

- [ ] Implement pagination helper
- [ ] Full sync functionality
- [ ] Incremental sync logic
- [ ] Transaction handling
- [ ] Error handling and retries

### Phase 3: Attachments

- [ ] Attachment metadata sync
- [ ] Optional file downloads
- [ ] Attachment storage organization

### Phase 4: CLI & Polish

- [ ] CLI argument parsing
- [ ] Status and info commands
- [ ] Progress indicators
- [ ] Documentation (README)

### Phase 5: Testing & Validation

- [ ] Test with real Buttondown account
- [ ] Validate incremental sync
- [ ] Test error recovery
- [ ] Performance optimization

## Future Enhancements (Out of Scope)

### Planned Projects (Using This Database)

1. **Word Clouds & Indexes**: Analyze content, generate visualizations
2. **Offline PWA Reader**: Progressive web app for reading newsletters
3. **EPUB Generator**: Convert newsletters to ebook format
4. **Image Optimizer**: Compress and optimize images
5. **LLM-Assisted Editing**: Bulk content improvements

### Potential System Enhancements

- **Webhooks**: Real-time updates from Buttondown
- **Conflict Resolution**: Handle local edits vs remote changes
- **Full-Text Search**: SQLite FTS5 for content search
- **Analytics Dashboard**: Visualize newsletter metrics
- **Backup System**: Automated backups to cloud storage
- **Multi-Newsletter**: Support multiple Buttondown accounts

## Key Design Decisions

### Why SQLite?

- Single file, easy to version control
- Fast for read-heavy workloads
- No server required
- Excellent for local development
- Built-in FTS5 for future search features

### Why better-sqlite3?

- Synchronous API (simpler code)
- Faster than async alternatives
- Better TypeScript support
- More reliable than node-sqlite3

### Why Commit Database to Git?

- Complete history of newsletter content
- Easy to clone and use immediately
- Works offline
- No separate database setup needed
- Good for datasets < 1GB

### Why Incremental Sync?

- Faster after initial sync
- Less API usage
- Preserves local modifications (future)
- Scales to thousands of newsletters

## Notes and Considerations

### API Rate Limits

- Buttondown API limits not documented in OpenAPI spec
- Implement conservative rate limiting by default
- Monitor response headers for rate limit info

### Character Encoding

- All text stored as UTF-8
- Handle emoji and special characters correctly
- Test with newsletters containing various encodings

### Timezones

- Store all dates in ISO 8601 format
- Preserve timezone information
- SQLite datetime functions work with ISO 8601

### Attachment Storage

- Attachments live on Buttondown S3
- Local storage is optional optimization
- Track both remote URL and local path
- Consider bandwidth when downloading

### Database Migrations

- Include schema_version in sync_metadata
- Plan for future schema changes
- Implement migration system from day one
- Keep migrations reversible when possible

## Success Criteria

### Minimum Viable Product (MVP)

- ✅ Fetch all historical newsletters
- ✅ Store in SQLite database
- ✅ Support incremental updates
- ✅ Handle attachments metadata
- ✅ CLI interface
- ✅ Committed to git

### Quality Metrics

- Sync all newsletters without data loss
- Incremental sync completes in < 30 seconds
- Database size reasonable (< 100MB for 1000 newsletters)
- No manual intervention required
- Clear error messages and logging

## References

- Buttondown API: https://api.buttondown.com/v1
- OpenAPI Spec: `buttondownOpenAPI.json` in this repo
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- SQLite Documentation: https://www.sqlite.org/docs.html

---

**Last Updated**: 2025-10-05
**Status**: Planning Phase
**Next Steps**: Begin Phase 1 implementation
