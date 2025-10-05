# Image Archiving Guide

This guide explains how to use the image archiving features to create fully self-contained email archives.

## Quick Start

### 1. Migrate Your Database

If you have an existing database, first run the migration to add the `embedded_images` table:

```bash
npm run db:migrate
```

### 2. Download Images

You have two options:

#### Option A: Download images for existing emails

```bash
npm run images:download
```

This will:

- Scan all emails in your database
- Extract image URLs from the HTML
- Download each image
- Store them as BLOBs in SQLite

#### Option B: Include image downloading during sync

```bash
npm run sync -- --download-images
```

This will sync emails from Buttondown AND download images at the same time.

### 3. Check Statistics

View statistics about your embedded images:

```bash
npm run images:stats
```

This shows:

- How many emails have embedded images
- Number of images per email
- Total size of images
- Size breakdown by email

### 4. Export an Email

Export a single email as a standalone HTML file with all images embedded:

```bash
npm run export:email <email-id> output.html
```

The exported HTML file will be completely self-contained with all images as data URIs.

## How It Works

### Image Extraction

The system extracts images from:

- `<img>` tags with `src` attributes
- CSS `background-image: url(...)` properties
- CSS `background: url(...)` shorthand properties

It only downloads remote images (starting with `http://` or `https://`).

### Image Storage

Images are stored in the `embedded_images` table with:

| Column          | Description                           |
| --------------- | ------------------------------------- |
| `id`            | Auto-increment primary key            |
| `email_id`      | Foreign key to emails table           |
| `original_url`  | Original URL of the image             |
| `image_data`    | Binary data (BLOB)                    |
| `mime_type`     | MIME type (e.g., `image/png`)         |
| `file_size`     | Size in bytes                         |
| `width`         | Image width in pixels (if available)  |
| `height`        | Image height in pixels (if available) |
| `downloaded_at` | Timestamp of download                 |

### Data URIs

When exporting emails, images are converted to data URIs:

```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
```

This allows the entire email to be viewed in a browser without any external dependencies.

## Use Cases

### 1. Archiving for Posterity

Download images to preserve them even if:

- Original images are deleted from Buttondown
- Image hosting services go offline
- URLs change or expire

### 2. Offline Access

With embedded images, you can:

- View complete emails without internet
- Export emails to share via USB drive
- Create offline reading collections

### 3. Version Control

Since images are stored in SQLite:

- Image history is tracked in git
- You can see when images changed
- Full archive is portable

### 4. Self-Contained Exports

Export emails as standalone HTML files:

- No external dependencies
- Works in any browser
- Can be emailed or shared easily

## Commands Reference

```bash
# Migrate database to support images
npm run db:migrate

# Download images for existing emails
npm run images:download

# Download images during sync
npm run sync -- --download-images

# View image statistics
npm run images:stats

# Export single email with embedded images
npm run export:email <email-id> [output.html]

# Dry run (preview without downloading)
npm run images:download -- --dry-run
```

## Performance Considerations

### Download Speed

Images are downloaded with concurrency control (5 images at a time by default). This balances:

- Speed (parallel downloads)
- Politeness (not overwhelming servers)
- Memory usage

### Database Size

Images can significantly increase database size:

- Average image: 50-200 KB
- Email with 10 images: ~1 MB
- 100 emails with images: ~100 MB

This is usually fine for:

- Git repositories (< 1 GB recommended)
- Version control (binary diffs are efficient)
- SQLite performance (< 1 GB is fast)

### Incremental Downloads

The system is smart about downloads:

- Only downloads images once per email
- Skips emails that already have images
- Safe to run multiple times
- Resumable if interrupted

## Troubleshooting

### Images Not Found

If some images fail to download:

- They may be deleted from the source
- Hosting server may be down
- URLs may require authentication
- Network errors

The system will:

- Log warnings for failed downloads
- Continue with other images
- Keep the original URLs in the HTML

### Database Size Too Large

If your database gets too large:

- Consider selective archiving
- Skip image downloading for drafts
- Use external storage for images
- Compress the database

### Slow Downloads

If downloads are slow:

- Check your internet connection
- Some servers may rate-limit
- Large images take time
- Try during off-peak hours

## Technical Details

### Image Format Support

The system downloads and stores:

- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- WebP (`.webp`)
- SVG (`.svg`)
- Other formats served with `image/*` MIME type

### Dimension Extraction

The system attempts to extract image dimensions for:

- PNG (reads IHDR chunk)
- JPEG (parses SOF markers)
- GIF (reads logical screen descriptor)

Dimensions are optional and only used for metadata.

### Data URI Limits

Data URIs have some browser limits:

- Chrome: ~2 MB per URI
- Firefox: No practical limit
- Safari: ~3 MB per URI
- Edge: Same as Chrome

For most newsletter images (< 500 KB), this is not an issue.

### Deduplication

Images are deduplicated per email:

- Same URL = downloaded once
- Different emails = separate storage
- Trade-off between space and complexity

## Future Enhancements

Potential improvements:

- Global image deduplication
- Image optimization/compression
- Lazy loading for large archives
- CDN integration for exports
- Image thumbnails

## Examples

### Export All Emails with Images

```bash
# Get all email IDs with images
npm run images:stats

# Export each one
npm run export:email email-1 archive/email-1.html
npm run export:email email-2 archive/email-2.html
# ...
```

### Selective Image Archiving

```bash
# Only download images for published emails
# (Requires custom script - see sync.ts for examples)
```

### Check Archive Completeness

```bash
# See which emails have images
npm run images:stats

# See which emails don't
# (All emails - emails with images)
```
