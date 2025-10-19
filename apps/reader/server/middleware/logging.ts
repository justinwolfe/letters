/**
 * Logging middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../../../lib/utils/logger.js';

/**
 * Request logging middleware
 *
 * Logs information about each incoming request including method,
 * path, and response time.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.path} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.debug(message);
    }
  });

  next();
}
