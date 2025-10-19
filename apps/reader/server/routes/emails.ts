/**
 * Email API routes
 *
 * Handles all email-related endpoints including listing, searching,
 * and retrieving individual emails with navigation support.
 */

import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { DatabaseQueries } from '../../../../lib/db/queries/index.js';
import { logger } from '../../../../lib/utils/logger.js';

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
 * Create email routes
 *
 * @param db - Database instance
 * @param queries - Database queries facade
 * @returns Express router with email routes
 */
export function createEmailRouter(
  db: Database.Database,
  queries: DatabaseQueries
): Router {
  const router = Router();

  /**
   * GET /api/emails
   * Returns all published emails sorted by publish date (newest first)
   */
  router.get('/', (_req, res) => {
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
  router.get('/search', (req, res) => {
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
   * GET /api/emails/random
   * Returns a random published email
   */
  router.get('/random', (_req, res) => {
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
  router.get('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = queries.emails.getEmailWithLocalImages(id);

      if (!result) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }

      // Get tags for this email
      const tags = queries.tags.getEmailTags(id);

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

      // Return the email with local image references and tags
      res.json({
        ...result.email,
        body: result.body,
        tags: tags.map((t) => ({
          id: t.id,
          name: t.name,
          normalized_name: t.normalized_name,
        })),
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
  router.get('/:id/navigation', (req, res) => {
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

  return router;
}
