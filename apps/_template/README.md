# App Template

This is a template for creating new independent applications that share the core `letters` infrastructure.

## Quick Start

1. **Copy this directory** to create a new app:

   ```bash
   cp -r apps/_template apps/my-new-app
   ```

2. **Edit `apps/my-new-app/index.ts`** to implement your logic

3. **Add a script to `package.json`**:

   ```json
   {
     "scripts": {
       "my-app": "tsx apps/my-new-app/index.ts"
     }
   }
   ```

4. **Run your app**:
   ```bash
   npm run my-app
   ```

## What You Get

All apps automatically have access to:

### Database Layer

```typescript
import { initializeDatabase, getDatabaseStats } from '../../lib/db/schema.js';
import { DatabaseQueries } from '../../lib/db/queries.js';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Access all emails
const emails = queries.getAllEmails();

// Get specific email
const exists = queries.emailExists('some-id');

// Get embedded images
const images = queries.getEmbeddedImages('email-id');
```

### API Client

```typescript
import { ButtondownClient } from '../../lib/api/client.js';

const apiKey = process.env.BUTTONDOWN_API_KEY;
const client = new ButtondownClient(apiKey);

// Fetch single email
const email = await client.fetchEmail('id');

// Iterate all emails
for await (const email of client.fetchAllEmails()) {
  console.log(email.subject);
}
```

### Utilities

```typescript
import { logger, LogLevel } from '../../lib/utils/logger.js';
import {
  downloadAllImages,
  extractImageUrls,
} from '../../lib/utils/image-processor.js';
import { normalizeToMarkdown } from '../../lib/utils/markdown-normalizer.js';

// Logging
logger.info('Message');
logger.error('Error');
logger.setLevel(LogLevel.DEBUG);

// Image processing
const urls = extractImageUrls(html);
const images = await downloadAllImages(html);

// Markdown normalization
const markdown = normalizeToMarkdown(html);
```

## App Ideas

Here are some ideas for apps you could build:

- **Word Cloud Generator**: Analyze email content and generate word clouds
- **Bulk Exporter**: Export all emails to different formats (PDF, EPUB, etc.)
- **Content Analyzer**: Generate statistics, readability scores, sentiment analysis
- **Search Indexer**: Build a full-text search index
- **Backup Tool**: Create compressed backups of the database
- **Report Generator**: Generate monthly/yearly newsletter reports
- **Image Optimizer**: Compress or resize embedded images
- **Link Checker**: Verify all external links in emails
- **Duplicate Detector**: Find similar or duplicate content
- **Archive Builder**: Create a static website from newsletters

## Best Practices

1. **Always close the database**: Use a `try/finally` block

   ```typescript
   const db = initializeDatabase();
   try {
     // Your logic
   } finally {
     db.close();
   }
   ```

2. **Use transactions for multiple writes**:

   ```typescript
   queries.transaction(() => {
     queries.upsertEmail(email1);
     queries.upsertEmail(email2);
   });
   ```

3. **Handle errors gracefully**:

   ```typescript
   try {
     // Your logic
   } catch (error) {
     logger.error('Failed:', error);
     process.exit(1);
   }
   ```

4. **Load environment variables**:

   ```typescript
   import { config } from 'dotenv';
   config();
   ```

5. **Provide help text**:
   ```typescript
   if (args.includes('--help')) {
     printUsage();
     return;
   }
   ```

## File Structure

```
apps/
└── my-app/
    ├── index.ts          # Main entry point
    ├── README.md         # App-specific documentation (optional)
    ├── lib.ts            # App-specific utilities (optional)
    └── package.json      # App-specific dependencies (optional)
```

Most apps only need a single `index.ts` file. For larger apps, you can create additional files within the app directory.

## Dependencies

Apps can optionally have their own `package.json` for app-specific dependencies:

```json
{
  "name": "@letters/my-app",
  "private": true,
  "dependencies": {
    "your-specific-lib": "^1.0.0"
  }
}
```

But for most cases, adding dependencies to the root `package.json` is simpler.
