#!/usr/bin/env ts-node
/**
 * Migrate database schema to add embedded_images table
 */

import Database from 'better-sqlite3';
import { getDbPath } from '../lib/db/schema.js';
import { logger } from '../lib/utils/logger.js';

function getCurrentSchemaVersion(db: Database.Database): string {
  try {
    const result = db
      .prepare('SELECT value FROM sync_metadata WHERE key = ?')
      .get('schema_version') as { value: string } | undefined;
    return result?.value || '1';
  } catch {
    return '1';
  }
}

function migrateToV2(db: Database.Database): void {
  logger.info('Migrating to schema version 2...');

  // Check if table already exists
  const tableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='embedded_images'
  `
    )
    .get();

  if (tableExists) {
    logger.info('embedded_images table already exists, skipping creation');
    return;
  }

  // Create embedded_images table
  db.exec(`
    CREATE TABLE IF NOT EXISTS embedded_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT NOT NULL,
      original_url TEXT NOT NULL,
      image_data BLOB NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      downloaded_at TEXT NOT NULL,
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
      UNIQUE(email_id, original_url)
    );

    CREATE INDEX IF NOT EXISTS idx_embedded_images_email_id 
      ON embedded_images(email_id);
    
    CREATE INDEX IF NOT EXISTS idx_embedded_images_url 
      ON embedded_images(original_url);
  `);

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
  ).run('schema_version', '2', now);

  logger.success('Migration to schema version 2 complete!');
}

async function main() {
  const dbPath = getDbPath();
  logger.info(`Opening database: ${dbPath}`);

  const db = new Database(dbPath);

  try {
    const currentVersion = getCurrentSchemaVersion(db);
    logger.info(`Current schema version: ${currentVersion}`);

    if (currentVersion === '1') {
      migrateToV2(db);
      logger.success('Database migration complete!');
    } else if (currentVersion === '2') {
      logger.info('Database is already at the latest version (2)');
    } else {
      logger.warn(`Unknown schema version: ${currentVersion}`);
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
});
