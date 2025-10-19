#!/usr/bin/env node
/**
 * Newsletter Reader Server
 *
 * Express server that provides API endpoints for the newsletter reader application.
 * Serves static frontend files and handles database queries.
 */

import { config } from 'dotenv';
import { initializeDatabase } from '../../../lib/db/schema.js';
import { DatabaseQueries } from '../../../lib/db/queries/index.js';
import { logger, LogLevel } from '../../../lib/utils/logger.js';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { createEmailRouter } from './routes/emails.js';
import { createImageRouter } from './routes/images.js';
import { requestLogger } from './middleware/logging.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  return {
    verbose: args.includes('--verbose'),
    help: args.includes('--help'),
    port: Number(
      args.find((arg) => arg.startsWith('--port='))?.split('=')[1] || PORT
    ),
  };
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Newsletter Reader Server

Usage:
  npm run reader [options]

Options:
  --verbose           Enable verbose logging
  --port=PORT         Specify port (default: 3000)
  --help              Show this help message

Description:
  Express server that provides API endpoints for the newsletter reader application.
  Serves the React frontend and handles database queries.

Features:
  - Browse all published newsletters
  - Read full content with embedded images
  - Navigate between issues (previous/next)
  - Search functionality
  - Chronological ordering by publish date
`);
}

/**
 * Main application logic
 */
async function main() {
  const flags = parseArgs();

  if (flags.verbose) {
    logger.setLevel(LogLevel.DEBUG);
  }

  if (flags.help) {
    printUsage();
    return;
  }

  logger.info('Starting Newsletter Reader server...');

  // Initialize database connection
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  // Create Express server
  const app = express();

  // Apply middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API Routes
  app.use('/api/emails', createEmailRouter(db, queries));
  app.use('/api/images', createImageRouter(queries));

  // Serve static files from the client dist directory in production
  const clientDistPath = join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));

  // SPA fallback - serve index.html for all other routes
  app.get('*', (req, res) => {
    // Don't send index.html for API routes that weren't found
    if (req.path.startsWith('/api/')) {
      return notFoundHandler(req, res);
    }
    res.sendFile(join(clientDistPath, 'index.html'));
  });

  // Error handling (must be last)
  app.use(errorHandler);

  // Start server
  const server = app.listen(flags.port, '0.0.0.0', () => {
    logger.success(
      `Newsletter Reader server running at http://localhost:${flags.port}`
    );
    logger.info(
      'Available on your network - check Vite output for network URL'
    );
    logger.info('Press Ctrl+C to stop');
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutdown signal received, closing server...');
    server.close(() => {
      db.close();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', () => {
    logger.info(''); // New line after ^C
    shutdown();
  });
}

// Run the server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
