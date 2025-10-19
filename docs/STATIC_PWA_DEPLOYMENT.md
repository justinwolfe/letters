# Static Site + PWA Deployment Guide

This guide explains the dual deployment architecture for the newsletter reader: static HTML pages for browsing and a Progressive Web App (PWA) for offline reading.

## Architecture Overview

The system consists of two main components:

1. **Static Site (MPA)** - Multi-page application with individual HTML pages for each newsletter
2. **PWA Reader** - Single-page React app with offline capabilities and installable as a native app

Both are deployed together on GitHub Pages, allowing users to browse the static pages and optionally install the PWA for offline access.

## Directory Structure

```
public/                     # Deployment directory for GitHub Pages
├── index.html             # Static site homepage (list of all letters)
├── letters/               # Individual letter pages
│   ├── letter-1.html
│   ├── letter-2.html
│   └── ...
├── app/                   # PWA React app
│   ├── index.html
│   ├── assets/
│   └── ...
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker
├── icon-*.png             # App icons
├── .nojekyll              # Disable Jekyll processing
└── CNAME                  # Custom domain (optional)
```

## Features

### Static Site Features

- ✅ Fast page loads with pre-rendered HTML
- ✅ SEO-friendly individual pages
- ✅ Works without JavaScript
- ✅ Direct links to individual newsletters
- ✅ Beautiful dark theme UI
- ✅ Navigation between letters
- ✅ PWA install prompt on each page

### PWA Features

- ✅ Offline reading with IndexedDB
- ✅ Installable as native app
- ✅ Service worker caching
- ✅ Full-text search
- ✅ Swipe navigation on mobile
- ✅ Sorting and filtering
- ✅ Random letter feature
- ✅ Sync status and management
- ✅ Works completely offline after download

## Setup Instructions

### 1. Initial Setup

Ensure you have all dependencies installed:

```bash
npm install
```

### 2. Generate Content

First, sync your newsletter content:

```bash
npm run sync
```

### 3. Create PWA Icons

Create the following icon files in `apps/reader/client/public/`:

- `icon-72.png` (72×72)
- `icon-96.png` (96×96)
- `icon-128.png` (128×128)
- `icon-144.png` (144×144)
- `icon-152.png` (152×152)
- `icon-192.png` (192×192) - Main icon
- `icon-384.png` (384×384)
- `icon-512.png` (512×512) - Main icon

Optional screenshots for install prompt:

- `screenshot-mobile.png` (540×720)
- `screenshot-desktop.png` (1280×720)

You can use tools like:

- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [Real Favicon Generator](https://realfavicongenerator.net/)

### 4. Build for Deployment

Build both the static site and PWA:

```bash
npm run build:deploy
```

This will:

1. Generate static HTML pages for all newsletters
2. Build the React PWA app
3. Combine both into the `public/` directory
4. Copy necessary assets (manifest, service worker, icons)
5. Create `.nojekyll` and `404.html`

### 5. Deploy to GitHub Pages

#### Option A: GitHub Actions (Recommended)

The repository includes a GitHub Actions workflow that automatically builds and deploys on push to `main`.

1. Enable GitHub Pages in your repository settings
2. Set source to "GitHub Actions"
3. Push to main branch - deployment happens automatically

#### Option B: Manual Deployment

```bash
# Build everything
npm run build:deploy

# Commit and push the public directory
git add public/
git commit -m "Deploy to GitHub Pages"
git push origin main

# Or use gh-pages branch
npx gh-pages -d public
```

### 6. Custom Domain (Optional)

To use a custom domain:

```bash
# Build with CNAME file
npm run build:deploy -- --cname=letters.yourdomain.com
```

Then configure your DNS:

- Add a CNAME record pointing to `yourusername.github.io`
- Or for apex domain, add A records to GitHub Pages IPs

## Usage

### For End Users

**Browsing Static Pages:**

1. Visit your GitHub Pages URL
2. Click on any letter to read it
3. Navigate using the home button or prev/next links
4. Each page loads instantly with pre-rendered HTML

**Installing the PWA:**

1. Click "Install App" or "Open App" banner on any static page
2. Or visit `/app/` directly
3. Browser will show install prompt
4. Once installed, works like a native app

**Offline Reading:**

1. Open the PWA app
2. Click the "📥 Offline" button
3. Click "⬇️ Download All Content"
4. Wait for download to complete
5. Now all letters work offline!

### For Developers

**Local Development:**

```bash
# Run full development environment
npm run dev

# This starts:
# - Backend server on port 3000
# - Vite dev server on port 5173
# - Hot module replacement
```

**Build Commands:**

```bash
# Generate only static site
npm run build:static

# Build only PWA
npm run reader:build

# Build everything for deployment
npm run build:deploy

# Build with custom domain
npm run build:deploy -- --cname=yourdomain.com

# Skip certain steps
npm run build:deploy -- --no-static    # Skip static generation
npm run build:deploy -- --no-pwa       # Skip PWA build
npm run build:deploy -- --no-clean     # Don't clean first
```

## PWA Configuration

### Manifest (`manifest.json`)

The PWA manifest defines how the app appears when installed:

```json
{
  "name": "Thank You Notes",
  "short_name": "Thank You",
  "start_url": "/app/",
  "display": "standalone",
  "theme_color": "#1a1a1a",
  "background_color": "#1a1a1a"
}
```

### Service Worker (`sw.js`)

The service worker provides offline functionality with three caching strategies:

1. **Static Assets** - Cache first, update in background
2. **API Requests** - Network first, fallback to cache
3. **Images** - Cache first for faster loads

### Offline Storage (`IndexedDB`)

The app uses IndexedDB to store:

- All newsletter content
- Email metadata
- Downloaded images
- Sync status

Users can download all content for complete offline access.

## File Size Considerations

- Static HTML pages are small (~10-50KB each)
- PWA app bundle is optimized and code-split
- Service worker caches intelligently
- IndexedDB can store large amounts of data
- Images are cached on-demand

Monitor your repo size and consider:

- Compressing images before sync
- Using image CDN for large files
- Implementing lazy loading

## Testing

### Test Static Site Locally

```bash
# Build static site
npm run build:static

# Serve with a simple HTTP server
npx http-server static-site -p 8080
```

### Test PWA Locally

```bash
# Build PWA
npm run reader:build

# Serve the dist directory
cd apps/reader/client
npx http-server dist -p 8081
```

### Test Full Deployment Locally

```bash
# Build everything
npm run build:deploy

# Serve public directory
npx http-server public -p 8082
```

### Test PWA Features

1. **Offline Mode:**

   - Open DevTools > Application > Service Workers
   - Check "Offline" and reload
   - Verify app still works

2. **Install Prompt:**

   - Open in Chrome/Edge
   - Look for install icon in address bar
   - Click to install

3. **Cache Storage:**

   - Open DevTools > Application > Cache Storage
   - Verify static, data, and image caches

4. **IndexedDB:**
   - Open DevTools > Application > IndexedDB
   - Check `thankYouNotesDB` database
   - Verify emails and images are stored

## Troubleshooting

### Static pages not showing

- Check `static-site/` directory was created
- Verify database has emails: `npm run sync:status`
- Check build logs for errors

### PWA not installing

- HTTPS is required (GitHub Pages provides this)
- Check manifest.json is accessible
- Verify service worker registered successfully
- Check browser console for errors

### Offline mode not working

- Ensure service worker is registered
- Check cache storage in DevTools
- Verify IndexedDB has data
- Try clearing cache and re-downloading

### Images not loading offline

- Download content using "Offline" panel
- Check image URLs are relative or cached
- Verify images are in IndexedDB

### GitHub Pages not updating

- Check GitHub Actions workflow status
- Verify Pages is enabled in settings
- Check `.nojekyll` file exists
- Clear your browser cache

## Advanced Configuration

### Customize Static Site Theme

Edit styles in `scripts/generate-static-site.ts`:

```typescript
const generateBaseTemplate = (title, content, description) => {
  return `...
  <style>
    :root {
      --primary-bg: #1a1a1a;      /* Change colors */
      --accent: #61dafb;           /* Accent color */
      --max-width: 800px;          /* Content width */
    }
  </style>
  ...`;
};
```

### Customize PWA Appearance

Edit `apps/reader/client/src/App.css` for React app styles.

Edit `public/manifest.json` for install appearance.

### Add Analytics

Add your analytics code to both:

- Static site template in `generate-static-site.ts`
- PWA `index.html` in `apps/reader/client/`

### Configure Caching Strategy

Edit `sw.js` to customize:

- Cache names and versions
- What gets cached on install
- Caching strategies per request type
- Cache expiration policies

## Best Practices

1. **Keep static pages lightweight** - Don't inline large images
2. **Version your service worker** - Update CACHE_VERSION when deploying
3. **Test offline functionality** - Before each release
4. **Monitor cache size** - Especially for large image collections
5. **Provide clear install prompts** - Make it obvious users can install
6. **Handle errors gracefully** - Both online and offline scenarios
7. **Update regularly** - Sync new content and rebuild

## Security Considerations

- Service workers require HTTPS (free with GitHub Pages)
- No sensitive data in static pages (public content)
- IndexedDB is client-side only (no server sync required)
- Content Security Policy if needed

## Performance Optimization

1. **Static pages load instantly** - Pre-rendered HTML
2. **PWA uses code splitting** - Smaller initial load
3. **Service worker caches aggressively** - Fast repeat visits
4. **IndexedDB for bulk storage** - Better than localStorage
5. **Lazy load images** - Only when needed
6. **Compress images** - Use `npm run images:compress`

## Future Enhancements

Possible improvements:

- [ ] Add search to static pages (using JSON index + client-side JS)
- [ ] Generate RSS feed from static content
- [ ] Add dark/light theme toggle
- [ ] Implement reading progress tracking
- [ ] Add sharing functionality
- [ ] Create native mobile apps using Capacitor
- [ ] Add push notifications for new content
- [ ] Implement background sync

## Support

For issues or questions:

1. Check GitHub Issues
2. Review this documentation
3. Test locally first
4. Check browser console for errors
5. Verify service worker status

## License

[Your License Here]
