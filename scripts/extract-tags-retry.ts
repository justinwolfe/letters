#!/usr/bin/env ts-node
/**
 * Retry tag extraction for emails without tags
 *
 * This script finds all emails that don't have any tags and processes them.
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { OpenAIClient } from '../lib/api/openai-client.js';
import { logger } from '../lib/utils/logger.js';
import { execSync } from 'child_process';

async function main() {
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  try {
    // Find all emails without tags
    const emailsWithoutTags = db
      .prepare(
        `
      SELECT e.id, e.subject
      FROM emails e
      LEFT JOIN email_tags et ON e.id = et.email_id
      WHERE et.tag_id IS NULL
      GROUP BY e.id
    `
      )
      .all() as Array<{ id: string; subject: string }>;

    logger.info(`Found ${emailsWithoutTags.length} emails without tags`);

    if (emailsWithoutTags.length === 0) {
      logger.success('All emails have tags!');
      return;
    }

    // Show sample of emails to be processed
    logger.info('\nSample of emails to process:');
    emailsWithoutTags.slice(0, 5).forEach((email, i) => {
      logger.info(`  ${i + 1}. ${email.subject.substring(0, 60)}...`);
    });

    if (emailsWithoutTags.length > 5) {
      logger.info(`  ... and ${emailsWithoutTags.length - 5} more`);
    }

    logger.info('\nProcessing emails one at a time to avoid rate limits...\n');

    let processed = 0;
    let failed = 0;

    for (const email of emailsWithoutTags) {
      try {
        logger.info(
          `[${processed + failed + 1}/${
            emailsWithoutTags.length
          }] Processing: ${email.subject.substring(0, 50)}...`
        );

        // Run the extract-tags script for this specific email
        execSync(`tsx scripts/extract-tags.ts --email-id ${email.id}`, {
          stdio: 'pipe',
          encoding: 'utf-8',
        });

        processed++;
        logger.success(`  ✓ Tagged successfully`);

        // Add a small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        failed++;
        logger.error(
          `  ✗ Failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        // If we hit a rate limit, wait longer
        if (error instanceof Error && error.message.includes('429')) {
          logger.info('  Rate limit hit, waiting 60 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 60000));
        } else {
          // For other errors, just wait a bit and continue
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    logger.success(`\n=== Retry Complete ===`);
    logger.info(`Successfully processed: ${processed}`);
    logger.info(`Failed: ${failed}`);

    // Show final stats
    const stats = queries.tags.getTagStats();
    logger.info(`\nFinal Statistics:`);
    logger.info(`Total tags: ${stats.totalTags}`);
    logger.info(`Total associations: ${stats.totalEmailTags}`);
    logger.info(`Average tags per email: ${stats.avgTagsPerEmail.toFixed(2)}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  logger.error('Retry failed:', error);
  process.exit(1);
});
