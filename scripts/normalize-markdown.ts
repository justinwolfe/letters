#!/usr/bin/env tsx

/**
 * Normalize markdown for existing emails
 * This script adds normalized markdown to all emails that don't have it yet
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries.js';
import { normalizeToMarkdown } from '../lib/utils/markdown-normalizer.js';
import { logger } from '../lib/utils/logger.js';

// Add migration for the normalized_markdown column
function migrateSchema(db: any): void {
  logger.info('Checking schema...');

  // Check if normalized_markdown column exists
  const columns = db.prepare('PRAGMA table_info(emails)').all() as Array<{
    name: string;
  }>;
  const hasNormalizedMarkdown = columns.some(
    (col) => col.name === 'normalized_markdown'
  );

  if (!hasNormalizedMarkdown) {
    logger.info('Adding normalized_markdown column...');
    db.exec('ALTER TABLE emails ADD COLUMN normalized_markdown TEXT');
    logger.success('Added normalized_markdown column');

    // Update schema version
    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `
    ).run('schema_version', '3', now);
  } else {
    logger.info('Schema is up to date');
  }
}

async function normalizeExistingEmails(): Promise<void> {
  logger.info('Starting markdown normalization for existing emails...');

  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  // Run migration first
  migrateSchema(db);

  // Get count of emails without normalized markdown
  const totalCount = queries.countEmailsWithoutNormalizedMarkdown();

  if (totalCount === 0) {
    logger.success('All emails already have normalized markdown!');
    return;
  }

  logger.info(`Found ${totalCount} emails to normalize`);

  // Process in batches
  const batchSize = 50;
  let processedCount = 0;
  let errorCount = 0;

  while (true) {
    const emails = queries.getEmailsWithoutNormalizedMarkdown(batchSize);

    if (emails.length === 0) {
      break;
    }

    for (const email of emails) {
      try {
        // Normalize the body
        const normalizedMarkdown = normalizeToMarkdown(email.body);

        // Update the database
        queries.updateNormalizedMarkdown(email.id, normalizedMarkdown);

        processedCount++;

        if (processedCount % 10 === 0) {
          logger.info(
            `Progress: ${processedCount}/${totalCount} (${Math.round(
              (processedCount / totalCount) * 100
            )}%)`
          );
        }
      } catch (error) {
        errorCount++;
        logger.warn(`Failed to normalize email ${email.id}:`, error);
      }
    }
  }

  logger.success(
    `\nCompleted! Normalized ${processedCount} emails${
      errorCount > 0 ? ` (${errorCount} errors)` : ''
    }`
  );
}

// Run the normalization
normalizeExistingEmails().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
});
