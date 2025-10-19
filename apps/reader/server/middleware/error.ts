/**
 * Error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../../../lib/utils/logger.js';

/**
 * Global error handler middleware
 *
 * Catches any errors that bubble up through the request pipeline
 * and returns a standardized error response.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

/**
 * 404 Not Found handler
 *
 * Catches requests to non-existent API endpoints
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.path}`,
  });
}
