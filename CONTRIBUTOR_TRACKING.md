# Contributor Tracking System

## Overview

This system identifies and tracks letters written by guest contributors, using OpenAI's GPT-4o-mini to automatically classify emails based on their subject lines.

## Results Summary

### Classification Statistics

- **Total Letters**: 1,834
- **Primary Author**: 1,648 letters (89.9%)
- **Guest Contributors**: 186 letters (10.1%)
- **Unique Contributors**: 80 guest authors

### Top Guest Contributors

1. **fsa** - 18 letters
2. **c** - 14 letters
3. **moe** - 14 letters
4. **esmé** - 13 letters
5. **L** - 12 letters (includes "Dr. L")
6. **kflo** - 9 letters
7. **deborah** - 7 letters
8. **y** - 7 letters
9. **k** - 5 letters
10. **patrick** - 4 letters

Plus 70 other contributors with 1-3 letters each.

## Database Schema

### New Field

The `emails` table now includes an `author` field:

- **Type**: `TEXT`
- **Values**:
  - `NULL` for primary author
  - Author name/identifier for guest contributors (e.g., "L", "Scarlett", "Dr. L")
- **Indexed**: Yes, for efficient queries

## Scripts and Commands

### Database Migration

```bash
npm run authors:migrate
```

Adds the `author` column to the emails table. This only needs to be run once.

### Classification

```bash
# Classify all emails and update database
npm run authors:classify

# Dry run - see what would happen without making changes
npm run authors:classify:dry
```

Uses OpenAI GPT-4o-mini to analyze subject lines and identify guest contributors.

**How it works:**

1. Fetches all emails from database
2. Sends subject lines to GPT-4o-mini for classification
3. Extracts author identifiers from parentheses in subjects
4. Updates database with author information
5. Saves detailed results to `author-classifications.json`

**Performance:**

- Processes 10 emails concurrently
- Takes ~3.5 minutes for 1,834 emails
- 100ms delay between batches to respect rate limits

### Generate Review Index

```bash
npm run authors:index
```

Creates a beautiful HTML index at `contributor-index/index.html` showing:

- All letters organized by author
- Statistics and quick navigation
- Interactive cards that link to full letters
- Visual distinction between primary and guest authors

## Files Created

### Scripts

- `scripts/migrate-add-author.ts` - Database migration
- `scripts/classify-authors.ts` - OpenAI-powered classification
- `scripts/generate-contributor-index.ts` - HTML index generation

### Data Files

- `author-classifications.json` - Detailed classification results with confidence levels
- `contributor-index/index.html` - Interactive review interface
- `contributor-index/README.md` - Documentation for the index

### Utility Modules

- `lib/utils/author-extractor.ts` - Local pattern-based author extraction
  - `extractAuthor(subject)` - Extract author from subject line
  - `extractAuthors(subjects)` - Batch extraction
  - Handles normalization (Dr. L → L, case normalization, etc.)

### Database Updates

- `lib/db/queries/emails.ts` - Extended with author-related methods:
  - `updateAuthor(emailId, author)` - Set author for an email
  - `getEmailsByAuthor(author)` - Get all emails by specific author
  - `getAllAuthors()` - Get list of all authors with counts
  - `upsertEmail(email, markdown, author)` - Now accepts optional author parameter

### Sync Integration

- `apps/sync/engine.ts` - Automatically extracts authors during sync:
  - Uses `extractAuthor()` on every email subject
  - Sets author field when upserting emails
  - No manual classification needed for new emails

## Classification Logic

The system uses a hybrid approach:

1. **Local Pattern Extraction** (primary, fast):

   - Parses parentheses in subject lines
   - Identifies names or initials like "(L)", "(Scarlett)", "((Dr)L)"
   - Normalizes variants (e.g., "Dr. L" → "L")
   - Filters out descriptive parentheses

2. **AI Fallback** (for edge cases):
   - Uses GPT-4o-mini for ambiguous cases
   - Conservative: only marks as guest when confident
   - Context aware: distinguishes author markers from descriptions

### Author Normalization

- **"Dr. L" and "L"** are normalized to "L" (same person)
- **Single letters** are uppercased (e.g., "l" → "L")
- **Multi-letter initials** stay lowercase (e.g., "fsa", "kflo")
- **Names** preserve original case (e.g., "Scarlett", "Esmé")

### Examples

- `"thank you notes (L)"` → Author: L
- `"thank you notes (Scarlett)(2)"` → Author: Scarlett
- `"tyn ((Dr)L)(4)"` → Author: L (normalized from Dr. L)
- `"4/2"` → Author: null (primary)
- `"don't read (butt stuff)"` → Author: null (descriptive, not author)

## Query Examples

### Get all letters by a specific contributor

```typescript
import { initializeDatabase } from './lib/db/schema.js';
import { DatabaseQueries } from './lib/db/queries/index.js';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Get all letters by "L"
const lLetters = queries.emails.getEmailsByAuthor('L');

// Get all primary author letters
const primaryLetters = queries.emails.getEmailsByAuthor(null);

db.close();
```

### Get author statistics

```typescript
const authors = queries.emails.getAllAuthors();
authors.forEach((author) => {
  console.log(`${author.author || 'Primary'}: ${author.count} letters`);
});
```

### Update an author

```typescript
// Manually correct a classification
queries.emails.updateAuthor('email-id-123', 'NewAuthorName');

// Mark as primary author
queries.emails.updateAuthor('email-id-456', null);
```

## Cost Estimate

Using GPT-4o-mini pricing (as of October 2024):

- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens

For 1,834 emails:

- Estimated total cost: **~$0.50** (very approximate)
- Average per email: ~$0.0003

## Future Enhancements

Possible improvements:

1. **Manual Review Interface**: Add UI to correct misclassifications
2. **Author Profiles**: Link initials to full names where known
3. **Contributor Analytics**: Track contribution patterns over time
4. **Export Options**: CSV/JSON exports of contributor data
5. **Search by Author**: Add author filter to main reader app
6. **Contributor Pages**: Dedicated pages for each contributor showing all their letters

## Maintenance

### Re-running Classification

If you add new emails or want to reclassify:

```bash
# Dry run to see changes
npm run authors:classify:dry

# Apply changes
npm run authors:classify

# Regenerate index
npm run authors:index
```

### Checking Results

1. Open `contributor-index/index.html` in browser
2. Review `author-classifications.json` for detailed results
3. Check confidence levels - "low" confidence entries may need manual review

## Technical Details

### Concurrency and Rate Limiting

- Processes 10 emails concurrently
- 100ms delay between batches
- Automatic retry on errors
- Progress tracking every 50 emails

### Data Integrity

- Uses transactions for database updates
- Original data preserved in `author-classifications.json`
- Can re-run classification without data loss
- Database author field uses `COALESCE` to preserve manual edits

### Error Handling

- Continues processing even if individual emails fail
- Tracks failed items separately
- Provides detailed error messages
- Safe to re-run on failure

---

**Generated**: October 19, 2025  
**Classification Model**: GPT-4o-mini  
**Total Processing Time**: ~3.5 minutes
