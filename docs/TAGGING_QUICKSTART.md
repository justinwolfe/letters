# Tagging System Quick Start

## Setup (5 minutes)

### 1. Set OpenAI API Key

```bash
export OPENAI_API_KEY="sk-your-key-here"
```

Or add to `.env` file:

```
OPENAI_API_KEY=sk-your-key-here
```

### 2. Migrate Database

```bash
npm run db:migrate:tags
```

This adds the `tags` and `email_tags` tables to your database.

### 3. Extract Tags

**Test with 10 emails first:**

```bash
npm run tags:extract:limit 10
```

**Extract all emails:**

```bash
npm run tags:extract
```

This will take ~30-40 minutes for 1000 emails and costs ~$3-6 in OpenAI credits.

### 4. Start the Reader

```bash
npm run dev
```

Open http://localhost:5173 and explore emails with tags!

## How It Works

### 1. Viewing Tags

Open any email → scroll to bottom → see tags displayed

```
[Email content...]
──────────────────
Tags:
#artificial-intelligence  #machine-learning  #ethics
```

### 2. Browsing by Tag

Click any tag → see all emails with that tag

```
← back

#machine-learning

15 letters with this tag

[List of emails...]
```

### 3. Programmatic Access

```typescript
import { initializeDatabase } from './lib/db/schema.js';
import { DatabaseQueries } from './lib/db/queries/index.js';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Get tags for an email
const tags = queries.tags.getEmailTags('email-id');

// Get emails by tag
const emails = queries.tags.getEmailsByTag('artificial-intelligence');

// Get all tags with counts
const allTags = queries.tags.getAllTagsWithCounts();

// Get statistics
const stats = queries.tags.getTagStats();
```

## API Endpoints

```bash
# Get all tags with counts
curl http://localhost:3000/api/tags

# Get emails with a specific tag
curl http://localhost:3000/api/tags/machine-learning/emails

# Get tag statistics
curl http://localhost:3000/api/tags/stats

# Get email with tags
curl http://localhost:3000/api/emails/:id
```

## Common Tasks

### Re-extract Tags for Specific Email

```bash
npm run tags:extract -- --email-id abc-123-def
```

### View Tag Statistics

```bash
sqlite3 data/newsletters.db << EOF
SELECT
  COUNT(*) as total_tags,
  (SELECT COUNT(*) FROM email_tags) as total_associations,
  (SELECT AVG(tag_count) FROM (
    SELECT COUNT(*) as tag_count FROM email_tags GROUP BY email_id
  )) as avg_per_email
FROM tags;
EOF
```

### Find Similar Tags

```bash
sqlite3 data/newsletters.db << EOF
SELECT name, email_count FROM (
  SELECT t.name, COUNT(et.email_id) as email_count
  FROM tags t
  LEFT JOIN email_tags et ON t.id = et.tag_id
  WHERE t.name LIKE '%machine%'
  GROUP BY t.id
)
ORDER BY email_count DESC;
EOF
```

### Top 20 Tags

```bash
sqlite3 data/newsletters.db << EOF
SELECT t.name, COUNT(et.email_id) as count
FROM tags t
LEFT JOIN email_tags et ON t.id = et.tag_id
GROUP BY t.id
ORDER BY count DESC
LIMIT 20;
EOF
```

## Troubleshooting

### "No OpenAI API key"

```bash
export OPENAI_API_KEY="sk-..."
```

### "Rate limit exceeded"

Reduce concurrency in `scripts/extract-tags.ts`:

```typescript
concurrency: 2,  // Change from 3 to 2
delayMs: 1000,   // Change from 500 to 1000
```

### Tags not showing in UI

```bash
# Rebuild client
npm run reader:build

# Restart server
npm run dev
```

### Database locked

Close any other processes using the database, then try again.

## Cost Estimates

| Emails | Time     | Cost (gpt-4o-mini) |
| ------ | -------- | ------------------ |
| 10     | ~1 min   | $0.05              |
| 100    | ~5 min   | $0.50              |
| 1000   | ~35 min  | $3-6               |
| 10000  | ~6 hours | $30-60             |

## What Gets Extracted?

The AI extracts 3-8 tags per email focusing on:

- Main topics and themes
- Specific concepts and technologies
- Balanced broad + narrow tags
- Professional terminology
- Relevant to content

**Good tags:**

- "artificial intelligence"
- "climate change"
- "startup funding"
- "machine learning"
- "product design"

**Avoided:**

- "update"
- "news"
- "thoughts"
- "interesting"

## Next Steps

1. **Browse**: Explore emails by clicking tags
2. **Analyze**: Check `docs/TAGGING_SYSTEM.md` for advanced features
3. **Customize**: Modify prompts in `scripts/extract-tags.ts`
4. **Extend**: Add features like tag clouds or multi-tag filtering

## Full Documentation

See `docs/TAGGING_SYSTEM.md` for:

- Detailed API documentation
- Advanced queries
- Maintenance procedures
- Future enhancements
- Troubleshooting guide
