/**
 * Database schema and initialization
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'newsletters.db');

export function getDbPath(): string {
  return DB_PATH;
}

export function initializeDatabase(): Database.Database {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    logger.info(`Created data directory: ${DATA_DIR}`);
  }

  const isNewDb = !existsSync(DB_PATH);
  const db = new Database(DB_PATH);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  if (isNewDb) {
    logger.info('Initializing new database...');
    createSchema(db);
    logger.success('Database schema created');
  } else {
    logger.debug('Using existing database');
  }

  return db;
}

function createSchema(db: Database.Database) {
  // Create emails table
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      normalized_markdown TEXT,
      status TEXT NOT NULL,
      publish_date TEXT,
      creation_date TEXT NOT NULL,
      modification_date TEXT NOT NULL,
      slug TEXT,
      description TEXT,
      image_url TEXT,
      canonical_url TEXT,
      email_type TEXT,
      secondary_id INTEGER,
      absolute_url TEXT,
      metadata TEXT,
      featured INTEGER DEFAULT 0,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_emails_modification_date 
      ON emails(modification_date);
    
    CREATE INDEX IF NOT EXISTS idx_emails_publish_date 
      ON emails(publish_date);
    
    CREATE INDEX IF NOT EXISTS idx_emails_status 
      ON emails(status);
    
    CREATE INDEX IF NOT EXISTS idx_emails_secondary_id 
      ON emails(secondary_id);
  `);

  // Create attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      local_path TEXT,
      creation_date TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      synced_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_name 
      ON attachments(name);
  `);

  // Create email_attachments junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_attachments (
      email_id TEXT NOT NULL,
      attachment_id TEXT NOT NULL,
      PRIMARY KEY (email_id, attachment_id),
      FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
      FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
    );
  `);

  // Create embedded_images table (for images in email HTML)
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

  // Create sync_metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Initialize sync metadata
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO sync_metadata (key, value, updated_at) 
    VALUES (?, ?, ?)
  `
  ).run('schema_version', '3', now);

  db.prepare(
    `
    INSERT INTO sync_metadata (key, value, updated_at) 
    VALUES (?, ?, ?)
  `
  ).run('last_sync_status', 'never', now);
}

export function getDatabaseStats(db: Database.Database): {
  totalEmails: number;
  totalAttachments: number;
  lastSyncDate?: string;
  lastSyncStatus: string;
} {
  const totalEmails = db
    .prepare('SELECT COUNT(*) as count FROM emails')
    .get() as { count: number };
  const totalAttachments = db
    .prepare('SELECT COUNT(*) as count FROM attachments')
    .get() as { count: number };

  const lastSyncDateRow = db
    .prepare('SELECT value FROM sync_metadata WHERE key = ?')
    .get('last_sync_date') as { value: string } | undefined;

  const lastSyncStatusRow = db
    .prepare('SELECT value FROM sync_metadata WHERE key = ?')
    .get('last_sync_status') as { value: string };

  return {
    totalEmails: totalEmails.count,
    totalAttachments: totalAttachments.count,
    lastSyncDate: lastSyncDateRow?.value,
    lastSyncStatus: lastSyncStatusRow.value,
  };
}
