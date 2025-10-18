#!/usr/bin/env tsx

/**
 * Remove HTML comments from normalized markdown in all existing emails
 * This script re-normalizes all emails to ensure HTML comments are removed
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { normalizeToMarkdown } from '../lib/utils/markdown-normalizer.js';
import { logger } from '../lib/utils/logger.js';

async function removeHtmlComments(): Promise<void> {
  logger.info('Starting HTML comment removal for all emails...');

  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  // Get ALL emails (not just those without normalized markdown)
  const allEmails = queries.emails.getAllEmails();

  if (allEmails.length === 0) {
    logger.success('No emails found in database');
    return;
  }

  logger.info(`Found ${allEmails.length} emails to process`);

  let processedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const email of allEmails) {
    try {
      // Re-normalize the body to apply HTML comment removal
      const normalizedMarkdown = normalizeToMarkdown(email.body);

      // Update the database
      queries.emails.updateNormalizedMarkdown(email.id, normalizedMarkdown);

      processedCount++;
      updatedCount++;

      if (processedCount % 10 === 0) {
        logger.info(
          `Progress: ${processedCount}/${allEmails.length} (${Math.round(
            (processedCount / allEmails.length) * 100
          )}%)`
        );
      }
    } catch (error) {
      errorCount++;
      logger.warn(`Failed to process email ${email.id}:`, error);
    }
  }

  logger.success(
    `\nCompleted! Processed ${processedCount} emails, updated ${updatedCount}${
      errorCount > 0 ? ` (${errorCount} errors)` : ''
    }`
  );
}

// Run the script
removeHtmlComments().catch((error) => {
  logger.error('Script failed:', error);
  process.exit(1);
});
