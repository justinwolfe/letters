#!/usr/bin/env tsx
/**
 * Build and Deploy Script
 *
 * Builds both the static site and PWA app for GitHub Pages deployment.
 */

import { execSync } from 'child_process';
import { mkdir, writeFile, copyFile, readdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { logger } from '../lib/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..');
const STATIC_SITE_DIR = join(ROOT_DIR, 'static-site');
const READER_CLIENT_DIR = join(ROOT_DIR, 'apps/reader/client');
const DIST_DIR = join(READER_CLIENT_DIR, 'dist');
const PUBLIC_DIR = join(ROOT_DIR, 'public');

interface BuildOptions {
  cleanFirst?: boolean;
  generateStatic?: boolean;
  buildPWA?: boolean;
  createCNAME?: string;
}

/**
 * Clean build directories
 */
async function clean() {
  logger.info('Cleaning build directories...');

  const dirsToClean = [STATIC_SITE_DIR, PUBLIC_DIR, DIST_DIR];

  for (const dir of dirsToClean) {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
      logger.debug(`Removed ${dir}`);
    }
  }

  logger.success('Clean complete');
}

/**
 * Generate static HTML pages
 */
async function generateStaticSite() {
  logger.info('Generating static HTML pages...');

  try {
    execSync('tsx scripts/generate-static-site.ts', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    logger.success('Static site generated');
  } catch (error) {
    logger.error('Failed to generate static site:', error);
    throw error;
  }
}

/**
 * Build PWA React app
 */
async function buildPWA() {
  logger.info('Building PWA React app...');

  try {
    execSync('npm run reader:build', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    logger.success('PWA app built');
  } catch (error) {
    logger.error('Failed to build PWA:', error);
    throw error;
  }
}

/**
 * Create placeholder icon files for development
 */
async function createPlaceholderIcons() {
  logger.info('Creating placeholder icons...');

  const publicDir = join(READER_CLIENT_DIR, 'public');
  if (!existsSync(publicDir)) {
    await mkdir(publicDir, { recursive: true });
  }

  // Create a simple SVG icon that can be used as placeholder
  const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#007bff"/>
  <text x="256" y="280" font-family="Arial, sans-serif" font-size="200" fill="white" text-anchor="middle" font-weight="bold">TY</text>
</svg>`;

  // For now, just create the SVG - in production you'd want real PNG icons
  await writeFile(join(publicDir, 'icon.svg'), svgIcon);

  logger.info(
    'Note: Placeholder icons created. For production, create proper PNG icons at:'
  );
  logger.info('  - icon-72.png, icon-96.png, icon-128.png, icon-144.png');
  logger.info('  - icon-152.png, icon-192.png, icon-384.png, icon-512.png');
  logger.info('  - screenshot-mobile.png (540x720)');
  logger.info('  - screenshot-desktop.png (1280x720)');
}

/**
 * Combine static site and PWA into public directory
 */
async function combineForDeployment(cname?: string) {
  logger.info('Combining static site and PWA for deployment...');

  // Create public directory
  if (!existsSync(PUBLIC_DIR)) {
    await mkdir(PUBLIC_DIR, { recursive: true });
  }

  // Copy static site to root
  if (existsSync(STATIC_SITE_DIR)) {
    logger.info('Copying static HTML pages...');
    execSync(`cp -R ${STATIC_SITE_DIR}/* ${PUBLIC_DIR}/`, {
      shell: '/bin/bash',
    });
  }

  // Copy PWA app to /app subdirectory
  if (existsSync(DIST_DIR)) {
    logger.info('Copying PWA app to /app...');
    const appDir = join(PUBLIC_DIR, 'app');
    if (!existsSync(appDir)) {
      await mkdir(appDir, { recursive: true });
    }
    execSync(`cp -R ${DIST_DIR}/* ${appDir}/`, {
      shell: '/bin/bash',
    });
  }

  // Copy manifest and service worker to root
  const manifestSrc = join(READER_CLIENT_DIR, 'public/manifest.json');
  const swSrc = join(READER_CLIENT_DIR, 'public/sw.js');

  if (existsSync(manifestSrc)) {
    await copyFile(manifestSrc, join(PUBLIC_DIR, 'manifest.json'));
    logger.debug('Copied manifest.json to root');
  }

  if (existsSync(swSrc)) {
    await copyFile(swSrc, join(PUBLIC_DIR, 'sw.js'));
    logger.debug('Copied sw.js to root');
  }

  // Copy icons to root
  const publicSrc = join(READER_CLIENT_DIR, 'public');
  if (existsSync(publicSrc)) {
    const files = await readdir(publicSrc);
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.svg')) {
        await copyFile(join(publicSrc, file), join(PUBLIC_DIR, file));
      }
    }
    logger.debug('Copied icon files to root');
  }

  // Create CNAME file if specified
  if (cname) {
    await writeFile(join(PUBLIC_DIR, 'CNAME'), cname);
    logger.info(`Created CNAME file with: ${cname}`);
  }

  // Create .nojekyll to prevent GitHub Pages from processing
  await writeFile(join(PUBLIC_DIR, '.nojekyll'), '');
  logger.debug('Created .nojekyll file');

  // Create 404.html that redirects to index
  const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=/letters/" />
  <title>Redirecting...</title>
</head>
<body>
  <script>
    window.location.href = '/letters/';
  </script>
</body>
</html>`;

  await writeFile(join(PUBLIC_DIR, '404.html'), notFoundHtml);
  logger.debug('Created 404.html');

  logger.success(`Deployment package ready in ${PUBLIC_DIR}`);
}

/**
 * Main build process
 */
async function main() {
  const args = process.argv.slice(2);

  const options: BuildOptions = {
    cleanFirst: !args.includes('--no-clean'),
    generateStatic: !args.includes('--no-static'),
    buildPWA: !args.includes('--no-pwa'),
    createCNAME: args.find((arg) => arg.startsWith('--cname='))?.split('=')[1],
  };

  if (args.includes('--help')) {
    console.log(`
Build and Deploy Script

Usage:
  tsx scripts/build-deploy.ts [options]

Options:
  --no-clean          Skip cleaning build directories
  --no-static         Skip static site generation
  --no-pwa            Skip PWA build
  --cname=DOMAIN      Create CNAME file with custom domain
  --help              Show this help message

Examples:
  # Full build
  tsx scripts/build-deploy.ts

  # Build only static site
  tsx scripts/build-deploy.ts --no-pwa

  # Build with custom domain
  tsx scripts/build-deploy.ts --cname=letters.example.com
`);
    return;
  }

  logger.info('Starting build process...');

  try {
    // Clean
    if (options.cleanFirst) {
      await clean();
    }

    // Create placeholder icons if they don't exist
    await createPlaceholderIcons();

    // Generate static site (includes JSON API for PWA)
    if (options.generateStatic) {
      await generateStaticSite();
    }

    // Build PWA - now works with static JSON
    if (options.buildPWA) {
      await buildPWA();
    }

    // Combine for deployment
    await combineForDeployment(options.createCNAME);

    logger.success('Build complete!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('  1. Review the public/ directory');
    logger.info('  2. Deploy to GitHub Pages or your hosting provider');
    logger.info('  3. Test both static pages and PWA functionality');
  } catch (error) {
    logger.error('Build failed:', error);
    process.exit(1);
  }
}

main();
