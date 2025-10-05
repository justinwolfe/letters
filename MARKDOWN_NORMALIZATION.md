# Markdown Normalization

This feature automatically converts email newsletter HTML content into clean, normalized markdown format while preserving the original HTML for archival purposes.

## What Gets Normalized

The normalization process:

- ✅ **Preserves**: Links, images, headings, lists, strong, italic, code, pre, and other basic formatting
- ❌ **Strips**: Complex HTML like divs, spans, tables (converts to text), style attributes, scripts, and other non-markdown elements
- 🧹 **Cleans**: Excessive whitespace, HTML comments, and formatting inconsistencies

## Database Schema

The `emails` table now includes a `normalized_markdown` column:

- `body` - Original HTML/markdown content (preserved for archival)
- `normalized_markdown` - Clean markdown version (auto-generated)

## Automatic Normalization

When you sync emails, they are automatically normalized:

```bash
npm run sync
```

New emails will have their `normalized_markdown` field populated automatically.

## Normalizing Existing Emails

To normalize all existing emails in your database:

```bash
npm run normalize:markdown
```

This script will:

1. Check if the database schema needs updating
2. Add the `normalized_markdown` column if it doesn't exist
3. Process all emails that don't have normalized markdown
4. Show progress as it works through your archive

## How It Works

The normalization uses the [Turndown](https://github.com/mixmark-io/turndown) library with custom rules to:

1. Convert HTML to markdown
2. Remove unwanted HTML elements
3. Clean up whitespace and formatting
4. Preserve only markdown-friendly elements

## Example

**Original HTML:**

```html
<div style="background: #fff;">
  <h1>Hello World</h1>
  <p>
    This is <strong>important</strong> text with a
    <a href="https://example.com">link</a>.
  </p>
  <script>
    alert('removed');
  </script>
</div>
```

**Normalized Markdown:**

```markdown
# Hello World

This is **important** text with a [link](https://example.com).
```

## Migration Notes

- The original `body` field is never modified
- Normalization is idempotent - you can run it multiple times safely
- Failed normalizations are logged but don't stop the process
- The schema version is automatically updated to version 3

## Querying Normalized Content

You can query emails with normalized markdown:

```typescript
// Get all emails with normalized markdown
const emails = db
  .prepare('SELECT * FROM emails WHERE normalized_markdown IS NOT NULL')
  .all();

// Get emails that need normalization
const needsNormalization = queries.getEmailsWithoutNormalizedMarkdown();

// Count emails without normalized markdown
const count = queries.countEmailsWithoutNormalizedMarkdown();
```

## Use Cases

- **Search**: Search through clean text without HTML noise
- **Export**: Export newsletters in a consistent markdown format
- **Display**: Render content without worrying about HTML quirks
- **Analysis**: Analyze content without parsing complex HTML
- **Portability**: Move content to other markdown-based systems
