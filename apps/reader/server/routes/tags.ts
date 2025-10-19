/**
 * Tag API routes
 *
 * Handles all tag-related endpoints including listing all tags
 * and retrieving emails by tag.
 */

import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { DatabaseQueries } from '../../../../lib/db/queries/index.js';
import { logger } from '../../../../lib/utils/logger.js';

/**
 * Create tag routes
 *
 * @param db - Database instance
 * @param queries - Database queries facade
 * @returns Express router with tag routes
 */
export function createTagRouter(
  _db: Database.Database,
  queries: DatabaseQueries
): Router {
  const router = Router();

  /**
   * GET /api/tags
   * Returns all tags with email counts
   */
  router.get('/', (_req, res) => {
    try {
      const tags = queries.tags.getAllTagsWithCounts();
      res.json(tags);
    } catch (error) {
      logger.error('Error fetching tags:', error);
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  /**
   * GET /api/tags/:tagName/emails
   * Returns all emails with a specific tag
   */
  router.get('/:tagName/emails', (req, res) => {
    try {
      const { tagName } = req.params;
      const emails = queries.tags.getEmailsByTag(tagName);

      // Map to the same format as the email list endpoint
      const formattedEmails = emails.map((email: any) => ({
        id: email.id,
        subject: email.subject,
        description: email.description,
        publish_date: email.publish_date,
        creation_date: email.creation_date,
        slug: email.slug,
        image_url: email.image_url,
        status: email.status,
        secondary_id: email.secondary_id,
      }));

      res.json(formattedEmails);
    } catch (error) {
      logger.error('Error fetching emails by tag:', error);
      res.status(500).json({ error: 'Failed to fetch emails by tag' });
    }
  });

  /**
   * GET /api/tags/stats
   * Returns tag statistics
   */
  router.get('/stats', (_req, res) => {
    try {
      const stats = queries.tags.getTagStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error fetching tag stats:', error);
      res.status(500).json({ error: 'Failed to fetch tag stats' });
    }
  });

  return router;
}
