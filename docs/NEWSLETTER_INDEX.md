# Newsletter Index Generation

Generate a comprehensive, book-style index of all words and phrases that appear repeatedly across your newsletters.

## Overview

The index generation script analyzes all newsletter content in your database and creates an exhaustive concordance showing:

- **Words**: Individual terms and their frequency across all newsletters
- **Phrases**: Multi-word expressions (2-5 words) that appear repeatedly
- **Context**: Snippets of text showing how each term is used
- **References**: Which newsletters contain each term, with publication dates

## Quick Start

Generate an index with default settings:

```bash
npm run index:generate
```

This will create three files in `./index-output/`:

- `index.json` - Machine-readable data
- `index.html` - Interactive web interface with search
- `index.md` - Human-readable Markdown document

## Usage

### Basic Usage

```bash
# Generate all formats with defaults
npm run index:generate

# Generate only HTML
npm run index:generate -- --format html

# Generate with custom thresholds
npm run index:generate -- --min-word-freq 5 --min-phrase-freq 3

# Custom output directory
npm run index:generate -- --output-dir ./my-index
```

### Command Line Options

| Option                  | Default        | Description                                         |
| ----------------------- | -------------- | --------------------------------------------------- |
| `--min-word-freq <n>`   | 3              | Minimum times a word must appear to be included     |
| `--min-phrase-freq <n>` | 2              | Minimum times a phrase must appear to be included   |
| `--max-phrases <n>`     | 5              | Maximum phrase length in words (2-5 typically)      |
| `--format <type>`       | all            | Output format: `json`, `html`, `markdown`, or `all` |
| `--output-dir <path>`   | ./index-output | Where to save the generated files                   |
| `--no-stopwords`        | false          | Don't filter common words (the, and, is, etc.)      |
| `--context-chars <n>`   | 100            | Characters of context to show around matches        |

### Examples

#### High-frequency terms only

```bash
npm run index:generate -- --min-word-freq 10 --min-phrase-freq 5
```

#### Include stopwords for exhaustive analysis

```bash
npm run index:generate -- --no-stopwords --min-word-freq 1
```

#### Longer phrases with more context

```bash
npm run index:generate -- --max-phrases 7 --context-chars 200
```

#### Generate only JSON for programmatic use

```bash
npm run index:generate -- --format json --output-dir ./data
```

## Output Formats

### HTML (Interactive)

The HTML output (`index.html`) is the recommended format for exploring your index:

**Features:**

- Search box for filtering terms in real-time
- Clickable navigation between words and phrases sections
- Formatted contexts showing how terms are used
- Publication dates for each occurrence
- Responsive design for mobile/desktop

**Usage:**
Open `index-output/index.html` in any web browser.

### JSON (Programmatic)

The JSON output (`index.json`) is ideal for:

- Building custom tools
- Integration with other systems
- Data analysis with scripts
- Automated processing

**Structure:**

```json
{
  "metadata": {
    "generatedAt": "2025-10-19T...",
    "totalEmails": 1834,
    "uniqueWords": 15420,
    "uniquePhrases": 8932,
    ...
  },
  "words": [
    {
      "word": "technology",
      "frequency": 47,
      "occurrences": [
        {
          "emailId": "...",
          "emailSubject": "...",
          "publishDate": "...",
          "context": "...technology has evolved...",
          "position": 142
        }
      ]
    }
  ],
  "phrases": [...]
}
```

### Markdown (Readable)

The Markdown output (`index.md`) is perfect for:

- Reading in text editors
- Version control tracking
- Converting to PDFs
- Sharing via documentation systems

## How It Works

### 1. Text Extraction

- Reads all emails from the database
- Extracts text from HTML and Markdown
- Removes markup, URLs, and code blocks
- Normalizes whitespace

### 2. Tokenization

- Splits text into individual words
- Converts to lowercase for matching
- Preserves apostrophes and hyphens
- Filters very short words (< 2 characters)

### 3. Word Analysis

- Counts frequency of each word
- Tracks which newsletters contain each word
- Captures surrounding context
- Optionally filters stopwords (the, and, is, etc.)

### 4. Phrase Detection

- Generates n-grams (2-5 word sequences)
- Identifies repeated phrases
- Tracks phrase occurrences across newsletters
- Filters phrases that are all stopwords

### 5. Index Generation

- Sorts by frequency (most common first)
- Groups occurrences by newsletter
- Formats output in chosen format(s)
- Includes metadata and statistics

## Stopword Filtering

By default, the script filters common English stopwords like:

- Articles: a, an, the
- Conjunctions: and, or, but
- Prepositions: in, on, at, to, from
- Pronouns: he, she, it, they
- Common verbs: is, are, was, were, have, has

**Why filter stopwords?**

- Reduces noise in the index
- Highlights meaningful content words
- Makes the index more useful for discovery

**When to disable filtering:**

- Linguistic analysis
- Complete concordance needed
- Studying grammar patterns
- Creating exhaustive reference

Use `--no-stopwords` to disable filtering.

## Performance

The script is optimized for large newsletter archives:

| Archive Size | Processing Time | Memory Usage |
| ------------ | --------------- | ------------ |
| 100 emails   | ~5 seconds      | ~50 MB       |
| 500 emails   | ~20 seconds     | ~150 MB      |
| 1000 emails  | ~45 seconds     | ~300 MB      |
| 2000+ emails | ~90 seconds     | ~500 MB      |

_Times are approximate and vary based on content length and system specs._

## Use Cases

### Writing Analysis

- Identify overused words or phrases
- Find consistent themes across newsletters
- Track evolution of topics over time
- Discover writing patterns

### Content Discovery

- Find newsletters discussing specific topics
- Locate specific quotes or references
- Cross-reference related content
- Build thematic collections

### Research & Reference

- Create a searchable concordance
- Build citation index
- Track terminology usage
- Analyze vocabulary breadth

### SEO & Keywords

- Identify primary topics
- Find natural keyword patterns
- Discover content themes
- Optimize for search

## Tips & Best Practices

### Start with Defaults

The default settings work well for most use cases. Run once with defaults to see what you get.

### Adjust Thresholds Iteratively

If you get too many results:

```bash
npm run index:generate -- --min-word-freq 5 --min-phrase-freq 4
```

If you want more comprehensive results:

```bash
npm run index:generate -- --min-word-freq 2 --min-phrase-freq 2
```

### Use HTML for Exploration

The HTML output is the best way to explore your index initially. Use the search box to find specific terms.

### Export JSON for Analysis

Once you know what you're looking for, use the JSON output for programmatic analysis:

```typescript
import { readFileSync } from 'fs';

const index = JSON.parse(readFileSync('index-output/index.json', 'utf-8'));

// Find all newsletters mentioning "artificial intelligence"
const aiPhrases = index.phrases.find(
  (p) => p.phrase === 'artificial intelligence'
);
console.log(`AI mentioned in ${aiPhrases.frequency} newsletters`);
```

### Track Changes Over Time

Generate the index periodically and compare:

```bash
npm run index:generate -- --output-dir ./index-2025-01
# Later...
npm run index:generate -- --output-dir ./index-2025-06
```

## Troubleshooting

### "No emails found in database"

**Solution:** Run sync first:

```bash
npm run sync
```

### Index is too large / takes too long

**Solution:** Increase minimum frequencies:

```bash
npm run index:generate -- --min-word-freq 10 --min-phrase-freq 5
```

### Out of memory error

**Solution:** Process in batches or use a machine with more RAM. The script processes all emails at once for accuracy.

### Missing normalized markdown

**Solution:** Run markdown normalization:

```bash
npm run normalize:markdown
```

The script will fall back to raw HTML content if normalized markdown isn't available.

## Advanced Usage

### Custom Stopwords

Edit the `STOPWORDS` set in `scripts/generate-index.ts` to add domain-specific terms:

```typescript
const STOPWORDS = new Set([
  // ... existing words ...
  'newsletter',
  'subscribe',
  'unsubscribe', // Add your terms
]);
```

### Integration with Other Tools

The JSON output can be consumed by:

- Static site generators
- Search engines (Algolia, Elasticsearch)
- Analytics dashboards
- Custom web applications

Example with a static site:

```typescript
import index from './index-output/index.json';

// Generate tag pages
index.words.forEach((word) => {
  if (word.frequency > 10) {
    generateTagPage(word.word, word.occurrences);
  }
});
```

### Automating Index Updates

Add to your CI/CD pipeline or cron job:

```bash
# Update index nightly
0 2 * * * cd /path/to/letters && npm run sync && npm run index:generate
```

## Technical Details

### Algorithm Complexity

- Text extraction: O(n) where n = total content length
- Word indexing: O(n × m) where m = unique words
- Phrase indexing: O(n × p × l) where p = phrase length, l = phrase count

### Data Structures

- Word index: Hash map for O(1) lookup
- Phrase index: Hash map for O(1) lookup
- Occurrences: Arrays sorted by date

### Context Extraction

Contexts are extracted with configurable character limits around each match, with ellipses indicating truncation.

## Related Scripts

- `npm run normalize:markdown` - Prepare content for indexing
- `npm run sync` - Sync newsletters from Buttondown
- `npm run export:email` - Export individual newsletters
- `npm run inspect:email` - Inspect newsletter content

## License

Part of the Letters project. See main project license.

## Support

For issues or questions:

1. Check this documentation
2. Review the script source: `scripts/generate-index.ts`
3. Open an issue in the project repository
