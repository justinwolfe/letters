/**
 * Attachment-related database queries
 */

import Database from 'better-sqlite3';
import type { Attachment } from '../../api/types.js';
import { logger } from '../../utils/logger.js';

export class AttachmentQueries {
  constructor(private db: Database.Database) {}

  /**
   * Upsert an attachment (insert or update if exists)
   *
   * @param attachment - The attachment object to upsert
   *
   * @example
   * ```typescript
   * queries.attachments.upsertAttachment({
   *   id: 'att-123',
   *   name: 'document.pdf',
   *   file: 'https://example.com/file.pdf',
   *   creation_date: '2024-01-01T00:00:00Z'
   * });
   * ```
   */
  upsertAttachment(attachment: Attachment): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO attachments (
        id, name, file_url, creation_date, synced_at
      ) VALUES (
        @id, @name, @file_url, @creation_date, @synced_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        file_url = excluded.file_url,
        synced_at = excluded.synced_at
    `);

    stmt.run({
      id: attachment.id,
      name: attachment.name,
      file_url: attachment.file,
      creation_date: attachment.creation_date,
      synced_at: now,
    });

    logger.debug(`Upserted attachment: ${attachment.name} (${attachment.id})`);
  }

  /**
   * Link an email to an attachment
   *
   * @param emailId - The email ID
   * @param attachmentId - The attachment ID
   *
   * @example
   * ```typescript
   * queries.attachments.linkEmailAttachment('email-123', 'att-456');
   * ```
   */
  linkEmailAttachment(emailId: string, attachmentId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO email_attachments (email_id, attachment_id)
      VALUES (?, ?)
    `);

    stmt.run(emailId, attachmentId);
  }

  /**
   * Get all attachment IDs for an email
   *
   * @param emailId - The email ID to get attachments for
   * @returns Array of attachment IDs
   *
   * @example
   * ```typescript
   * const attachmentIds = queries.attachments.getEmailAttachments('email-123');
   * console.log(`Email has ${attachmentIds.length} attachments`);
   * ```
   */
  getEmailAttachments(emailId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT attachment_id FROM email_attachments
      WHERE email_id = ?
    `);

    const rows = stmt.all(emailId) as { attachment_id: string }[];
    return rows.map((row) => row.attachment_id);
  }

  /**
   * Get an attachment by ID
   *
   * @param id - The attachment ID to retrieve
   * @returns The attachment data, or undefined if not found
   *
   * @example
   * ```typescript
   * const attachment = queries.attachments.getAttachment('att-123');
   * if (attachment) {
   *   console.log(`Attachment: ${attachment.name}`);
   * }
   * ```
   */
  getAttachment(id: string): Attachment | undefined {
    const stmt = this.db.prepare(`
      SELECT id, name, file_url as file, creation_date
      FROM attachments
      WHERE id = ?
    `);

    return stmt.get(id) as Attachment | undefined;
  }
}
