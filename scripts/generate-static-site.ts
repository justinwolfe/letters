#!/usr/bin/env tsx
/**
 * Static Site Generator
 *
 * Generates static HTML pages for all newsletter letters to be hosted on GitHub Pages.
 * Creates an MPA (Multi-Page Application) with static HTML for each letter plus an
 * index page listing all letters.
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { logger } from '../lib/utils/logger.js';
import { marked } from 'marked';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATIC_SITE_DIR = join(__dirname, '../public');
const LETTERS_DIR = join(STATIC_SITE_DIR, 'letters');
const IMAGES_DIR = join(STATIC_SITE_DIR, 'images');
const API_DIR = join(STATIC_SITE_DIR, 'api');
const SHARED_STYLES_PATH = join(__dirname, '../lib/utils/shared-styles.css');
const BASE_PATH = '/letters'; // GitHub Pages base path

// Cache for shared styles
let sharedStylesCache: string | null = null;

interface Email {
  id: string;
  subject: string;
  body: string;
  normalized_markdown: string | null;
  publish_date: string;
  description: string;
  slug: string | null;
  secondary_id: number | null;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Create slug from text
 */
function createSlug(text: string, id: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || id;
}

/**
 * Load shared styles (cached)
 */
async function loadSharedStyles(): Promise<string> {
  if (sharedStylesCache) {
    return sharedStylesCache;
  }

  try {
    sharedStylesCache = await readFile(SHARED_STYLES_PATH, 'utf-8');
    return sharedStylesCache;
  } catch (error) {
    logger.error('Failed to load shared styles:', error);
    throw new Error('Could not load shared styles file');
  }
}

/**
 * Generate the base HTML template
 */
async function generateBaseTemplate(
  title: string,
  content: string,
  description: string = 'Thank You Notes - A newsletter collection'
): Promise<string> {
  const sharedStyles = await loadSharedStyles();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)}</title>
  <link rel="manifest" href="${BASE_PATH}/manifest.json">
  <meta name="theme-color" content="#007bff">
  <link rel="apple-touch-icon" href="${BASE_PATH}/icon-192.png">
  <style>
    ${sharedStyles}
    
    /* Static site specific adjustments */
    body {
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>

  <script>
    // PWA installation prompt
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      const banner = document.querySelector('.pwa-banner');
      if (banner) {
        banner.style.display = 'flex';
      }
    });

    async function installPWA() {
      if (!deferredPrompt) {
        // If not installable, redirect to PWA
        window.location.href = '${BASE_PATH}/app/';
        return;
      }

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installed');
      }
      
      deferredPrompt = null;
      const banner = document.querySelector('.pwa-banner');
      if (banner) {
        banner.style.display = 'none';
      }
    }

    function openPWA() {
      // Mark PWA preference and redirect
      localStorage.setItem('pwa-preferred', 'true');

      // Extract the letter slug from current URL if on a letter page
      const path = window.location.pathname;
      const match = path.match(/\/letters\/([^/]+)\.html$/);

      if (match) {
        const slug = match[1];
        window.location.href = '${BASE_PATH}/app/?letter=' + encodeURIComponent(slug);
      } else {
        window.location.href = '${BASE_PATH}/app/';
      }
    }

    // PWA Auto-redirect: Check if user prefers PWA or has ?pwa=1 parameter
    (function() {
      const params = new URLSearchParams(window.location.search);
      const preferPWA = params.get('pwa') === '1';
      const hasPWAPreference = localStorage.getItem('pwa-preferred') === 'true';

      // Don't redirect if already in standalone mode (PWA is installed and running)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

      if ((preferPWA || hasPWAPreference) && !isStandalone) {
        // Redirect to PWA with letter context
        const path = window.location.pathname;
        const match = path.match(/\/letters\/([^/]+)\.html$/);

        if (match) {
          const slug = match[1];
          window.location.href = '${BASE_PATH}/app/?letter=' + encodeURIComponent(slug);
        } else {
          window.location.href = '${BASE_PATH}/app/';
        }
        return; // Stop further execution
      }
    })();

    // Progressive Enhancement: Check if user has PWA installed
    // If they do, show banner suggesting to use the app
    if (window.matchMedia('(display-mode: standalone)').matches) {
      // User is in standalone mode (PWA is installed and running)
      // Keep them on static page - they're already in PWA mode
      console.log('Running in PWA mode');
    } else {
      // Check if user has previously used the PWA (has cached data)
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          const hasPWACache = cacheNames.some(name =>
            name.includes('static-') || name.includes('data-')
          );

          // Only show PWA banner if they have cached content
          if (hasPWACache) {
            const banner = document.querySelector('.pwa-banner');
            if (banner && banner.style.display === 'none') {
              banner.style.display = 'flex';
            }
          }
        });
      }
    }

    // Register service worker for all pages
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('${BASE_PATH}/sw.js', { scope: '${BASE_PATH}/' })
          .then((registration) => {
            console.log('SW registered:', registration);
          })
          .catch((error) => {
            console.log('SW registration failed:', error);
          });
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generate the index page with all letters
 */
async function generateIndexPage(emails: Email[]): Promise<string> {
  const lettersList = emails
    .map((email) => {
      const slug = email.slug || createSlug(email.subject, email.id);
      return `
        <a href="${BASE_PATH}/letters/${slug}.html" class="letter-card">
          <h2>${escapeHtml(email.subject)}</h2>
          ${email.description ? `<p>${escapeHtml(email.description)}</p>` : ''}
          <time datetime="${email.publish_date}">${formatDate(
        email.publish_date
      )}</time>
        </a>
      `;
    })
    .join('');

  const content = `
    <header class="header">
      <h1>thank you notes</h1>
      <p class="subtitle">${emails.length} published issue${
    emails.length !== 1 ? 's' : ''
  }</p>
    </header>

    <div class="pwa-banner" style="display: none;">
      <div class="pwa-banner-text">
        <h3>📱 Get the App</h3>
        <p>Read offline with our Progressive Web App</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="installPWA()">Install App</button>
        <button class="btn btn-secondary" onclick="openPWA()">Open App</button>
      </div>
    </div>

    <div class="letter-list">
      ${lettersList}
    </div>
  `;

  return generateBaseTemplate('Thank You Notes', content);
}

/**
 * Generate a single letter page
 */
async function generateLetterPage(
  email: Email,
  prevEmail: Email | null,
  nextEmail: Email | null,
  imageExtMap: Map<number, string>,
  queries: DatabaseQueries
): Promise<string> {
  let markdown = email.normalized_markdown || email.body;

  // Replace /api/images/{id} references with /letters/images/{id}.{ext}
  // Use the imageExtMap to get the correct file extension for each image
  markdown = markdown.replace(
    /!\[([^\]]*)\]\(\/api\/images\/(\d+)\)/g,
    (_match, alt, id) => {
      const ext = imageExtMap.get(Number(id)) || 'png';
      return `![${alt}](${BASE_PATH}/images/${id}.${ext})`;
    }
  );

  const html = await marked(markdown);

  const prevSlug = prevEmail
    ? prevEmail.slug || createSlug(prevEmail.subject, prevEmail.id)
    : null;
  const nextSlug = nextEmail
    ? nextEmail.slug || createSlug(nextEmail.subject, nextEmail.id)
    : null;

  const prevLink = prevEmail
    ? `<a href="${BASE_PATH}/letters/${prevSlug}.html" class="btn btn-secondary">← ${escapeHtml(
        prevEmail.subject
      )}</a>`
    : '';
  const nextLink = nextEmail
    ? `<a href="${BASE_PATH}/letters/${nextSlug}.html" class="btn btn-secondary">${escapeHtml(
        nextEmail.subject
      )} →</a>`
    : '';

  // Get tags for this email
  const tags = queries.tags.getEmailTags(email.id);
  const tagsHtml = tags.length > 0 ? `
    <footer class="email-tags">
      <div class="tags-label">Tags:</div>
      <div class="tags-list">
        ${tags.map(tag => `<a href="${BASE_PATH}/?tag=${encodeURIComponent(tag.normalized_name)}" class="tag-badge">#${escapeHtml(tag.name)}</a>`).join('\n        ')}
      </div>
    </footer>
  ` : '';

  const content = `
    <div class="pwa-banner" style="display: none;">
      <div class="pwa-banner-text">
        <h3>📱 Read Offline</h3>
        <p>Install the app to read all letters offline</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="installPWA()">Install App</button>
      </div>
    </div>

    <article class="letter-content">
      <header class="letter-header">
        <h1>${escapeHtml(email.subject)}</h1>
        <time datetime="${email.publish_date}">${formatDate(
    email.publish_date
  )}</time>
      </header>

      <div class="letter-body">
        ${html}
      </div>

      ${tagsHtml}
    </article>

    <nav class="navigation">
      <a href="${BASE_PATH}/" class="btn btn-secondary">home</a>
      <div class="nav-links">
        ${prevLink}
        ${nextLink}
      </div>
    </nav>
  `;

  return await generateBaseTemplate(
    `${email.subject} - Thank You Notes`,
    content,
    email.description || email.subject
  );
}

/**
 * Export images from database to static files
 * Returns a map of image ID to file extension
 */
async function exportImages(db: any): Promise<Map<number, string>> {
  logger.info('Exporting images from database...');

  // Create images directory
  if (!existsSync(IMAGES_DIR)) {
    await mkdir(IMAGES_DIR, { recursive: true });
  }

  // Get all embedded images from database with image_data
  const stmt = db.prepare(`
    SELECT id, image_data, mime_type
    FROM embedded_images
  `);
  const images = stmt.all();
  logger.info(`Found ${images.length} images to export`);

  const imageExtMap = new Map<number, string>();
  let exportedCount = 0;

  for (const image of images) {
    try {
      // Determine file extension from mime type
      let ext = 'png';
      if (image.mime_type.includes('jpeg') || image.mime_type.includes('jpg')) {
        ext = 'jpg';
      } else if (image.mime_type.includes('gif')) {
        ext = 'gif';
      } else if (image.mime_type.includes('webp')) {
        ext = 'webp';
      }

      imageExtMap.set(image.id, ext);

      // Write image file as {id}.{ext}
      const filename = `${image.id}.${ext}`;
      const filepath = join(IMAGES_DIR, filename);
      await writeFile(filepath, image.image_data);
      exportedCount++;

      if (exportedCount % 100 === 0) {
        logger.debug(`Exported ${exportedCount}/${images.length} images...`);
      }
    } catch (error) {
      logger.error(`Failed to export image ${image.id}:`, error);
    }
  }

  logger.success(`Exported ${exportedCount} images`);
  return imageExtMap;
}

/**
 * Export email data as static JSON API
 */
async function exportEmailsAsJSON(
  queries: DatabaseQueries,
  imageExtMap: Map<number, string>
) {
  logger.info('Exporting emails as JSON API...');

  // Create API directories
  const emailsDir = join(API_DIR, 'emails');
  const imagesApiDir = join(API_DIR, 'images');

  if (!existsSync(API_DIR)) {
    await mkdir(API_DIR, { recursive: true });
  }
  if (!existsSync(emailsDir)) {
    await mkdir(emailsDir, { recursive: true });
  }
  if (!existsSync(imagesApiDir)) {
    await mkdir(imagesApiDir, { recursive: true });
  }

  // Get all emails
  const emails = queries.emails.getAllEmails() as Email[];

  // Create index of all emails (summary data only)
  const emailsIndex = emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    description: email.description,
    publish_date: email.publish_date,
    slug: email.slug,
    secondary_id: email.secondary_id,
  }));

  await writeFile(
    join(API_DIR, 'emails.json'),
    JSON.stringify(emailsIndex, null, 2)
  );

  // Create bulk file with all emails (full content) for efficient offline downloads
  logger.info('Creating bulk emails file...');
  const fullEmails = [];

  for (const email of emails) {
    let markdown = email.normalized_markdown || email.body;

    // Replace image paths for JSON API (PWA will use these paths)
    markdown = markdown.replace(
      /!\[([^\]]*)\]\(\/api\/images\/(\d+)\)/g,
      (_match, alt, id) => {
        const ext = imageExtMap.get(Number(id)) || 'png';
        return `![${alt}](${BASE_PATH}/images/${id}.${ext})`;
      }
    );

    // Get tags for this email
    const tags = queries.tags.getEmailTags(email.id);

    fullEmails.push({
      id: email.id,
      subject: email.subject,
      body: markdown,
      normalized_markdown: markdown,
      publish_date: email.publish_date,
      description: email.description,
      slug: email.slug,
      secondary_id: email.secondary_id,
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        normalized_name: t.normalized_name,
      })),
    });
  }

  // Write bulk file with metadata
  const bulkData = {
    version: 1,
    generated_at: new Date().toISOString(),
    count: fullEmails.length,
    emails: fullEmails,
  };

  await writeFile(
    join(API_DIR, 'emails-full.json'),
    JSON.stringify(bulkData, null, 2)
  );
  logger.success(`Exported bulk file with ${fullEmails.length} emails`);

  // Create individual email JSON files with full content (for backward compatibility and incremental updates)
  for (const emailData of fullEmails) {
    await writeFile(
      join(emailsDir, `${emailData.id}.json`),
      JSON.stringify(emailData, null, 2)
    );
  }

  logger.success(`Exported ${emails.length} individual email files as JSON`);
}

/**
 * Main generation logic
 */
async function main() {
  logger.info('Starting static site generation...');

  // Initialize database
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  // Get all published emails
  const emails = queries.emails.getAllEmails() as Email[];
  logger.info(`Found ${emails.length} emails to process`);

  // Create output directories
  if (!existsSync(STATIC_SITE_DIR)) {
    await mkdir(STATIC_SITE_DIR, { recursive: true });
  }
  if (!existsSync(LETTERS_DIR)) {
    await mkdir(LETTERS_DIR, { recursive: true });
  }

  // Export images from database
  const imageExtMap = await exportImages(db);

  // Export emails as JSON API for PWA
  await exportEmailsAsJSON(queries, imageExtMap);

  // Generate index page
  logger.info('Generating index page...');
  const indexHtml = await generateIndexPage(emails);
  await writeFile(join(STATIC_SITE_DIR, 'index.html'), indexHtml);

  // Generate individual letter pages
  logger.info('Generating letter pages...');
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const prevEmail = i > 0 ? emails[i - 1] : null;
    const nextEmail = i < emails.length - 1 ? emails[i + 1] : null;

    const slug = email.slug || createSlug(email.subject, email.id);
    const letterHtml = await generateLetterPage(
      email,
      prevEmail,
      nextEmail,
      imageExtMap,
      queries
    );

    await writeFile(join(LETTERS_DIR, `${slug}.html`), letterHtml);
    logger.debug(`Generated: ${slug}.html`);
  }

  db.close();
  logger.success(`Static site generated successfully in ${STATIC_SITE_DIR}`);
  logger.info(`Generated ${emails.length} letter pages + index`);
}

main().catch((error) => {
  logger.error('Generation failed:', error);
  process.exit(1);
});
