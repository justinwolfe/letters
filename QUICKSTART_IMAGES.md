# Quick Start: Image Archiving

Ready to archive your email images? Here's how to get started in 3 simple steps.

## Step 1: Migrate Your Database

Since you already have a database with emails, first add the new `embedded_images` table:

```bash
npm run db:migrate
```

This will:

- Add the `embedded_images` table to your database
- Create necessary indexes
- Update your schema version to 2

**Output:**

```
Opening database: /Users/justinwolfe/Projects/letters/data/newsletters.db
Current schema version: 1
Migrating to schema version 2...
Migration to schema version 2 complete!
Database migration complete!
```

## Step 2: Download Images

Now download all embedded images from your existing emails:

```bash
npm run images:download
```

This will:

- Scan all emails in your database
- Extract image URLs from HTML
- Download each image from remote servers
- Store them as BLOBs in your SQLite database

**What to expect:**

- It may take a while depending on how many images you have
- You'll see progress for each email: `[1/50] Processing: Email Subject`
- Failed downloads will be logged but won't stop the process
- Images are stored efficiently in the database

**Output example:**

```
Downloading embedded images for existing emails...
Found 127 emails to process
[1/127] Processing: Welcome to my newsletter
  ✓ Downloaded 3 images for "Welcome to my newsletter"
[2/127] Processing: Week in Review
  ✓ Downloaded 5 images for "Week in Review"
...
Downloaded 234 images for 127 emails
```

## Step 3: Check Your Archive

See statistics about your embedded images:

```bash
npm run images:stats
```

**Output example:**

```
🖼️  Embedded Image Statistics

  Emails with embedded images:

  1. Welcome to my newsletter
     3 images, 0.45 MB

  2. Week in Review
     5 images, 1.23 MB

  Summary:
    Total emails with images: 127
    Total images: 234
    Total size: 45.67 MB
```

## Next Steps

### Export an Email

Export any email as a standalone HTML file with all images embedded:

```bash
npm run export:email <email-id> output.html
```

The exported HTML file will be completely self-contained - no external dependencies!

### Future Syncs

From now on, you can download images automatically during sync:

```bash
npm run sync -- --download-images
```

This will:

- Sync new emails from Buttondown
- Download their embedded images immediately
- Keep your archive complete

### View Your Archive

Your images are now stored in:

```
data/newsletters.db
```

This single SQLite file contains:

- All your emails
- All embedded images
- All metadata

You can:

- Back it up easily
- Version control it with git
- Move it to another computer
- Access it offline

## Troubleshooting

### "Some images failed to download"

This is normal. Some images may be:

- Deleted from the source
- Behind authentication
- From servers that are down

The system will log warnings but continue with other images.

### "Database is too large"

If your database gets very large:

- Check `npm run images:stats` to see size breakdown
- Consider selective archiving
- SQLite handles databases up to 1 GB efficiently

### Need More Help?

See the full documentation:

- [IMAGE_ARCHIVING.md](./IMAGE_ARCHIVING.md) - Detailed guide
- [README.md](./README.md) - Full project documentation

## Summary

```bash
# 1. Migrate database
npm run db:migrate

# 2. Download images
npm run images:download

# 3. Check stats
npm run images:stats

# 4. Export email (optional)
npm run export:email <email-id> output.html
```

That's it! Your emails are now fully archived with all images stored locally.
