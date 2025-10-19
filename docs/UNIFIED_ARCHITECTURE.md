# Unified PWA + Static Site Architecture

## Overview

The site now operates as a unified experience where the static HTML pages (SSG) and the Progressive Web App (PWA) coexist seamlessly. Users can access static pages directly or use the enhanced PWA experience when installed.

## Architecture

### URL Structure

```
/letters/                    → Static site index (SSG)
/letters/letters/*.html      → Individual letter pages (SSG)
/letters/app/                → PWA reader app (SPA)
/letters/api/*.json          → Static JSON API for PWA
/letters/images/*.{jpg,png}  → Shared images
/letters/manifest.json       → Shared PWA manifest
/letters/sw.js               → Unified service worker
```

### Progressive Enhancement Strategy

1. **Static HTML First**: All content is available as static HTML pages

   - Works without JavaScript
   - Great for SEO and accessibility
   - Fast initial load times

2. **PWA Enhancement**: Users can install the PWA for enhanced features

   - Offline reading
   - App-like experience
   - Advanced search and sorting
   - Progress tracking

3. **Shared Service Worker**: A single service worker handles both
   - Caches static HTML pages for offline viewing
   - Caches PWA assets and JSON API
   - Handles images efficiently
   - Works seamlessly across both experiences

## User Flows

### New User (Static Site)

1. Visit `/letters/` → See static HTML index
2. Click a letter → Navigate to static HTML page
3. See PWA banner → "Install App" or "Open App"
4. Can continue browsing static pages indefinitely

### PWA User

1. Install PWA from static pages or directly
2. Launch PWA → Rich app experience at `/letters/app/`
3. Full offline support with cached content
4. Can still access static pages if desired

### Hybrid User

1. Browse static pages normally
2. Service worker caches pages in background
3. Pages work offline automatically
4. Can switch to PWA experience anytime

## Technical Details

### Service Worker Scope

- **Scope**: `/letters/`
- **Caches**:
  - Static HTML pages (`/letters/letters/*.html`)
  - PWA assets (`/letters/app/*`)
  - JSON API (`/letters/api/*.json`)
  - Images (`/letters/images/*`)

### Caching Strategy

**Static HTML Pages**: Cache-first with background update

- Return cached version immediately
- Update cache in background
- Ensures offline access to visited pages

**PWA Assets**: Cache-first with background update

- App shell cached on install
- Updates applied on next visit

**JSON API**: Cache-first with background update

- Stale-while-revalidate pattern
- Always functional offline once cached

**Images**: Cache-first

- Cached on first load
- Persistent for offline use

## Build Process

### 1. Generate Static Site

```bash
npm run build:static
```

- Generates HTML pages to `/public/letters/`
- Exports images to `/public/images/`
- Creates JSON API in `/public/api/`
- Outputs directly to `/public/`

### 2. Build PWA

```bash
npm run reader:build
```

- Builds React app to `apps/reader/client/dist/`
- Optimized for production

### 3. Combine for Deployment

```bash
npm run build:deploy
```

- Copies PWA assets to `/public/app/`
- Ensures manifest and service worker are in root
- Creates deployment package in `/public/`

## Benefits

1. **Progressive Enhancement**: Works for everyone, enhanced for some
2. **Offline-First**: Both static pages and PWA work offline
3. **Performance**: Static pages load instantly, PWA provides rich features
4. **SEO**: Static HTML ensures good search engine visibility
5. **Installability**: PWA can be installed as a native-like app
6. **Unified Codebase**: One build process, one deployment

## User Experience

### Banner Behavior

- Shows on static pages for PWA-capable browsers
- Offers two options:
  - **Install App**: Triggers PWA install prompt
  - **Open App**: Navigates to `/letters/app/`
- Hidden after installation or dismissal

### Navigation

- Static pages link to other static pages (standard navigation)
- PWA handles routing internally (SPA navigation)
- Users can switch between experiences seamlessly

## Future Enhancements

1. **Smart Redirects**: Detect installed PWA and offer to switch to app experience
2. **Offline Indicator**: Show offline status and cached content availability
3. **Background Sync**: Sync read status and preferences across devices
4. **Push Notifications**: Notify users of new letters (if desired)

## Files Modified

### Core Files

- `/public/sw.js` - Unified service worker
- `/public/manifest.json` - Shared PWA manifest
- `/scripts/generate-static-site.ts` - Now outputs to `/public/`
- `/scripts/build-deploy.ts` - Updated for new structure

### PWA Files

- `/apps/reader/client/public/sw.js` - Updated service worker
- `/apps/reader/client/vite.config.ts` - Build config (no changes needed)

## Testing

### Static Site

1. Visit `/letters/` without PWA installed
2. Navigate between letters
3. Check PWA banner appears
4. Verify offline access to visited pages

### PWA

1. Install PWA from static pages
2. Launch from home screen
3. Verify full app functionality
4. Test offline mode

### Service Worker

1. Check console for SW registration
2. Verify caching in DevTools → Application → Cache Storage
3. Test offline mode in both static and PWA views
