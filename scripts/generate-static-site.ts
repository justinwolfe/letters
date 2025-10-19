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
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATIC_SITE_DIR = join(__dirname, '../static-site');
const LETTERS_DIR = join(STATIC_SITE_DIR, 'letters');
const IMAGES_DIR = join(STATIC_SITE_DIR, 'images');
const BASE_PATH = '/letters'; // GitHub Pages base path

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
 * Generate the base HTML template
 */
function generateBaseTemplate(
  title: string,
  content: string,
  description: string = 'Thank You Notes - A newsletter collection'
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)}</title>
  <link rel="manifest" href="${BASE_PATH}/manifest.json">
  <meta name="theme-color" content="#1a1a1a">
  <link rel="apple-touch-icon" href="${BASE_PATH}/icon-192.png">
  <style>
    :root {
      --primary-bg: #1a1a1a;
      --secondary-bg: #2d2d2d;
      --text-color: #e0e0e0;
      --text-muted: #b0b0b0;
      --accent: #61dafb;
      --border: #404040;
      --hover-bg: #3d3d3d;
      --max-width: 800px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      background: var(--primary-bg);
      color: var(--text-color);
      line-height: 1.6;
      padding: 20px;
    }

    .container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    header {
      text-align: center;
      padding: 2rem 0;
      border-bottom: 2px solid var(--border);
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      color: var(--accent);
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 1rem;
    }

    .pwa-banner {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .pwa-banner-text {
      flex: 1;
      min-width: 200px;
    }

    .pwa-banner-text h3 {
      margin-bottom: 0.25rem;
      font-size: 1.1rem;
    }

    .pwa-banner-text p {
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
    }

    .btn-primary {
      background: white;
      color: #667eea;
      font-weight: 600;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }

    .btn-secondary {
      background: var(--secondary-bg);
      color: var(--text-color);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--hover-bg);
    }

    .letter-list {
      display: grid;
      gap: 1rem;
    }

    .letter-card {
      background: var(--secondary-bg);
      padding: 1.5rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      text-decoration: none;
      color: inherit;
      display: block;
      transition: all 0.2s;
    }

    .letter-card:hover {
      background: var(--hover-bg);
      border-color: var(--accent);
      transform: translateY(-2px);
    }

    .letter-card h2 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      color: var(--text-color);
    }

    .letter-card p {
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .letter-card time {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .letter-content {
      background: var(--secondary-bg);
      padding: 2rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      margin-bottom: 2rem;
    }

    .letter-header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }

    .letter-header h1 {
      color: var(--text-color);
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .letter-header time {
      color: var(--text-muted);
      font-size: 1rem;
    }

    .letter-body {
      font-size: 1.1rem;
      line-height: 1.8;
    }

    .letter-body h1,
    .letter-body h2,
    .letter-body h3 {
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: var(--text-color);
    }

    .letter-body p {
      margin-bottom: 1rem;
    }

    .letter-body a {
      color: var(--accent);
      text-decoration: none;
    }

    .letter-body a:hover {
      text-decoration: underline;
    }

    .letter-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1rem 0;
    }

    .letter-body blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 1rem;
      margin: 1rem 0;
      font-style: italic;
      color: var(--text-muted);
    }

    .letter-body pre {
      background: var(--primary-bg);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      margin: 1rem 0;
    }

    .letter-body code {
      background: var(--primary-bg);
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-size: 0.9em;
    }

    .letter-body pre code {
      background: none;
      padding: 0;
    }

    .navigation {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 2rem;
    }

    .nav-links {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    @media (max-width: 768px) {
      body {
        padding: 10px;
      }

      h1 {
        font-size: 2rem;
      }

      .letter-content {
        padding: 1rem;
      }

      .letter-body {
        font-size: 1rem;
      }

      .pwa-banner {
        flex-direction: column;
        text-align: center;
      }
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
      window.location.href = '${BASE_PATH}/app/';
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
function generateIndexPage(emails: Email[]): string {
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
    <header>
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
  imageExtMap: Map<number, string>
): Promise<string> {
  let markdown = email.normalized_markdown || email.body;

  // Replace /api/images/{id} references with /letters/images/{id}.{ext}
  // Use the imageExtMap to get the correct file extension for each image
  markdown = markdown.replace(
    /!\[([^\]]*)\]\(\/api\/images\/(\d+)\)/g,
    (match, alt, id) => {
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
    </article>

    <nav class="navigation">
      <a href="${BASE_PATH}/" class="btn btn-secondary">home</a>
      <div class="nav-links">
        ${prevLink}
        ${nextLink}
      </div>
    </nav>
  `;

  return generateBaseTemplate(
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

  // Generate index page
  logger.info('Generating index page...');
  const indexHtml = generateIndexPage(emails);
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
      imageExtMap
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
