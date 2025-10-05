#!/usr/bin/env node
/**
 * Newsletter Reader App
 *
 * A React-based single page application for reading newsletters chronologically.
 * Provides seamless navigation between issues based on publish date.
 */

import { config } from 'dotenv';
import { initializeDatabase } from '../../lib/db/schema.js';
import { DatabaseQueries } from '../../lib/db/queries.js';
import { logger, LogLevel } from '../../lib/utils/logger.js';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

/**
 * Main application logic
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const flags = {
    verbose: args.includes('--verbose'),
    help: args.includes('--help'),
    port: args.find((arg) => arg.startsWith('--port='))?.split('=')[1] || PORT,
  };

  if (flags.verbose) {
    logger.setLevel(LogLevel.DEBUG);
  }

  if (flags.help) {
    printUsage();
    return;
  }

  logger.info('Starting Newsletter Reader app...');

  // Initialize database connection
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  // Create Express server
  const app = express();

  // Enable CORS for development
  app.use(cors());
  app.use(express.json());

  // Serve static files from the dist directory in production
  const distPath = join(__dirname, 'dist');
  app.use(express.static(distPath));

  // API Routes

  /**
   * GET /api/emails
   * Returns all published emails sorted by publish date (newest first)
   */
  app.get('/api/emails', (req, res) => {
    try {
      const emails = db
        .prepare(
          `
          SELECT 
            id, subject, description, publish_date, 
            creation_date, slug, image_url, status,
            secondary_id
          FROM emails 
          WHERE status IN ('sent', 'imported') AND publish_date IS NOT NULL
          ORDER BY publish_date DESC
         `
        )
        .all();

      res.json(emails);
    } catch (error) {
      logger.error('Error fetching emails:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  });

  /**
   * GET /api/emails/:id
   * Returns a single email with full body content and embedded images
   */
  app.get('/api/emails/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = queries.getEmailWithLocalImages(id);

      if (!result) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      // Console log the body and normalized_markdown columns
      console.log('\n=== Letter Opened ===');
      console.log('ID:', id);
      console.log('Subject:', result.email.subject);
      console.log('\n--- Original Body (body column) ---');
      console.log(result.email.body);
      console.log('\n--- Normalized Markdown (normalized_markdown column) ---');
      console.log(result.email.normalized_markdown);
      console.log('\n--- Processed Body (with embedded images) ---');
      console.log(result.body);
      console.log('====================\n');

      // Return the email with images converted to data URIs (markdown will be parsed in frontend)
      res.json({
        ...result.email,
        body: result.body,
      });
    } catch (error) {
      logger.error('Error fetching email:', error);
      res.status(500).json({ error: 'Failed to fetch email' });
    }
  });

  /**
   * GET /api/emails/:id/navigation
   * Returns the previous and next email IDs for navigation
   */
  app.get('/api/emails/:id/navigation', (req, res) => {
    try {
      const { id } = req.params;

      // Get current email's publish date
      const currentEmail = db
        .prepare('SELECT publish_date FROM emails WHERE id = ?')
        .get(id) as { publish_date: string } | undefined;

      if (!currentEmail) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      // Get previous email (older)
      const prevEmail = db
        .prepare(
          `
          SELECT id, subject, publish_date
          FROM emails 
          WHERE status IN ('sent', 'imported')
            AND publish_date IS NOT NULL
            AND publish_date < ?
          ORDER BY publish_date DESC
          LIMIT 1
         `
        )
        .get(currentEmail.publish_date) as
        | { id: string; subject: string; publish_date: string }
        | undefined;

      // Get next email (newer)
      const nextEmail = db
        .prepare(
          `
          SELECT id, subject, publish_date
          FROM emails 
          WHERE status IN ('sent', 'imported')
            AND publish_date IS NOT NULL
            AND publish_date > ?
          ORDER BY publish_date ASC
          LIMIT 1
         `
        )
        .get(currentEmail.publish_date) as
        | { id: string; subject: string; publish_date: string }
        | undefined;

      res.json({
        prev: prevEmail || null,
        next: nextEmail || null,
      });
    } catch (error) {
      logger.error('Error fetching navigation:', error);
      res.status(500).json({ error: 'Failed to fetch navigation' });
    }
  });

  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });

  // Start server
  const server = app.listen(flags.port, () => {
    logger.success(
      `Newsletter Reader running at http://localhost:${flags.port}`
    );
    logger.info('Press Ctrl+C to stop');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing server...');
    server.close(() => {
      db.close();
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('\nSIGINT received, closing server...');
    server.close(() => {
      db.close();
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

function printUsage() {
  console.log(`
Newsletter Reader App

Usage:
  npm run reader [options]

Options:
  --verbose           Enable verbose logging
  --port=PORT         Specify port (default: 3000)
  --help              Show this help message

Description:
  A React-based single page application for reading newsletters.
  Provides seamless navigation between issues chronologically based on publish date.

Features:
  - Browse all published newsletters
  - Read full content with embedded images
  - Navigate between issues (previous/next)
  - Chronological ordering by publish date
  - Responsive design
`);
}

// Run the app
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
