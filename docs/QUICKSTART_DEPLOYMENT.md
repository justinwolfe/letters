# Quick Start: Static Site + PWA Deployment

Get your newsletter reader deployed with both static HTML pages and a PWA in minutes!

## Prerequisites

- Node.js 20+ installed
- Newsletter data synced (`npm run sync`)
- Git repository set up

## 5-Minute Setup

### Step 1: Create PWA Icons

Create a simple icon for your PWA. You can use an online tool or this quick method:

```bash
# Create a public directory if it doesn't exist
mkdir -p apps/reader/client/public

# Use ImageMagick or online tools to create icons
# For now, the build script creates placeholder SVG icons
```

**Recommended:** Use [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator):

```bash
npx pwa-asset-generator logo.png apps/reader/client/public --icon-only
```

### Step 2: Build Everything

```bash
# This generates static pages, builds PWA, and combines them
npm run build:deploy
```

You'll see output like:

```
✓ Generating static HTML pages...
✓ Building PWA React app...
✓ Combining static site and PWA for deployment...
✓ Build complete!
```

### Step 3: Verify the Build

Check the `public/` directory:

```bash
ls -la public/

# You should see:
# - index.html (homepage)
# - letters/ (individual letter pages)
# - app/ (PWA app)
# - manifest.json
# - sw.js
# - icons
```

### Step 4: Test Locally

```bash
npx http-server public -p 8080
```

Open http://localhost:8080 and test:

- ✅ Static homepage loads
- ✅ Click on a letter - opens individual page
- ✅ Click "Install App" or "Open App"
- ✅ PWA opens at /app/

### Step 5: Deploy to GitHub Pages

#### Option A: Automatic (Recommended)

1. Enable GitHub Pages:
   - Go to repository Settings → Pages
   - Source: "GitHub Actions"
2. Push to main:

   ```bash
   git add .
   git commit -m "Add static site + PWA"
   git push origin main
   ```

3. GitHub Actions automatically builds and deploys!

#### Option B: Manual

```bash
# Deploy the public directory
npx gh-pages -d public
```

### Step 6: Visit Your Site!

Your site is now live at:

- `https://yourusername.github.io/repository-name/`

Test both modes:

1. **Static pages:** Browse letters, click through them
2. **PWA app:** Click "Open App" → download for offline

## What You Get

### Static Site (Default)

- Fast loading pre-rendered HTML pages
- Each letter has its own URL
- Works without JavaScript
- SEO-friendly
- PWA install banner on each page

### PWA App (Optional Install)

- Single-page app at `/app/`
- Offline reading after download
- Installable as native app
- Full-text search
- Swipe navigation
- Random letter feature

## Using the App

### As a Reader

**Browse Static Pages:**

1. Visit your GitHub Pages URL
2. See all letters on homepage
3. Click any letter to read
4. Navigate with home/prev/next buttons

**Install PWA for Offline:**

1. Click "Install App" button
2. Follow browser's install prompt
3. Open installed app
4. Click "📥 Offline" button
5. Click "Download All Content"
6. Now works completely offline!

### As a Developer

**Add new content:**

```bash
# Sync new newsletters
npm run sync

# Rebuild and deploy
npm run build:deploy
git add public/
git commit -m "Update content"
git push
```

**Update PWA only:**

```bash
npm run reader:build
# Manual copy to public/app/
```

**Update static pages only:**

```bash
npm run build:static
# Manual copy to public/
```

## Common Issues

### Icons Not Showing

- Create real PNG icons in `apps/reader/client/public/`
- Sizes: 72, 96, 128, 144, 152, 192, 384, 512
- Use square images with padding

### PWA Not Installing

- Requires HTTPS (GitHub Pages has this)
- Check manifest.json is accessible
- Look for errors in browser console
- Try in Chrome/Edge (best PWA support)

### Content Not Updating

- Clear browser cache
- Check GitHub Actions ran successfully
- Verify build succeeded locally first

### Offline Mode Not Working

- Open the PWA app (not static pages)
- Click "Offline" button
- Click "Download All Content"
- Wait for download to complete
- Check IndexedDB in DevTools

## Next Steps

1. **Customize Appearance:**

   - Edit colors in `scripts/generate-static-site.ts`
   - Edit PWA styles in `apps/reader/client/src/App.css`

2. **Add Custom Domain:**

   ```bash
   npm run build:deploy -- --cname=letters.yourdomain.com
   ```

   Then configure DNS.

3. **Monitor Usage:**

   - Add analytics to templates
   - Track install rate
   - Monitor offline usage

4. **Optimize Performance:**
   - Compress images: `npm run images:compress`
   - Review cache strategies in `sw.js`
   - Test on slow connections

## Getting Help

- 📖 Full docs: `docs/STATIC_PWA_DEPLOYMENT.md`
- 🐛 Issues: Check GitHub Issues
- 💬 Questions: Open a discussion
- 🔍 Debugging: Check browser DevTools console

## Architecture

```
                     Your GitHub Pages Site
                              │
              ┌───────────────┼───────────────┐
              │                               │
         Static Pages                     PWA App
    (Multi-Page Application)    (Single-Page Application)
              │                               │
    ┌─────────┴─────────┐          ┌─────────┴─────────┐
    │                   │          │                   │
  Fast HTML         SEO OK      Offline            Native
  No JS needed     Shareable    Reading         App Experience
```

Users get the best of both worlds:

- Fast, simple static pages for casual browsing
- Powerful PWA for dedicated readers who want offline access

Enjoy your newsletter reader! 📚
