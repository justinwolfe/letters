# Tagging System

The tagging system uses OpenAI to automatically extract meaningful tags from newsletter content, normalizes them across all emails, and provides a UI for browsing emails by tag.

## Features

- **AI-Powered Tag Extraction**: Uses GPT-4 to analyze email content and extract 3-8 meaningful tags per email
- **Smart Normalization**: Automatically consolidates similar tags (e.g., "AI", "ai", "Artificial Intelligence" → "artificial intelligence")
- **Tag Navigation**: Click tags to view all emails with that tag
- **Database Integration**: Tags stored in normalized form with efficient querying
- **Reader UI**: Tags displayed at the bottom of each email with interactive badges

## Database Schema

### Tables

#### `tags`

Stores unique tags across all emails.

| Column            | Type                 | Description                     |
| ----------------- | -------------------- | ------------------------------- |
| `id`              | INTEGER PRIMARY KEY  | Auto-incrementing tag ID        |
| `name`            | TEXT NOT NULL UNIQUE | Display name of the tag         |
| `normalized_name` | TEXT NOT NULL        | Normalized version for matching |
| `created_at`      | TEXT NOT NULL        | ISO timestamp of creation       |

**Index**: `idx_tags_normalized_name` on `normalized_name`

#### `email_tags`

Junction table linking emails to tags (many-to-many).

| Column     | Type             | Description              |
| ---------- | ---------------- | ------------------------ |
| `email_id` | TEXT NOT NULL    | Foreign key to emails.id |
| `tag_id`   | INTEGER NOT NULL | Foreign key to tags.id   |

**Primary Key**: (`email_id`, `tag_id`)  
**Index**: `idx_email_tags_tag_id` on `tag_id`

## Setup

### 1. Migrate Database

Add the tags tables to your existing database:

```bash
npm run db:migrate:tags
```

This migration:

- Creates the `tags` and `email_tags` tables
- Updates schema version to 4
- Safe to run on existing databases (won't duplicate if already exists)

### 2. Configure OpenAI

Ensure you have an OpenAI API key configured:

```bash
export OPENAI_API_KEY="sk-..."
```

See [OPENAI_SETUP.md](./OPENAI_SETUP.md) for detailed setup instructions.

### 3. Extract Tags

Run tag extraction on all emails:

```bash
npm run tags:extract
```

This will:

1. Load all emails from the database
2. Analyze each email with GPT-4 to extract tags
3. Normalize tags across all emails to consolidate similar ones
4. Store tags in the database

**Options:**

```bash
# Process only first 10 emails (for testing)
npm run tags:extract:limit 10

# Process a specific email
npm run tags:extract -- --email-id abc123-def456

# Custom limit
npm run tags:extract -- --limit 50
```

### Performance

- **Concurrency**: 3 concurrent requests (configurable in script)
- **Rate Limiting**: 500ms delay between batches
- **Token Usage**: ~8000 chars per email (truncated if longer)
- **Estimated Time**: ~1-2 seconds per email

For 1000 emails:

- **Processing time**: ~30-40 minutes
- **OpenAI cost**: ~$5-10 (using gpt-4o-mini)

## API Endpoints

### Get All Tags

```http
GET /api/tags
```

Returns all tags with email counts:

```json
[
  {
    "id": 1,
    "name": "artificial intelligence",
    "normalized_name": "artificial-intelligence",
    "created_at": "2025-01-01T00:00:00Z",
    "email_count": 42
  }
]
```

### Get Emails by Tag

```http
GET /api/tags/:tagName/emails
```

Returns all emails with the specified tag:

```json
[
  {
    "id": "abc123",
    "subject": "The Future of AI",
    "description": "Exploring machine learning...",
    "publish_date": "2025-01-15T00:00:00Z",
    ...
  }
]
```

### Get Tag Statistics

```http
GET /api/tags/stats
```

Returns aggregate tag statistics:

```json
{
  "totalTags": 250,
  "totalEmailTags": 1850,
  "avgTagsPerEmail": 5.2,
  "maxTagsPerEmail": 8
}
```

## Database Queries

### Tag Operations

```typescript
import { initializeDatabase } from './lib/db/schema.js';
import { DatabaseQueries } from './lib/db/queries/index.js';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Add tags to an email
queries.tags.addTagsToEmail('email-123', [
  'artificial intelligence',
  'machine learning',
  'technology',
]);

// Get all tags for an email
const tags = queries.tags.getEmailTags('email-123');

// Get all emails with a specific tag
const emails = queries.tags.getEmailsByTag('artificial-intelligence');

// Get all tags with counts
const allTags = queries.tags.getAllTagsWithCounts();

// Search for tags
const aiTags = queries.tags.searchTags('%artificial%');

// Merge duplicate tags
queries.tags.mergeTags(sourceTagId, targetTagId);

// Get statistics
const stats = queries.tags.getTagStats();
```

## Reader UI

### Tag Display

Tags are displayed at the bottom of each email in the reader view:

```
[email content]
──────────────────
Tags:
#artificial-intelligence  #machine-learning  #ethics
```

### Tag Navigation

Clicking a tag badge:

1. Navigates to tag view
2. Displays all emails with that tag
3. Shows tag name in header
4. Allows clicking any email to read it
5. Provides back button to return to list

### Styling

Tag badges use GitHub-style design:

- Light blue background (#e7f3ff)
- Blue text (#0366d6)
- Rounded corners (16px)
- Hover effect (solid blue background)
- Smooth transitions

## Tag Extraction Details

### AI Prompt Strategy

The extraction uses a two-step process:

1. **Individual Extraction**: Each email is analyzed separately to extract 3-8 relevant tags
2. **Batch Normalization**: All extracted tags are normalized together to consolidate variations

### Tag Selection Criteria

The AI is instructed to extract tags that:

- Capture main topics and themes
- Balance broad topics and specific concepts
- Use clear, professional terminology
- Avoid overly generic terms ("update", "news")
- Use singular forms for nouns
- Prefer full phrases when appropriate

### Normalization Rules

Tags are normalized to consolidate:

- Different capitalizations (AI vs ai)
- Abbreviations vs full forms (ML vs Machine Learning)
- Plural vs singular (books vs book)
- Similar concepts with different wording
- Spelling variations

### Tag Quality

Expected tag characteristics:

- **Specific**: "machine learning" not just "technology"
- **Consistent**: Same topics always use same tag
- **Professional**: Clear terminology, no jargon unless domain-appropriate
- **Balanced**: Mix of broad and narrow topics
- **Relevant**: Actually appear in the content

## Maintenance

### Re-extracting Tags

To re-extract tags for specific emails:

```bash
# Clear existing tags for an email in database
# Then re-run extraction
npm run tags:extract -- --email-id abc123
```

### Finding Duplicate Tags

```typescript
// Find similar tags that might need merging
const aiTags = queries.tags.searchTags('%artificial%');
const mlTags = queries.tags.searchTags('%machine%');

// Merge if needed
queries.tags.mergeTags(sourceId, targetId);
```

### Cleaning Up Unused Tags

```typescript
// Get tags with no emails
const allTags = queries.tags.getAllTagsWithCounts();
const unusedTags = allTags.filter((t) => t.email_count === 0);

// Delete unused tags
unusedTags.forEach((tag) => {
  queries.tags.deleteTag(tag.id);
});
```

## Troubleshooting

### OpenAI Rate Limits

If you hit rate limits:

1. Reduce concurrency in `extract-tags.ts` (default: 3)
2. Increase delay between batches (default: 500ms)
3. Process in smaller batches using `--limit`

### Tag Normalization Issues

If tags aren't normalizing well:

1. Check the normalization prompt in `extract-tags.ts`
2. Manually merge similar tags using `queries.tags.mergeTags()`
3. Re-run extraction with improved prompts

### Missing Tags in UI

If tags don't appear in reader:

1. Verify tags exist in database: `queries.tags.getEmailTags(emailId)`
2. Check API endpoint: `curl http://localhost:3000/api/emails/:id`
3. Rebuild client: `npm run reader:build`
4. Check browser console for errors

## Future Enhancements

Possible improvements to the tagging system:

1. **Tag Cloud**: Visual representation of popular tags
2. **Tag Search**: Filter emails by multiple tags
3. **Manual Tag Management**: UI for adding/editing/merging tags
4. **Tag Relationships**: Related tags and tag hierarchies
5. **Tag Trends**: Popular tags over time
6. **Auto-retagging**: Automatically update tags when email content changes
7. **Tag Suggestions**: Suggest tags while writing new emails

## Examples

### View Tag Statistics

```typescript
const stats = queries.tags.getTagStats();
console.log(`Total unique tags: ${stats.totalTags}`);
console.log(`Average tags per email: ${stats.avgTagsPerEmail.toFixed(2)}`);

const topTags = queries.tags.getAllTagsWithCounts().slice(0, 10);
console.log('\nTop 10 tags:');
topTags.forEach((tag, i) => {
  console.log(`${i + 1}. ${tag.name} (${tag.email_count} emails)`);
});
```

### Find Related Content

```typescript
// Get all emails about AI
const aiEmails = queries.tags.getEmailsByTag('artificial-intelligence');

// Get their tags to find related topics
const relatedTags = new Set();
aiEmails.forEach((email) => {
  const tags = queries.tags.getEmailTags(email.id);
  tags.forEach((tag) => {
    if (tag.normalized_name !== 'artificial-intelligence') {
      relatedTags.add(tag.name);
    }
  });
});

console.log('Related topics to AI:', Array.from(relatedTags));
```

### Bulk Tag Update

```typescript
// Add a tag to multiple emails
const techEmails = queries.emails
  .getAllEmails()
  .filter((e) => e.subject.toLowerCase().includes('technology'));

techEmails.forEach((email) => {
  queries.tags.addTagToEmail(email.id, 'technology');
});
```

## References

- [OpenAI Setup](./OPENAI_SETUP.md) - Configure OpenAI API
- [Database Schema](../lib/db/schema.ts) - Full schema definition
- [Tag Queries](../lib/db/queries/tags.ts) - Query API documentation
- [Extract Script](../scripts/extract-tags.ts) - Tag extraction implementation
