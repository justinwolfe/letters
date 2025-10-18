#!/usr/bin/env node
/**
 * Template for creating a new independent app
 *
 * This template demonstrates how to create a standalone application
 * that uses the shared library infrastructure (database, API, utils).
 *
 * To create a new app:
 * 1. Copy this directory to apps/your-app-name/
 * 2. Rename and customize this file
 * 3. Add a script to package.json: "your-app": "tsx apps/your-app-name/index.ts"
 * 4. Implement your logic using the shared libraries
 *
 * Example: apps/wordcloud/index.ts, apps/export/index.ts, etc.
 */

import { config } from 'dotenv';
import { initializeDatabase } from '../../lib/db/schema.js';
import { DatabaseQueries } from '../../lib/db/queries/index.js';
import { logger, LogLevel } from '../../lib/utils/logger.js';
// import { ButtondownClient } from '../../lib/api/client.js';

// Load environment variables
config();

/**
 * Main application logic
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const flags = {
    verbose: args.includes('--verbose'),
    help: args.includes('--help'),
  };

  if (flags.verbose) {
    logger.setLevel(LogLevel.DEBUG);
  }

  if (flags.help) {
    printUsage();
    return;
  }

  logger.info('Starting your custom app...');

  // Initialize database connection
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  try {
    // Example: Get all emails from the database
    const emails = queries.emails.getAllEmails();
    logger.info(`Found ${emails.length} emails in database`);

    // Example: Access Buttondown API (if needed)
    const apiKey = process.env.BUTTONDOWN_API_KEY;
    if (apiKey) {
      // Uncomment to use the API client
      // const client = new ButtondownClient(apiKey);
      // logger.debug('Buttondown API client initialized');
      // Your API logic here...
      // const email = await client.fetchEmail('some-id');
    }

    // Your custom application logic here
    // Examples:
    // - Generate word clouds
    // - Export to different formats
    // - Analyze content
    // - Generate reports
    // - Create backups
    // - Build indexes

    logger.success('App completed successfully!');
  } catch (error) {
    logger.error('App failed:', error);
    process.exit(1);
  } finally {
    // Always close the database connection
    db.close();
  }
}

function printUsage() {
  console.log(`
Your Custom App

Usage:
  npm run your-app [options]

Options:
  --verbose           Enable verbose logging
  --help              Show this help message

Description:
  Describe what your app does here...
`);
}

// Run the app
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
