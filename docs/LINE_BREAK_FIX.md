# Line Break Issue Fix

## Problem

Line breaks that were present in the original letters were not being rendered in the reader app. This was particularly noticeable in older letters like the 11/6/15 letter, which should have had paragraph breaks between each "i'm thankful" paragraph.

## Root Cause

The issue was in the markdown normalization process (`lib/utils/markdown-normalizer.ts`).

1. **Plaintext letters** (marked with `<!-- buttondown-editor-mode: plaintext -->`) contained paragraph breaks as double line breaks (`\r\n\r\n` or `\n\n`)
2. When the Turndown library processed this content as HTML, it collapsed the whitespace, treating the line breaks as HTML whitespace rather than meaningful content
3. This resulted in all paragraphs being concatenated into one continuous block of text

## Solution

Updated `normalizeToMarkdown()` function to handle two cases differently:

### For Plaintext Content

- Detect letters marked with `buttondown-editor-mode: plaintext`
- Skip Turndown processing entirely
- Simply remove HTML comments and normalize line endings
- Preserve paragraph breaks by not collapsing whitespace

### For HTML Content

- Use a placeholder technique to preserve paragraph breaks before Turndown processing
- Replace `\r?\n\r?\n` (double line breaks) with `___PARAGRAPH_BREAK___` placeholder
- Process through Turndown
- Restore the paragraph breaks after conversion
- This ensures paragraph breaks are preserved even when Turndown might collapse them

## Implementation

Modified `/Users/justinwolfe/Projects/letters/lib/utils/markdown-normalizer.ts`:

- Added detection for plaintext mode
- Added separate processing paths for plaintext vs HTML content
- Implemented placeholder technique for HTML content

## Results

All 1834 emails were re-normalized with the fixed logic. The 11/6/15 letter and other letters now properly display paragraph breaks in the reader app.

## Frontend Rendering

No changes were needed to the frontend. ReactMarkdown (v10.1.0) follows the CommonMark spec by default:

- Double newlines (`\n\n`) create paragraph breaks
- This works correctly with the preserved line breaks from the fixed normalization

## Testing

Verified with the 11/6/15 letter (ID: `d30fc2aa-657d-470e-920d-4b28038b804a`):

- **Before**: All paragraphs merged into one continuous block
- **After**: Proper paragraph breaks between each "i'm thankful" paragraph

## Date

October 5, 2025
