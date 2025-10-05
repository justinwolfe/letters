# Bulk Image Operations Examples

With the reference-based image system, you can easily perform bulk operations on images as separate database entities. Here are some practical examples:

## Using the Database API

### Get All Images

```typescript
import { initializeDatabase } from './lib/db/schema.js';
import { DatabaseQueries } from './lib/db/queries.js';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

// Get all images
const allImages = queries.getAllEmbeddedImages();
console.log(`Total images: ${allImages.length}`);
```

### Find Large Images

```typescript
// Get images larger than 5MB
const largeImages = queries.getLargeImages(5000000);

console.log('Large images:');
largeImages.forEach((img) => {
  const sizeMB = (img.file_size / 1024 / 1024).toFixed(2);
  console.log(`- ${img.email_subject}: ${sizeMB} MB (ID: ${img.id})`);
});
```

### Find Images by Type

```typescript
// Get all GIF images
const gifs = queries.getImagesByType('image/gif');
console.log(`Total GIFs: ${gifs.length}`);

// Get all PNG images
const pngs = queries.getImagesByType('image/png');
console.log(`Total PNGs: ${pngs.length}`);
```

### Get Storage Statistics

```typescript
const storage = queries.getTotalImageStorage();
console.log(`Total images: ${storage.total_images}`);
console.log(`Total storage: ${storage.total_mb.toFixed(2)} MB`);
```

### Delete Specific Images

```typescript
// Delete an image by ID
queries.deleteEmbeddedImage(123);

// Note: You'll need to update the markdown to remove broken references
```

## Using Direct SQL Queries

### Find Duplicate Images (Same URL)

```bash
sqlite3 data/newsletters.db "
SELECT original_url, COUNT(*) as count
FROM embedded_images
GROUP BY original_url
HAVING count > 1
ORDER BY count DESC;
"
```

### Find Images by Dimensions

```bash
# Find very wide images (>2000px)
sqlite3 data/newsletters.db "
SELECT id, email_id, width, height, file_size
FROM embedded_images
WHERE width > 2000
ORDER BY width DESC;
"
```

### Find Recent Images

```bash
# Images downloaded in the last 7 days
sqlite3 data/newsletters.db "
SELECT id, email_id, mime_type, file_size, downloaded_at
FROM embedded_images
WHERE downloaded_at > datetime('now', '-7 days')
ORDER BY downloaded_at DESC;
"
```

### Count Images by Type

```bash
sqlite3 data/newsletters.db "
SELECT
  mime_type,
  COUNT(*) as count,
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as total_mb
FROM embedded_images
GROUP BY mime_type
ORDER BY total_mb DESC;
"
```

### Find Emails Without Images

```bash
sqlite3 data/newsletters.db "
SELECT id, subject
FROM emails
WHERE id NOT IN (SELECT DISTINCT email_id FROM embedded_images)
  AND status IN ('sent', 'imported')
ORDER BY publish_date DESC
LIMIT 10;
"
```

## Practical Use Cases

### 1. Clean Up Large Images

If your database is getting too large, you can identify and handle large images:

```typescript
// Find images over 5MB
const largeImages = queries.getLargeImages(5000000);

console.log('Consider optimizing or removing these large images:');
largeImages.forEach((img) => {
  const sizeMB = (img.file_size / 1024 / 1024).toFixed(2);
  console.log(`${img.email_subject}: ${sizeMB} MB`);
  console.log(`  URL: ${img.original_url}`);
  console.log(`  Image ID: ${img.id}`);
  console.log('');
});
```

### 2. Export Images

Export all images from a specific email:

```bash
# Create export directory
mkdir -p exported_images

# Export using Node
cat > export-images.js << 'EOF'
import { initializeDatabase } from './lib/db/schema.js';
import { DatabaseQueries } from './lib/db/queries.js';
import { writeFileSync } from 'fs';

const db = initializeDatabase();
const queries = new DatabaseQueries(db);

const emailId = 'your-email-id-here';
const images = queries.getEmbeddedImages(emailId);

images.forEach((img, index) => {
  const ext = img.mime_type.split('/')[1];
  const filename = `exported_images/${emailId}_${index}.${ext}`;
  writeFileSync(filename, img.image_data);
  console.log(`Exported: ${filename}`);
});

db.close();
EOF

node export-images.js
```

### 3. Analyze Image Usage

```typescript
// See which emails have the most images
const stats = queries.getEmailsWithImageStats();

console.log('Top 10 emails by image count:');
stats.slice(0, 10).forEach((stat, i) => {
  console.log(`${i + 1}. ${stat.subject}: ${stat.image_count} images`);
});
```

### 4. Convert Image Formats

You could write a script to convert all images to WebP for better compression:

```typescript
// Pseudo-code example
import sharp from 'sharp';

const images = queries.getAllEmbeddedImages();

for (const img of images) {
  if (img.mime_type !== 'image/webp') {
    // Convert to WebP
    const webpData = await sharp(img.image_data)
      .webp({ quality: 80 })
      .toBuffer();

    // Update database with new data
    // (You'd need to add a method to update image data)
    console.log(`Converted image ${img.id} to WebP`);
  }
}
```

### 5. Find Orphaned Images

Images that aren't referenced in any markdown:

```bash
sqlite3 data/newsletters.db "
SELECT
  ei.id,
  ei.email_id,
  e.subject,
  ei.file_size
FROM embedded_images ei
JOIN emails e ON ei.email_id = e.id
WHERE e.normalized_markdown NOT LIKE '%/api/images/' || ei.id || '%'
ORDER BY ei.file_size DESC;
"
```

### 6. Calculate Storage Savings

Compare storage before/after localization:

```bash
# Check current database size
ls -lh data/newsletters.db

# Count total image storage
sqlite3 data/newsletters.db "
SELECT
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as images_mb
FROM embedded_images;
"

# With data URIs, the markdown would be ~33% larger due to base64
# With references, markdown just has simple /api/images/{id} strings
```

### 7. Backup Images Separately

```bash
# Export all images to a separate file
sqlite3 data/newsletters.db ".dump embedded_images" > images_backup.sql

# Or export as JSON
sqlite3 -json data/newsletters.db "
SELECT id, email_id, original_url, mime_type, file_size
FROM embedded_images;
" > images_manifest.json
```

## Advanced Queries

### Images Per Email Distribution

```bash
sqlite3 data/newsletters.db "
SELECT
  image_count,
  COUNT(*) as email_count
FROM (
  SELECT email_id, COUNT(*) as image_count
  FROM embedded_images
  GROUP BY email_id
)
GROUP BY image_count
ORDER BY image_count;
"
```

### Average Image Size by Type

```bash
sqlite3 data/newsletters.db "
SELECT
  mime_type,
  COUNT(*) as count,
  ROUND(AVG(file_size) / 1024.0, 2) as avg_kb,
  ROUND(MIN(file_size) / 1024.0, 2) as min_kb,
  ROUND(MAX(file_size) / 1024.0, 2) as max_kb
FROM embedded_images
GROUP BY mime_type;
"
```

### Timeline of Image Downloads

```bash
sqlite3 data/newsletters.db "
SELECT
  DATE(downloaded_at) as date,
  COUNT(*) as images_downloaded,
  ROUND(SUM(file_size) / 1024.0 / 1024.0, 2) as total_mb
FROM embedded_images
GROUP BY DATE(downloaded_at)
ORDER BY date DESC
LIMIT 30;
"
```

## Benefits Demonstrated

These examples showcase the key advantages of the reference-based system:

1. **Queryability** - Images are first-class database entities
2. **Bulk Operations** - Easy to process multiple images at once
3. **Analytics** - Can analyze image usage patterns
4. **Maintenance** - Can identify and fix issues systematically
5. **Flexibility** - Can export, convert, or optimize images independently
6. **Efficiency** - Markdown stays clean and readable

All of this would be nearly impossible with data URIs embedded in the markdown!
