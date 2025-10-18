/**
 * Image-related database queries
 */

import Database from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import type { EmbeddedImage } from '../../utils/image-processor.js';

export class ImageQueries {
  constructor(private db: Database.Database) {}

  /**
   * Store an embedded image and return its ID
   *
   * @param emailId - The email ID this image belongs to
   * @param image - The embedded image data
   * @returns The ID of the stored image
   *
   * @example
   * ```typescript
   * const imageId = queries.images.storeEmbeddedImage('email-123', {
   *   url: 'https://example.com/image.jpg',
   *   data: buffer,
   *   mimeType: 'image/jpeg',
   *   fileSize: 12345
   * });
   * ```
   */
  storeEmbeddedImage(emailId: string, image: EmbeddedImage): number {
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
      RETURNING id
    `);

    const result = stmt.get(
      emailId,
      image.url,
      image.data,
      image.mimeType,
      image.fileSize,
      image.width || null,
      image.height || null,
      now
    ) as { id: number };

    logger.debug(
      `Stored embedded image: ${image.url} (${image.fileSize} bytes) - ID: ${result.id}`
    );

    return result.id;
  }

  /**
   * Get all embedded images for an email
   *
   * @param emailId - The email ID to get images for
   * @returns Array of embedded images with their metadata
   *
   * @example
   * ```typescript
   * const images = queries.images.getEmbeddedImages('email-123');
   * images.forEach(img => console.log(img.original_url));
   * ```
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
   * Get a single embedded image by ID
   *
   * @param id - The image ID to retrieve
   * @returns The image data, or undefined if not found
   *
   * @example
   * ```typescript
   * const image = queries.images.getEmbeddedImageById(123);
   * if (image) {
   *   res.setHeader('Content-Type', image.mime_type);
   *   res.send(image.image_data);
   * }
   * ```
   */
  getEmbeddedImageById(id: number):
    | {
        id: number;
        email_id: string;
        original_url: string;
        image_data: Buffer;
        mime_type: string;
        file_size: number;
        width?: number;
        height?: number;
      }
    | undefined {
    const stmt = this.db.prepare(`
      SELECT id, email_id, original_url, image_data, mime_type, file_size, width, height
      FROM embedded_images
      WHERE id = ?
    `);

    return stmt.get(id) as any;
  }

  /**
   * Count embedded images for an email
   *
   * @param emailId - The email ID to count images for
   * @returns Number of images in the email
   *
   * @example
   * ```typescript
   * const count = queries.images.countEmbeddedImages('email-123');
   * console.log(`Email has ${count} images`);
   * ```
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
   *
   * @param emailId - The email ID to calculate size for
   * @returns Total size in bytes
   *
   * @example
   * ```typescript
   * const bytes = queries.images.getEmbeddedImagesSize('email-123');
   * const mb = bytes / 1024 / 1024;
   * console.log(`Images total: ${mb.toFixed(2)} MB`);
   * ```
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
   * Get all embedded images (for bulk operations)
   *
   * @returns Array of all embedded images, ordered by size (largest first)
   *
   * @example
   * ```typescript
   * const allImages = queries.images.getAllEmbeddedImages();
   * console.log(`Total images: ${allImages.length}`);
   * ```
   */
  getAllEmbeddedImages(): Array<{
    id: number;
    email_id: string;
    original_url: string;
    mime_type: string;
    file_size: number;
    width?: number;
    height?: number;
    downloaded_at: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, email_id, original_url, mime_type, file_size, width, height, downloaded_at
      FROM embedded_images
      ORDER BY file_size DESC
    `);

    return stmt.all() as any[];
  }

  /**
   * Get large images (over a certain size threshold)
   *
   * @param minSizeBytes - Minimum size in bytes (default: 1MB)
   * @returns Array of large images with email context
   *
   * @example
   * ```typescript
   * // Get all images over 2MB
   * const largeImages = queries.images.getLargeImages(2 * 1024 * 1024);
   * largeImages.forEach(img => {
   *   console.log(`${img.email_subject}: ${img.file_size} bytes`);
   * });
   * ```
   */
  getLargeImages(minSizeBytes: number = 1000000): Array<{
    id: number;
    email_id: string;
    email_subject: string;
    original_url: string;
    mime_type: string;
    file_size: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        ei.id,
        ei.email_id,
        e.subject as email_subject,
        ei.original_url,
        ei.mime_type,
        ei.file_size
      FROM embedded_images ei
      JOIN emails e ON ei.email_id = e.id
      WHERE ei.file_size > ?
      ORDER BY ei.file_size DESC
    `);

    return stmt.all(minSizeBytes) as any[];
  }

  /**
   * Get images by mime type
   *
   * @param mimeType - The mime type to filter by (e.g., 'image/jpeg')
   * @returns Array of images matching the mime type
   *
   * @example
   * ```typescript
   * const pngImages = queries.images.getImagesByType('image/png');
   * console.log(`Found ${pngImages.length} PNG images`);
   * ```
   */
  getImagesByType(mimeType: string): Array<{
    id: number;
    email_id: string;
    email_subject: string;
    file_size: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        ei.id,
        ei.email_id,
        e.subject as email_subject,
        ei.file_size
      FROM embedded_images ei
      JOIN emails e ON ei.email_id = e.id
      WHERE ei.mime_type = ?
      ORDER BY ei.file_size DESC
    `);

    return stmt.all(mimeType) as any[];
  }

  /**
   * Delete an embedded image by ID
   *
   * @param id - The image ID to delete
   *
   * @example
   * ```typescript
   * queries.images.deleteEmbeddedImage(123);
   * ```
   */
  deleteEmbeddedImage(id: number): void {
    const stmt = this.db.prepare('DELETE FROM embedded_images WHERE id = ?');
    stmt.run(id);
    logger.info(`Deleted embedded image: ${id}`);
  }

  /**
   * Get total storage used by embedded images
   *
   * @returns Object with image count and storage statistics
   *
   * @example
   * ```typescript
   * const stats = queries.images.getTotalImageStorage();
   * console.log(`Total: ${stats.total_images} images (${stats.total_mb.toFixed(2)} MB)`);
   * ```
   */
  getTotalImageStorage(): {
    total_images: number;
    total_bytes: number;
    total_mb: number;
  } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_images,
        SUM(file_size) as total_bytes
      FROM embedded_images
    `);

    const result = stmt.get() as { total_images: number; total_bytes: number };

    return {
      total_images: result.total_images,
      total_bytes: result.total_bytes || 0,
      total_mb: (result.total_bytes || 0) / 1024 / 1024,
    };
  }

  /**
   * Get statistics about emails with embedded images
   *
   * @returns Array of emails with image count and total size
   *
   * @example
   * ```typescript
   * const stats = queries.images.getEmailsWithImageStats();
   * stats.forEach(email => {
   *   console.log(`${email.subject}: ${email.image_count} images, ${email.total_size} bytes`);
   * });
   * ```
   */
  getEmailsWithImageStats(): Array<{
    email_id: string;
    subject: string;
    image_count: number;
    total_size: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT 
        e.id as email_id,
        e.subject,
        COUNT(ei.id) as image_count,
        COALESCE(SUM(ei.file_size), 0) as total_size
      FROM emails e
      INNER JOIN embedded_images ei ON e.id = ei.email_id
      GROUP BY e.id, e.subject
      ORDER BY total_size DESC
    `);

    return stmt.all() as any[];
  }
}
