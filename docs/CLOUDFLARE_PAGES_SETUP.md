# Cloudflare Pages Deployment Guide

This guide walks you through deploying the Letters newsletter reader to Cloudflare Pages.

## Overview

The Letters app has been migrated from GitHub Pages to Cloudflare Pages with the following improvements:

- **No more base path**: App deploys to root `/` instead of `/letters`
- **Build on-demand**: Static site and SPA are built during Cloudflare's build process (no longer committed to git)
- **Smaller repository**: Removed ~162MB of build artifacts from source control
- **Git LFS support**: SQLite database remains accessible during build via Git LFS
- **Better performance**: Cloudflare's global CDN with optimized caching headers

## Prerequisites

1. A Cloudflare account (free tier works)
2. Your repository pushed to GitHub/GitLab/Bitbucket
3. Git LFS configured (already done - `data/newsletters.db` is tracked with LFS)

## Initial Setup

### 1. Commit Your Changes

First, commit the Cloudflare migration changes:

```bash
# Stage all modified files
git add .

# Commit the changes
git commit -m "Migrate from GitHub Pages to Cloudflare Pages

- Remove /letters base path, deploy to root
- Add public/ to .gitignore (build on-demand)
- Add Cloudflare Pages configuration
- Update build scripts for Cloudflare
- Remove 162MB of build artifacts from repository

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to your repository
git push origin main
```

### 2. Create Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** > **Pages**
3. Click **Create a project** > **Connect to Git**
4. Select your repository (authorize if needed)
5. Click **Begin setup**

### 3. Configure Build Settings

On the setup page, configure the following:

#### Project Configuration

- **Project name**: `letters` (or your preferred name)
- **Production branch**: `main`

#### Build Settings

- **Framework preset**: `None` (or select "Static Site")
- **Build command**: `npm run build:deploy`
- **Build output directory**: `public`

#### Environment Variables

- **Node version**: Add environment variable
  - Variable name: `NODE_VERSION`
  - Value: `20` (or latest LTS)

No other environment variables are required for basic deployment. If you want to sync newsletters during build, you can add:
- `BUTTONDOWN_API_KEY`: Your Buttondown API key (optional)

#### Git LFS

Cloudflare Pages automatically supports Git LFS. Your `data/newsletters.db` file (112MB) will be pulled during the build process.

### 4. Deploy

1. Click **Save and Deploy**
2. Cloudflare will clone your repository, pull LFS files, and run the build
3. First build takes ~2-3 minutes
4. Once complete, your site will be live at `<your-project>.pages.dev`

## Custom Domain Setup (Optional)

To use a custom domain:

1. Go to your Pages project
2. Click **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `letters.example.com`)
5. Follow the DNS configuration instructions
6. Cloudflare will automatically provision SSL certificate

## Build Process Details

### What Happens During Build

When Cloudflare Pages builds your site, it:

1. **Clones repository** with Git LFS support
2. **Pulls database** from LFS (`data/newsletters.db` - 112MB)
3. **Installs dependencies**: `npm ci`
4. **Compiles TypeScript**: `npm run build`
5. **Runs build script**: `npm run build:deploy`
   - Localizes images from database
   - Generates 1,836 static HTML pages
   - Exports 606 images from database
   - Creates JSON API for PWA (15MB)
   - Builds React PWA with Vite
   - Combines everything into `public/`
   - Creates `_headers` file for caching rules
6. **Deploys** the `public/` directory to Cloudflare's CDN

Total build time: ~2-3 minutes

### Build Output Structure

```
public/
├── index.html              # Main index page
├── 404.html               # 404 redirect page
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker
├── _headers               # Cloudflare caching rules
├── .nojekyll              # (ignored by Cloudflare)
├── app/                   # React PWA
│   ├── index.html
│   └── assets/
├── letters/               # Static letter pages (1,836 files)
│   ├── letter-slug-1.html
│   ├── letter-slug-2.html
│   └── ...
├── images/                # Exported images (606 files)
│   ├── 1.jpg
│   ├── 2.png
│   └── ...
└── api/                   # JSON API
    ├── emails.json        # Letter index (390KB)
    ├── emails-full.json   # Full content (15MB)
    └── emails/            # Individual letter JSON
```

## Caching Strategy

The `_headers` file configures Cloudflare's caching:

- **Images**: 1 year immutable cache
- **PWA assets**: 1 year immutable cache
- **Service Worker**: No cache (must check for updates)
- **Manifest**: 1 day cache
- **API data**: 1 hour cache
- **HTML pages**: 1 hour cache with revalidation

## Continuous Deployment

Cloudflare Pages automatically rebuilds when you push to your production branch:

1. Push changes to `main`: `git push origin main`
2. Cloudflare detects the push
3. Automatically triggers a new build
4. Deploys to production when build succeeds

### Preview Deployments

Every branch and pull request gets a preview deployment:

- **Branch previews**: `https://<branch>.<project>.pages.dev`
- **PR previews**: Automatically commented on PR with preview URL

## Troubleshooting

### Build Fails: "Git LFS objects not found"

**Solution**: Ensure Git LFS is properly configured:

```bash
# Install Git LFS
git lfs install

# Track the database file
git lfs track "data/newsletters.db"

# Verify it's tracked
git lfs ls-files

# Push LFS objects
git lfs push --all origin main
```

### Build Fails: "Out of memory"

The build generates a large static site (~162MB). If you encounter memory issues:

1. Contact Cloudflare support to request increased build memory
2. Or, reduce the number of emails/images being processed

### Images Not Loading

If images don't load:

1. Check that `data/newsletters.db` was pulled (Git LFS)
2. Verify images are exported during build (check build logs)
3. Check browser console for 404 errors

### PWA Not Installing

If the PWA doesn't offer installation:

1. Ensure HTTPS is enabled (automatic on Cloudflare)
2. Check that `manifest.json` and `sw.js` are in root
3. Verify service worker is registered (check DevTools > Application)

## Migration from GitHub Pages

### Removing Old Deployment

To completely remove GitHub Pages deployment:

1. Delete `.github/workflows/deploy.yml`
2. Go to repository Settings > Pages
3. Disable GitHub Pages

### Updating Links

If you shared links with the `/letters` base path, they will break. You can:

1. Set up redirects in Cloudflare
2. Update any hardcoded links
3. Use the share feature in the PWA (generates correct URLs)

## Monitoring and Analytics

### Build Logs

View build logs in Cloudflare Dashboard:
1. Go to your Pages project
2. Click **Deployments**
3. Click any deployment to see logs

### Traffic Analytics

Cloudflare Pages includes basic analytics:
1. Go to your Pages project
2. Click **Analytics**
3. View requests, bandwidth, and cache hit rates

### Error Tracking

To track JavaScript errors in the PWA, consider integrating:
- Sentry
- LogRocket
- Cloudflare Web Analytics (privacy-friendly)

## Advanced Configuration

### Custom Build Commands

You can customize the build process by modifying `scripts/build-deploy.ts`:

- Skip static site generation: `--no-static`
- Skip PWA build: `--no-pwa`
- Add custom domain to CNAME: `--cname=letters.example.com`

### Environment-Specific Builds

Set different behavior for production vs. preview:

```bash
# In package.json or build script
if [ "$CF_PAGES_BRANCH" = "main" ]; then
  npm run build:deploy
else
  npm run build:deploy --no-images  # Faster preview builds
fi
```

### Webhook Notifications

Set up build notifications:
1. Go to project settings
2. Click **Notifications**
3. Add webhook URL (Slack, Discord, etc.)

## Database Updates

To update the newsletter database:

1. Run sync locally: `npm run sync`
2. Commit the updated database: `git add data/newsletters.db`
3. Push: `git push origin main`
4. Cloudflare automatically rebuilds with new data

## Cost Considerations

Cloudflare Pages free tier includes:

- Unlimited bandwidth
- Unlimited requests
- 500 builds per month (1 build per push)
- 100 custom domains

This is more than sufficient for most personal projects. If you exceed limits, Pro plan is $20/month.

## Support

If you encounter issues:

1. Check Cloudflare's [Pages documentation](https://developers.cloudflare.com/pages/)
2. Review build logs in the dashboard
3. Contact Cloudflare support (available on free tier)
4. Open an issue in this repository

## Summary

You've successfully migrated from GitHub Pages to Cloudflare Pages! Your app now:

- Deploys to root URL (no `/letters` prefix)
- Builds on-demand (cleaner repository)
- Benefits from Cloudflare's global CDN
- Has automatic HTTPS and preview deployments
- Keeps your existing SQLite database architecture

Enjoy your faster, more efficient deployment!
