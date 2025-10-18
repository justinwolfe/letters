/**
 * Database queries organized by domain
 *
 * This module provides a facade for all database operations, organized into
 * domain-specific query classes for better code organization and maintainability.
 *
 * @example
 * ```typescript
 * import { initializeDatabase } from '../lib/db/schema.js';
 * import { DatabaseQueries } from '../lib/db/queries/index.js';
 *
 * const db = initializeDatabase();
 * const queries = new DatabaseQueries(db);
 *
 * // Email operations
 * queries.emails.upsertEmail(emailData);
 * const allEmails = queries.emails.getAllEmails();
 *
 * // Image operations
 * const imageId = queries.images.storeEmbeddedImage(emailId, imageData);
 * const images = queries.images.getEmbeddedImages(emailId);
 *
 * // Attachment operations
 * queries.attachments.upsertAttachment(attachmentData);
 * queries.attachments.linkEmailAttachment(emailId, attachmentId);
 *
 * // Metadata operations
 * const lastSync = queries.metadata.getLastSyncDate();
 *
 * // Transactions
 * queries.transaction(() => {
 *   queries.emails.upsertEmail(email);
 *   queries.images.storeEmbeddedImage(emailId, image);
 * });
 * ```
 */

import Database from 'better-sqlite3';
import { EmailQueries } from './emails.js';
import { ImageQueries } from './images.js';
import { AttachmentQueries } from './attachments.js';
import { MetadataQueries } from './metadata.js';

/**
 * Main database queries facade with domain-specific query classes
 */
export class DatabaseQueries {
  public emails: EmailQueries;
  public images: ImageQueries;
  public attachments: AttachmentQueries;
  public metadata: MetadataQueries;

  constructor(private db: Database.Database) {
    this.emails = new EmailQueries(db);
    this.images = new ImageQueries(db);
    this.attachments = new AttachmentQueries(db);
    this.metadata = new MetadataQueries(db);
  }

  /**
   * Transaction wrapper for atomic operations
   *
   * Executes a function within a database transaction. If the function throws
   * an error, the transaction is rolled back automatically.
   *
   * @param fn - Function to execute within transaction
   * @returns The return value of the function
   *
   * @example
   * ```typescript
   * queries.transaction(() => {
   *   queries.emails.upsertEmail(email);
   *   queries.attachments.linkEmailAttachment(emailId, attachmentId);
   * });
   * ```
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }
}

// Re-export domain classes for direct use if needed
export { EmailQueries } from './emails.js';
export { ImageQueries } from './images.js';
export { AttachmentQueries } from './attachments.js';
export { MetadataQueries } from './metadata.js';
