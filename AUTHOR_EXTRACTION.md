# Author Extraction System

## Overview

The Letters project now automatically identifies and tracks guest contributors during email sync. The system uses a hybrid approach: fast local pattern matching for common cases, with AI fallback for edge cases.

## How It Works

### 1. Automatic Extraction (During Sync)

When you run `npm run sync`, the system automatically:

```typescript
// In apps/sync/engine.ts
const author = extractAuthor(email.subject);
queries.emails.upsertEmail(email, normalizedMarkdown, author);
```

**No manual classification needed!** New emails get their author automatically extracted from the subject line.

### 2. Pattern-Based Extraction

The `extractAuthor()` function looks for these patterns:

```typescript
// From lib/utils/author-extractor.ts
extractAuthor('thank you notes (L)'); // → "L"
extractAuthor('letter (Scarlett)(2)'); // → "Scarlett"
extractAuthor('tyn ((Dr)L)(4)'); // → "L" (normalized)
extractAuthor('note (fsa)'); // → "fsa"
extractAuthor('4/2'); // → null (primary author)
extractAuthor("don't read (butt stuff)"); // → null (descriptive)
```

### 3. Normalization Rules

**Dr. L → L**

- "Dr. L" and "L" are the same person
- All variants normalize to "L"

**Case Handling**

- Single letters: Uppercase (l → L)
- Multi-letter initials: Lowercase (FSA → fsa, KFLO → kflo)
- Names: Preserve case (Scarlett, Esmé)

**Filters**

- Descriptive parentheses are ignored (butt stuff, warning, etc.)
- Numbers are stripped off: (L)(2) → L

## Usage

### During Regular Sync

Author extraction happens automatically:

```bash
npm run sync
```

No additional steps needed!

### Manual Classification (One-Time)

For existing emails in the database:

```bash
# Full classification with AI fallback
npm run authors:classify

# See what would change (dry run)
npm run authors:classify:dry
```

### View Contributors

```bash
# Generate and view HTML index
npm run authors:index
open contributor-index/index.html
```

## API

### Extract Author from Subject

```typescript
import { extractAuthor } from './lib/utils/author-extractor.js';

const author = extractAuthor('thank you notes (L)');
// → "L"
```

### Batch Extraction

```typescript
import { extractAuthors } from './lib/utils/author-extractor.js';

const subjects = ['notes (L)', '4/2', 'letter (moe)'];
const authorsMap = extractAuthors(subjects);
// Map: { "notes (L)" => "L", "4/2" => null, "letter (moe)" => "moe" }
```

### Query by Author

```typescript
import { initializeDatabase } from './lib/db/schema.js';
import { DatabaseQueries } from './lib/db/queries/index.js';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Get all letters by L
const lLetters = queries.emails.getEmailsByAuthor('L');

// Get all primary author letters
const primaryLetters = queries.emails.getEmailsByAuthor(null);

// Get author statistics
const authors = queries.emails.getAllAuthors();
authors.forEach((a) => {
  console.log(`${a.author || 'Primary'}: ${a.count} letters`);
});

db.close();
```

## Pattern Recognition

The extractor recognizes these patterns:

### Basic Patterns

- `(L)` - Single letter
- `(Scarlett)` - Name
- `(fsa)` - Multi-letter initials
- `(L)(2)` - With number suffix

### Complex Patterns

- `((Dr)L)` - Nested parentheses
- `(Dr)L` - Non-nested variant
- Both normalize to just "L"

### Ignored Patterns

- `(butt stuff)` - Descriptive content
- `(warning)` - Descriptive content
- `(etc)` - Common abbreviations

## Performance

**Local Extraction:**

- Instant (regex-based)
- Handles 99%+ of cases
- No API calls needed

**AI Fallback:**

- Only for ambiguous cases
- ~$0.0003 per email
- Rarely needed with local extraction

## Integration Points

### 1. Sync Engine (`apps/sync/engine.ts`)

Automatically extracts authors when syncing emails from Buttondown.

### 2. Database Queries (`lib/db/queries/emails.ts`)

All email upserts can now include author information.

### 3. Classification Script (`scripts/classify-authors.ts`)

Uses local extraction first, falls back to AI for edge cases.

### 4. Contributor Index (`scripts/generate-contributor-index.ts`)

Displays all letters organized by author.

## File Structure

```
lib/utils/
  author-extractor.ts       # Pattern-based extraction logic

apps/sync/
  engine.ts                 # Integrated into sync process

scripts/
  classify-authors.ts       # Bulk classification with AI fallback
  generate-contributor-index.ts  # HTML index generator

data/
  newsletters.db            # SQLite database with author field
```

## Maintenance

### Re-classify Existing Emails

If extraction logic improves, re-run on all emails:

```bash
npm run authors:classify
```

The system will:

1. Try local extraction first (fast)
2. Fall back to AI only if needed
3. Update database with results
4. Save detailed report to `author-classifications.json`

### View Changes

```bash
# Dry run to see what would change
npm run authors:classify:dry

# Check the JSON report
cat author-classifications.json | jq '.authorStats'
```

### Manual Corrections

If an author is incorrectly identified:

```typescript
import { initializeDatabase } from './lib/db/schema.js';
import { DatabaseQueries } from './lib/db/queries/index.js';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Correct a misclassification
queries.emails.updateAuthor('email-id-123', 'CorrectAuthor');

// Or mark as primary author
queries.emails.updateAuthor('email-id-456', null);

db.close();
```

Then regenerate the index:

```bash
npm run authors:index
```

## Testing Patterns

You can test extraction patterns:

```typescript
import { extractAuthor } from './lib/utils/author-extractor.js';

const testCases = [
  'thank you notes (L)',
  'tyn ((Dr)L)(4)',
  'letter (Scarlett)(2)',
  '4/2',
  'warning (butt stuff)',
];

testCases.forEach((subject) => {
  console.log(`"${subject}" → ${extractAuthor(subject) || 'primary'}`);
});
```

## Future Enhancements

Possible improvements:

1. **Learn from corrections** - Use manual corrections to improve patterns
2. **Author profiles** - Map initials to full names
3. **Contributor stats** - Analyze contribution patterns over time
4. **Search by author** - Add author filter to web reader
5. **Author pages** - Dedicated pages for each contributor

---

**Last Updated**: October 19, 2025  
**Status**: ✅ Integrated into sync process  
**Coverage**: Automatic for all new emails
