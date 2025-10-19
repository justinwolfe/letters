#!/usr/bin/env ts-node
/**
 * Migrate database schema to add tags tables
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

function migrateToV4(db: Database.Database): void {
  logger.info('Migrating to schema version 4 (adding tags)...');

  // Check if tables already exist
  const tagsTableExists = db
    .prepare(
      `
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='tags'
  `
    )
    .get();

  if (tagsTableExists) {
    logger.info('tags table already exists, skipping creation');
    return;
  }

  // Create tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      normalized_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tags_normalized_name
      ON tags(normalized_name);
  `);

  // Create email_tags junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_tags (
      email_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (email_id, tag_id),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_email_tags_tag_id
      ON email_tags(tag_id);
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
  ).run('schema_version', '4', now);

  logger.success('Migration to schema version 4 complete!');
}

async function main() {
  const dbPath = getDbPath();
  logger.info(`Opening database: ${dbPath}`);

  const db = new Database(dbPath);

  try {
    const currentVersion = getCurrentSchemaVersion(db);
    logger.info(`Current schema version: ${currentVersion}`);

    const versionNum = parseInt(currentVersion);
    if (versionNum < 4) {
      migrateToV4(db);
      logger.success('Database migration complete!');
    } else {
      logger.info('Database is already at version 4 or higher');
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
});
