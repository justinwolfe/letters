/**
 * Database queries and operations
 */

import Database from 'better-sqlite3';
import type { Email, Attachment } from '../api/types.js';
import { logger } from '../utils/logger.js';
import type { EmbeddedImage } from '../utils/image-processor.js';
import { imageToDataUri } from '../utils/image-processor.js';

export class DatabaseQueries {
  constructor(private db: Database.Database) {}

  /**
   * Upsert an email (insert or update if exists)
   */
  upsertEmail(email: Email, normalizedMarkdown?: string): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO emails (
        id, subject, body, normalized_markdown, status, publish_date,
        creation_date, modification_date, slug, description,
        image_url, canonical_url, email_type, secondary_id,
        absolute_url, metadata, featured, synced_at
      ) VALUES (
        @id, @subject, @body, @normalized_markdown, @status, @publish_date,
        @creation_date, @modification_date, @slug, @description,
        @image_url, @canonical_url, @email_type, @secondary_id,
        @absolute_url, @metadata, @featured, @synced_at
      )
      ON CONFLICT(id) DO UPDATE SET
        subject = excluded.subject,
        body = excluded.body,
        normalized_markdown = excluded.normalized_markdown,
        status = excluded.status,
        publish_date = excluded.publish_date,
        modification_date = excluded.modification_date,
        slug = excluded.slug,
        description = excluded.description,
        image_url = excluded.image_url,
        canonical_url = excluded.canonical_url,
        email_type = excluded.email_type,
        secondary_id = excluded.secondary_id,
        absolute_url = excluded.absolute_url,
        metadata = excluded.metadata,
        featured = excluded.featured,
        synced_at = excluded.synced_at
      WHERE emails.modification_date <= excluded.modification_date
    `);

    stmt.run({
      id: email.id,
      subject: email.subject,
      body: email.body,
      normalized_markdown: normalizedMarkdown || null,
      status: email.status,
      publish_date: email.publish_date || null,
      creation_date: email.creation_date,
      modification_date: email.modification_date,
      slug: email.slug || null,
      description: email.description,
      image_url: email.image,
      canonical_url: email.canonical_url,
      email_type: email.email_type || 'public',
      secondary_id: email.secondary_id || null,
      absolute_url: email.absolute_url,
      metadata: email.metadata ? JSON.stringify(email.metadata) : null,
      featured: email.featured ? 1 : 0,
      synced_at: now,
    });

    logger.debug(`Upserted email: ${email.subject} (${email.id})`);
  }

  /**
   * Upsert an attachment
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
   */
  getAttachment(id: string): Attachment | undefined {
    const stmt = this.db.prepare(`
      SELECT id, name, file_url as file, creation_date
      FROM attachments
      WHERE id = ?
    `);

    return stmt.get(id) as Attachment | undefined;
  }

  /**
   * Check if an email exists
   */
  emailExists(id: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM emails WHERE id = ? LIMIT 1');
    return stmt.get(id) !== undefined;
  }

  /**
   * Get the last sync date
   */
  getLastSyncDate(): string | undefined {
    const stmt = this.db.prepare(`
      SELECT value FROM sync_metadata WHERE key = ?
    `);

    const row = stmt.get('last_sync_date') as { value: string } | undefined;
    return row?.value;
  }

  /**
   * Update sync metadata
   */
  updateSyncMetadata(key: string, value: string): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    stmt.run(key, value, now);
  }

  /**
   * Get all emails (for export/debugging)
   */
  getAllEmails(): any[] {
    return this.db
      .prepare('SELECT * FROM emails ORDER BY publish_date DESC')
      .all();
  }

  /**
   * Transaction wrapper
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }

  /**
   * Store an embedded image
   */
  storeEmbeddedImage(emailId: string, image: EmbeddedImage): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO embedded_images (
        email_id, original_url, image_data, mime_type, file_size,
        width, height, downloaded_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(email_id, original_url) DO UPDATE SET
        image_data = excluded.image_data,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        width = excluded.width,
        height = excluded.height,
        downloaded_at = excluded.downloaded_at
    `);

    stmt.run(
      emailId,
      image.url,
      image.data,
      image.mimeType,
      image.fileSize,
      image.width || null,
      image.height || null,
      now
    );

    logger.debug(
      `Stored embedded image: ${image.url} (${image.fileSize} bytes)`
    );
  }

  /**
   * Get all embedded images for an email
   */
  getEmbeddedImages(emailId: string): Array<{
    id: number;
    original_url: string;
    image_data: Buffer;
    mime_type: string;
    file_size: number;
    width?: number;
    height?: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, original_url, image_data, mime_type, file_size, width, height
      FROM embedded_images
      WHERE email_id = ?
    `);

    return stmt.all(emailId) as any[];
  }

  /**
   * Get an email with embedded images replaced by data URIs
   */
  getEmailWithLocalImages(emailId: string): {
    email: any;
    body: string;
  } | null {
    // Get the email
    const emailStmt = this.db.prepare('SELECT * FROM emails WHERE id = ?');
    const email = emailStmt.get(emailId) as any;

    if (!email) {
      return null;
    }

    // Get embedded images
    const images = this.getEmbeddedImages(emailId);

    // Create a map of URL -> data URI
    const imageMap = new Map<string, string>();
    for (const img of images) {
      const dataUri = imageToDataUri(img.image_data, img.mime_type);
      imageMap.set(img.original_url, dataUri);
    }

    // Replace URLs in the body
    let body = email.body as string;
    for (const [originalUrl, dataUri] of imageMap.entries()) {
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(new RegExp(escapedUrl, 'g'), dataUri);
    }

    return {
      email,
      body,
    };
  }

  /**
   * Count embedded images for an email
   */
  countEmbeddedImages(emailId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM embedded_images
      WHERE email_id = ?
    `);

    const result = stmt.get(emailId) as { count: number };
    return result.count;
  }

  /**
   * Get total size of embedded images for an email
   */
  getEmbeddedImagesSize(emailId: string): number {
    const stmt = this.db.prepare(`
      SELECT SUM(file_size) as total
      FROM embedded_images
      WHERE email_id = ?
    `);

    const result = stmt.get(emailId) as { total: number | null };
    return result.total || 0;
  }

  /**
   * Update normalized markdown for an email
   */
  updateNormalizedMarkdown(emailId: string, normalizedMarkdown: string): void {
    const stmt = this.db.prepare(`
      UPDATE emails
      SET normalized_markdown = ?
      WHERE id = ?
    `);

    stmt.run(normalizedMarkdown, emailId);
  }

  /**
   * Get emails without normalized markdown
   */
  getEmailsWithoutNormalizedMarkdown(limit?: number): any[] {
    const query = limit
      ? 'SELECT * FROM emails WHERE normalized_markdown IS NULL LIMIT ?'
      : 'SELECT * FROM emails WHERE normalized_markdown IS NULL';

    return limit
      ? this.db.prepare(query).all(limit)
      : this.db.prepare(query).all();
  }

  /**
   * Count emails without normalized markdown
   */
  countEmailsWithoutNormalizedMarkdown(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM emails
      WHERE normalized_markdown IS NULL
    `);

    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Get all emails with their embedded image counts
   */
  getEmailsWithImageStats(): Array<{
    id: string;
    subject: string;
    image_count: number;
    total_size: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        e.id,
        e.subject,
        COUNT(ei.id) as image_count,
        COALESCE(SUM(ei.file_size), 0) as total_size
      FROM emails e
      LEFT JOIN embedded_images ei ON e.id = ei.email_id
      GROUP BY e.id, e.subject
      HAVING image_count > 0
      ORDER BY total_size DESC
    `);

    return stmt.all() as any[];
  }
}
