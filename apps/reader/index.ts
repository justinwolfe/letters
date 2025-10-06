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
    port: Number(
      args.find((arg) => arg.startsWith('--port='))?.split('=')[1] || PORT
    ),
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
   * GET /api/emails/search?q=query
   * Search emails by subject, description, and body content
   */
  app.get('/api/emails/search', (req, res) => {
    try {
      const query = req.query.q as string;

      if (!query || query.trim().length === 0) {
        res.json([]);
        return;
      }

      const searchTerm = `%${query.trim()}%`;
      const emails = db
        .prepare(
          `
          SELECT 
            id, subject, description, publish_date, 
            creation_date, slug, image_url, status,
            secondary_id, body, normalized_markdown
          FROM emails 
          WHERE status IN ('sent', 'imported') 
            AND publish_date IS NOT NULL
            AND (
              subject LIKE ? 
              OR description LIKE ? 
              OR body LIKE ?
              OR normalized_markdown LIKE ?
            )
          ORDER BY publish_date DESC
         `
        )
        .all(searchTerm, searchTerm, searchTerm, searchTerm);

      // Generate snippets for each result
      const emailsWithSnippets = emails.map((email: any) => {
        const snippet = generateSearchSnippet(email, query.trim());
        return {
          id: email.id,
          subject: email.subject,
          description: email.description,
          publish_date: email.publish_date,
          creation_date: email.creation_date,
          slug: email.slug,
          image_url: email.image_url,
          status: email.status,
          secondary_id: email.secondary_id,
          searchSnippet: snippet,
        };
      });

      res.json(emailsWithSnippets);
    } catch (error) {
      logger.error('Error searching emails:', error);
      res.status(500).json({ error: 'Failed to search emails' });
    }
  });

  /**
   * Generate a search snippet showing context around the matched text
   */
  function generateSearchSnippet(email: any, query: string): string {
    const queryLower = query.toLowerCase();
    const snippetLength = 150; // characters of context around the match

    // Check where the match occurs (in order of preference)
    const fields = [
      { name: 'subject', text: email.subject, prefix: '' },
      { name: 'description', text: email.description, prefix: '' },
      {
        name: 'body',
        text: email.normalized_markdown || email.body,
        prefix: '',
      },
    ];

    for (const field of fields) {
      if (!field.text) continue;

      const textLower = field.text.toLowerCase();
      const matchIndex = textLower.indexOf(queryLower);

      if (matchIndex !== -1) {
        // Found a match - extract context around it
        const start = Math.max(0, matchIndex - snippetLength / 2);
        const end = Math.min(
          field.text.length,
          matchIndex + query.length + snippetLength / 2
        );

        let snippet = field.text.substring(start, end);

        // Add ellipsis if we're not at the start/end
        if (start > 0) snippet = '...' + snippet;
        if (end < field.text.length) snippet = snippet + '...';

        // Clean up the snippet (remove excessive whitespace, newlines)
        snippet = snippet.replace(/\s+/g, ' ').trim();

        // Highlight the matching text with markers
        const snippetLower = snippet.toLowerCase();
        const matchInSnippet = snippetLower.indexOf(queryLower);

        if (matchInSnippet !== -1) {
          snippet =
            snippet.substring(0, matchInSnippet) +
            '<<MATCH>>' +
            snippet.substring(matchInSnippet, matchInSnippet + query.length) +
            '<</MATCH>>' +
            snippet.substring(matchInSnippet + query.length);
        }

        return snippet;
      }
    }

    // No match found (shouldn't happen, but fallback to description or start of body)
    return (
      email.description || email.body?.substring(0, snippetLength) + '...' || ''
    );
  }

  /**
   * GET /api/emails/random
   * Returns a random published email
   */
  app.get('/api/emails/random', (req, res) => {
    try {
      const email = db
        .prepare(
          `
          SELECT 
            id, subject, description, publish_date, 
            creation_date, slug, image_url, status,
            secondary_id
          FROM emails 
          WHERE status IN ('sent', 'imported') AND publish_date IS NOT NULL
          ORDER BY RANDOM()
          LIMIT 1
         `
        )
        .get();

      if (!email) {
        res.status(404).json({ error: 'No emails found' });
        return;
      }

      res.json(email);
    } catch (error) {
      logger.error('Error fetching random email:', error);
      res.status(500).json({ error: 'Failed to fetch random email' });
    }
  });

  /**
   * GET /api/emails/:id
   * Returns a single email with full body content (with local image references)
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
      console.log('\n--- Processed Body (with local references) ---');
      console.log(result.body);
      console.log('====================\n');

      // Return the email with local image references (markdown will be parsed in frontend)
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
   * GET /api/images/:id
   * Returns an embedded image by its ID
   */
  app.get('/api/images/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid image ID' });
        return;
      }

      const image = queries.getEmbeddedImageById(id);

      if (!image) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Type', image.mime_type);
      res.setHeader('Content-Length', image.file_size);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year

      // Send the raw image data
      res.send(image.image_data);
    } catch (error) {
      logger.error('Error fetching image:', error);
      res.status(500).json({ error: 'Failed to fetch image' });
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
  const server = app.listen(flags.port, '0.0.0.0', () => {
    logger.success(
      `Newsletter Reader running at http://localhost:${flags.port}`
    );
    logger.info(
      'Available on your network - check Vite output for network URL'
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
