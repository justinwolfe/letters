/**
 * Image API routes
 *
 * Handles serving embedded images from the database.
 */

import { Router } from 'express';
import type { DatabaseQueries } from '../../../../lib/db/queries/index.js';
import { logger } from '../../../../lib/utils/logger.js';

/**
 * Create image routes
 *
 * @param queries - Database queries facade
 * @returns Express router with image routes
 */
export function createImageRouter(queries: DatabaseQueries): Router {
  const router = Router();

  /**
   * GET /api/images/:id
   * Returns an embedded image by its ID
   */
  router.get('/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid image ID' });
        return;
      }

      const image = queries.images.getEmbeddedImageById(id);

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

  return router;
}
