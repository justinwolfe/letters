/**
 * Migration script to add author field to emails table
 *
 * Run with: npm run tsx scripts/migrate-add-author.ts
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { logger } from '../lib/utils/logger.js';

async function migrateAddAuthor() {
  const db = initializeDatabase();

  try {
    logger.info('Starting migration: Add author field to emails table');

    // Check if column already exists
    const tableInfo = db.pragma('table_info(emails)');
    const hasAuthor = tableInfo.some((col: any) => col.name === 'author');

    if (hasAuthor) {
      logger.info('Author column already exists, skipping migration');
      return;
    }

    // Add author column
    db.exec(`
      ALTER TABLE emails
      ADD COLUMN author TEXT DEFAULT NULL;
    `);

    // Create index for author lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_emails_author
        ON emails(author);
    `);

    logger.success('Migration complete: Author field added successfully');
    logger.info('You can now track which letters are from guest contributors');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateAddAuthor().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { migrateAddAuthor };
