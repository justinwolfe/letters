/**
 * Vacuum the database to reclaim freed space
 * After compression, SQLite marks space as free but doesn't automatically shrink the file
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { logger } from '../lib/utils/logger.js';
import { statSync } from 'fs';
import { getDbPath } from '../lib/db/schema.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  try {
    const dbPath = getDbPath();

    logger.info('Analyzing database...');

    // Get size before
    const statsBefore = statSync(dbPath);
    const sizeBefore = statsBefore.size;

    console.log(`\nCurrent database size: ${formatBytes(sizeBefore)}`);
    console.log('\nVacuuming database (this may take 1-2 minutes)...');

    const db = initializeDatabase();

    // Get page stats
    const pageCount = db.prepare('PRAGMA page_count').get() as {
      page_count: number;
    };
    const pageSize = db.prepare('PRAGMA page_size').get() as {
      page_size: number;
    };
    const freePages = db.prepare('PRAGMA freelist_count').get() as {
      freelist_count: number;
    };

    console.log(`\nDatabase statistics:`);
    console.log(`  Total pages: ${pageCount.page_count}`);
    console.log(`  Page size: ${pageSize.page_size} bytes`);
    console.log(`  Free pages: ${freePages.freelist_count}`);
    console.log(
      `  Wasted space: ${formatBytes(
        freePages.freelist_count * pageSize.page_size
      )}`
    );

    // VACUUM the database
    logger.info('Running VACUUM command...');
    db.pragma('vacuum');

    db.close();

    // Get size after
    const statsAfter = statSync(dbPath);
    const sizeAfter = statsAfter.size;
    const saved = sizeBefore - sizeAfter;
    const percentSaved = ((saved / sizeBefore) * 100).toFixed(1);

    console.log(`\n✅ VACUUM complete!`);
    console.log(`\nResults:`);
    console.log(`  Before: ${formatBytes(sizeBefore)}`);
    console.log(`  After:  ${formatBytes(sizeAfter)}`);
    console.log(`  Saved:  ${formatBytes(saved)} (${percentSaved}%)`);

    logger.success('Database successfully compacted!');
  } catch (error) {
    logger.error('Error vacuuming database:', error);
    process.exit(1);
  }
}

main();
