# Shared Styling System

This document explains how the shared styling system works for the Letters project, ensuring consistency between the static site and PWA versions.

## Overview

Both the static site and PWA (Progressive Web App) versions of Letters now use a unified styling system through a shared CSS file. This ensures a consistent look and feel across both deployment methods.

## Architecture

### Shared Styles File

**Location**: `lib/utils/shared-styles.css`

This file contains all the CSS styles used by both versions of the site, including:

- Base reset and layout styles
- Typography and font definitions
- Component styles (cards, buttons, navigation, etc.)
- Email/letter reader styles
- Responsive design media queries
- Offline/PWA UI components

### PWA Integration

**Location**: `apps/reader/client/src/App.css`

The PWA imports the shared styles via CSS import:

```css
@import '../../../../lib/utils/shared-styles.css';
```

During the Vite build process, this import is resolved and the shared styles are bundled into the final CSS output.

### Static Site Integration

**Location**: `scripts/generate-static-site.ts`

The static site generator:

1. Reads the shared styles file at build time
2. Inlines the CSS directly into each generated HTML page's `<style>` tag
3. Adds any static-site-specific adjustments (e.g., body padding)

## Current Theme

Both versions now use a **light theme**:

- Background: `#f5f5f5` (light gray)
- Text: `#333` (dark gray)
- Cards: White (`#ffffff`)
- Primary accent: `#007bff` (blue)
- Success: `#28a745` (green)
- Danger: `#dc3545` (red)

## Making Style Changes

To modify styles for both versions:

1. **Edit the shared file**: `lib/utils/shared-styles.css`
2. **Rebuild both versions**:

   ```bash
   # Rebuild PWA
   npm run reader:build

   # Rebuild static site
   npm run build:static
   ```

### Adding Version-Specific Styles

If you need styles that only apply to one version:

**For PWA only**: Add styles to `apps/reader/client/src/App.css` after the import statement

**For static site only**: Modify the `generateBaseTemplate()` function in `scripts/generate-static-site.ts` to add inline styles

## Files Affected

- `lib/utils/shared-styles.css` - Shared styles source
- `apps/reader/client/src/App.css` - PWA styles (imports shared)
- `scripts/generate-static-site.ts` - Static site generator (inlines shared)
- `apps/reader/client/dist/` - PWA build output
- `public/` - Static site build output

## Testing Changes

After modifying styles:

1. **Test PWA locally**:

   ```bash
   npm run reader:dev
   # Visit http://localhost:5173
   ```

2. **Test static site**:

   ```bash
   npm run build:static
   # Open public/index.html in browser
   ```

3. **Test PWA production build**:
   ```bash
   npm run reader:build
   # Check apps/reader/client/dist/
   ```

## Benefits

1. **Consistency**: Both versions look and feel identical
2. **Maintainability**: Style changes only need to be made in one place
3. **Reduced duplication**: No need to maintain two separate stylesheets
4. **Single source of truth**: All styling decisions are centralized

## Migration Notes

Previously:

- Static site used a dark theme (`#1a1a1a` background)
- PWA used a light theme (`#f5f5f5` background)
- Styles were duplicated in two places

After migration:

- Both versions use the light theme
- Styles are defined once in `shared-styles.css`
- Theme color updated from `#1a1a1a` to `#007bff`
