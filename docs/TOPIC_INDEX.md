# Topic-Based Newsletter Index

A meaningful, navigable index of topics, people, places, and concepts across your newsletters - with direct links to each article!

## What's This?

Instead of showing generic words like "thankful" or "like", this index extracts:

- **Named Entities**: People, places, products (David Bowie, Christmas, American...)
- **Concepts & Themes**: ASMR, APIs, couples...
- **Shows & Media**: Battlestar, Dickinson, Mad Men...
- **Technical Terms**: APIs, analyze, arrested development...

Each topic links directly to the newsletters where it's mentioned!

## Quick Start

### Generate the Index

```bash
npm run index:topics
```

This creates `public/topic-index.html` - a beautiful, searchable index page.

### Open It

```bash
open public/topic-index.html
```

Or just browse to it in your static site!

## Features

✨ **Beautiful Design**

- Clean, modern interface
- Organized alphabetically
- Sticky alphabet navigation
- Mobile-responsive

🔍 **Live Search**

- Type to filter topics instantly
- Searches across all entries
- No page reload needed

🔗 **Direct Links**

- Every entry links to your actual newsletters
- Click to read the full context
- Sorted by most recent first

📊 **Smart Categorization**

- Named Entities (people, places, things)
- Phrases (multi-word concepts)
- Badge system for easy scanning

## Customization

### Adjust Frequency Threshold

```bash
# Only show topics mentioned 5+ times
npm run index:topics -- --min-frequency 5

# Show topics mentioned 2+ times (more comprehensive)
npm run index:topics -- --min-frequency 2
```

### Change Output Location

```bash
# Generate in a different directory
npm run index:topics -- --output-dir ./static-site

# Custom base URL for links
npm run index:topics -- --base-url /newsletters/
```

### Full Options

```bash
npm run index:topics -- \
  --min-frequency 3 \
  --output-dir ./public \
  --base-url /letters/
```

## How It Works

### 1. Entity Extraction

Identifies capitalized words and multi-word proper nouns:

- "David Bowie" (person)
- "New York" (place)
- "Mad Men" (show)

### 2. Phrase Detection

Finds meaningful multi-word concepts:

- Technical terms (7+ character words)
- Capitalized sequences
- Filtered against generic stopwords

### 3. Aggressive Filtering

Removes noise like:

- Generic words (the, and, very, really...)
- Common phrases (i'm, that's, it's...)
- Markdown artifacts
- Pure numbers (unless part of a phrase)

### 4. Link Generation

Uses email slugs to create URLs:

- `/letters/your-newsletter-slug.html`
- Falls back to secondary ID if no slug
- Context snippets show how topic is used

## Examples

### Browse by Letter

Click any letter in the alphabet navigation to jump to topics starting with that letter.

### Search for Topics

Type in the search box to instantly filter:

- "bowie" → Shows all David Bowie references
- "christmas" → Holiday-themed newsletters
- "API" → Technical discussions

### Click to Read

Each topic shows up to 5 recent newsletters mentioning it. Click any one to read the full article.

## Statistics

With default settings (min frequency: 3), you'll typically see:

- **~100-150 topics** for 1,800+ newsletters
- **Mix of entities and phrases**
- **Named entities** (people, places, shows): ~90%
- **Phrases** (concepts, terms): ~10%

## Tips

### Finding Related Content

1. Search for a broad topic (e.g., "writing")
2. Look at the contexts to see how you discuss it
3. Click through to newsletters for full context

### Discovering Themes

1. Browse alphabetically
2. Look for clustered topics (similar themes)
3. Note the frequency - high counts mean recurring interests

### Tracking Evolution

Generate the index periodically to see how your topics change over time.

## File Size

- Typical size: ~300-800 KB
- Loads instantly (unlike the 200+ MB full word index!)
- Works great on mobile

## Integration

### Add to Static Site Nav

```html
<nav>
  <a href="/index.html">Home</a>
  <a href="/topic-index.html">Topics</a>
  <a href="/archive.html">Archive</a>
</nav>
```

### Embed in Reader App

The topic index can be served alongside your newsletter reader for enhanced navigation.

## Troubleshooting

### "Too few topics"

Increase sensitivity:

```bash
npm run index:topics -- --min-frequency 2
```

### "Too many generic terms"

The algorithm is already pretty strict, but you can:

1. Edit `STOPWORDS` in `scripts/generate-topic-index.ts`
2. Adjust `isValidTopic()` function for stricter filtering

### "Links don't work"

Check your base URL:

```bash
npm run index:topics -- --base-url /your-path/
```

## Comparison with Full Index

| Feature    | Topic Index     | Full Word Index  |
| ---------- | --------------- | ---------------- |
| Size       | ~500 KB         | ~370 MB          |
| Topics     | ~150 meaningful | ~90,000 generic  |
| Load time  | Instant         | 5-10 seconds     |
| Usefulness | High signal     | Low signal/noise |
| Links      | ✅ Yes          | ❌ No            |

## Future Enhancements

Possible additions:

- Tag clouds by frequency
- Temporal views (topics over time)
- Related topics (co-occurrence)
- Topic categories (people, places, media)
- Export to JSON for custom views

---

_Generated with ❤️ for your newsletters_
