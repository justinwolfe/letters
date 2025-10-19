# Contributors Index

This directory contains an automatically generated HTML index of all letters organized by author.

## Files

- **index.html** - Interactive HTML page showing all letters grouped by contributor

## Viewing the Index

Open the index in your browser:

```bash
open contributor-index/index.html
```

Or simply double-click the `index.html` file in Finder.

## Features

- **Author Statistics** - See how many letters each contributor wrote
- **Quick Navigation** - Jump directly to any contributor's letters
- **Visual Cards** - Each letter is displayed in an interactive card
- **Click to Read** - Click any letter card to open the full letter in a new tab
- **Beautiful Design** - Modern, responsive UI with gradient headers

## Classification Details

The contributor classifications were performed using OpenAI's GPT-4o-mini model, which analyzed email subject lines to identify guest contributors (marked by names or initials in parentheses).

See `author-classifications.json` in the project root for the full classification data including confidence levels and explanations.

## Regenerating the Index

To regenerate this index after new classifications:

```bash
npm run authors:index
```

## Related Commands

- `npm run authors:classify` - Classify all emails using OpenAI
- `npm run authors:classify:dry` - Dry run of classification (no database changes)
- `npm run authors:migrate` - Add author field to database (one-time setup)
