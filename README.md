# Letters - Buttondown Newsletter Sync + PWA Reader

A comprehensive TypeScript system for syncing newsletters from Buttondown and deploying them as both a static website and an installable Progressive Web App (PWA).

## ✨ Features

### 🌐 Unified Progressive Architecture

- **Static HTML Pages**: Pre-rendered pages for each newsletter - perfect for SEO, browsing, and instant loading
- **PWA Enhancement**: Installable React app provides rich features when desired - works as native app
- **Progressive Enhancement**: Static pages work for everyone; PWA enhances for those who want more
- **Single Service Worker**: Handles both static pages and PWA with intelligent caching
- **GitHub Pages Ready**: One-command deployment with automatic builds via GitHub Actions

### 📱 Progressive Web App Experience

- **Offline Reading**: Static pages and PWA both work offline after first visit
- **Installable**: PWA can be installed as native app on desktop and mobile
- **Service Worker**: Caches both static HTML and PWA assets for optimal performance
- **Seamless Switching**: Move between static pages and PWA effortlessly
- **Full-Text Search**: Advanced search in PWA experience
- **Swipe Navigation**: Mobile-friendly gesture controls in PWA

### 🔄 Sync System

- **Incremental Sync**: Only fetches new/modified content
- **Image Archiving**: Downloads and stores images locally
- **SQLite Storage**: All data in a single, portable database
- **Version Controlled**: Database checked into git for full history
- **Offline-First**: All newsletter content available locally

### 🎨 Beautiful UI

- **Dark Theme**: Easy on the eyes
- **Responsive Design**: Works great on all devices
- **Fast Loading**: Pre-rendered pages load instantly
- **Modern UX**: Smooth transitions and interactions

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Sync Your Newsletters

```bash
# Set up your Buttondown API key in .env
echo "BUTTONDOWN_API_KEY=your_key_here" > .env

# Sync newsletters
npm run sync
```

### Deploy to GitHub Pages

```bash
# Build both static site and PWA
npm run build:deploy

# Push to GitHub (automatic deployment via GitHub Actions)
git add .
git commit -m "Deploy newsletters"
git push origin main
```

That's it! Your site will be live at `https://yourusername.github.io/repository-name/`

📖 **[Quick Start Guide](docs/QUICKSTART_DEPLOYMENT.md)** - Get up and running in 5 minutes  
📖 **[Full Deployment Guide](docs/STATIC_PWA_DEPLOYMENT.md)** - Complete documentation

## 📖 Usage

### For Readers

**Browse Static Pages:**

1. Visit your GitHub Pages URL
2. Browse all newsletters on the homepage
3. Click any newsletter to read it
4. Each page loads instantly with pre-rendered HTML

**Install PWA for Offline:**

1. Click "Install App" or "Open App" button
2. Follow your browser's install prompt
3. Open the installed app
4. Click "Offline" → "Download All Content"
5. Read anywhere, even without internet!

### For Developers

**Local Development:**

```bash
# Run development environment
npm run dev
# Opens on http://localhost:5173 with hot reload
```

**Sync Commands:**

```bash
npm run sync              # Incremental sync
npm run sync -- --full    # Force full sync
npm run sync:status       # Check sync status
npm run images:download   # Download all images
npm run images:stats      # Image statistics
```

**Build Commands:**

```bash
npm run build:deploy       # Build everything for deployment
npm run build:static       # Generate static HTML pages only
npm run reader:build       # Build PWA only
```

## 📁 Project Structure

```
letters/
├── apps/
│   ├── reader/           # PWA React app
│   │   ├── client/       # Frontend (React + Vite)
│   │   │   ├── src/
│   │   │   │   ├── App.tsx              # Main React component
│   │   │   │   └── offlineStorage.ts    # IndexedDB manager
│   │   │   └── public/
│   │   │       ├── manifest.json        # PWA manifest
│   │   │       └── sw.js                # Service worker
│   │   └── server/       # Backend API (Express)
│   └── sync/             # Buttondown sync engine
├── lib/
│   ├── api/              # Buttondown API client
│   ├── db/               # Database schema & queries
│   └── utils/            # Utilities (logger, image processor, etc.)
├── scripts/
│   ├── generate-static-site.ts    # Static site generator
│   ├── build-deploy.ts            # Deployment build script
│   └── ...               # Other utilities
├── docs/                 # Documentation
│   ├── QUICKSTART_DEPLOYMENT.md       # Quick start guide
│   ├── STATIC_PWA_DEPLOYMENT.md       # Full documentation
│   └── ARCHITECTURE.md                # System architecture
├── .github/workflows/
│   └── deploy.yml        # GitHub Actions deployment workflow
├── public/               # Deployment output (git-ignored)
└── static-site/          # Generated static pages (git-ignored)
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file:

```bash
BUTTONDOWN_API_KEY=your_key_here
DATABASE_PATH=./data/newsletters.db
```

### PWA Customization

Edit `apps/reader/client/public/manifest.json` to customize:

- App name and description
- Theme colors
- Icons
- Display mode

### Static Site Customization

Edit `scripts/generate-static-site.ts` to customize:

- Page templates
- Styling and colors
- Meta tags
- Navigation

## 🎯 Requirements

- Node.js 20+
- npm or yarn
- Git (for deployment)
- Buttondown API key

## 🏗️ Architecture

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

- **Fast, simple static pages** for casual browsing
- **Powerful PWA** for dedicated readers who want offline access

## 🎨 Features in Detail

### Static Site Generator

- Generates individual HTML pages for each newsletter
- Pre-rendered for instant loading (no build step required for users)
- SEO-friendly with proper meta tags and structured data
- Dark theme with responsive design
- Navigation between newsletters (prev/next)
- PWA install prompts on each page

### PWA Features

- **Offline Mode**: Full app functionality without internet after initial download
- **Install Prompt**: Browser-native installation experience
- **Service Worker**: 3-tier caching strategy (static, data, images)
- **IndexedDB**: Stores newsletters, images, and metadata efficiently
- **Background Sync**: Automatic updates when back online
- **Search**: Full-text search across all newsletter content
- **Random**: Discover a random newsletter
- **Sort & Filter**: Multiple sorting and filtering options

### Sync Engine

- Incremental syncing (only new/updated content)
- Image downloading and local caching
- Markdown normalization for consistent rendering
- HTML-to-Markdown conversion
- Attachment handling and metadata tracking
- Robust error recovery and retry logic

## 🚀 Advanced Usage

### Custom Domain

```bash
npm run build:deploy -- --cname=letters.yourdomain.com
```

Then configure your DNS to point to GitHub Pages.

### Selective Build

```bash
# Skip static site generation
npm run build:deploy -- --no-static

# Skip PWA build
npm run build:deploy -- --no-pwa

# Don't clean build directories first
npm run build:deploy -- --no-clean
```

### Manual Deployment

```bash
# Build locally
npm run build:deploy

# Deploy with gh-pages
npx gh-pages -d public
```

## 📊 Performance

- **Static Pages**: ~10-50KB per page, loads in < 100ms
- **PWA Bundle**: Code-split and optimized, lazy-loaded chunks
- **Service Worker**: Aggressive caching, offline-first strategy
- **IndexedDB**: Handles thousands of newsletters efficiently
- **Images**: Lazy loaded, cached, and can be compressed

## 🌍 Browser Support

- **Chrome/Edge**: Full support (best PWA experience)
- **Firefox**: Full support
- **Safari**: Full support (iOS 11.3+ for PWA features)
- **Opera**: Full support

PWA features require modern browsers with service worker support.

## 🐛 Troubleshooting

### Icons Not Showing

- Create real PNG icons in `apps/reader/client/public/`
- Required sizes: 72, 96, 128, 144, 152, 192, 384, 512
- Use square images with appropriate padding

### PWA Not Installing

- Requires HTTPS (GitHub Pages provides this automatically)
- Check that manifest.json is accessible
- Look for errors in browser DevTools console
- Try in Chrome/Edge first (best PWA support)

### Content Not Updating

- Clear browser cache
- Check GitHub Actions workflow ran successfully
- Verify build succeeded locally first
- Check service worker update cycle

### Offline Mode Not Working

- Open the PWA app (not static pages)
- Click "Offline" button in the app
- Click "Download All Content"
- Wait for download to complete
- Verify IndexedDB data in DevTools

See the [full documentation](docs/STATIC_PWA_DEPLOYMENT.md) for more troubleshooting tips.

## 📚 Documentation

- **[QUICKSTART_DEPLOYMENT.md](docs/QUICKSTART_DEPLOYMENT.md)** - Get up and running quickly
- **[STATIC_PWA_DEPLOYMENT.md](docs/STATIC_PWA_DEPLOYMENT.md)** - Complete deployment guide
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design and architecture
- **[apps/\_template/README.md](apps/_template/README.md)** - Guide to creating new apps

## 🤝 Contributing

[Your contributing guidelines here]

## 📄 License

ISC

## 🙏 Acknowledgments

- Built for the [Buttondown](https://buttondown.email) newsletter platform
- Uses React, Vite, Better-SQLite3, Express, and more
- Deploys seamlessly to GitHub Pages
