/**
 * Email-related database queries
 */

import Database from 'better-sqlite3';
import type { Email } from '../../api/types.js';
import { logger } from '../../utils/logger.js';

export class EmailQueries {
  constructor(private db: Database.Database) {}

  /**
   * Upsert an email (insert or update if exists)
   *
   * @param email - The email object to upsert
   * @param normalizedMarkdown - Optional normalized markdown content
   *
   * @example
   * ```typescript
   * queries.emails.upsertEmail(emailData, markdownContent);
   * ```
   */
  upsertEmail(
    email: Email,
    normalizedMarkdown?: string,
    author?: string | null
  ): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO emails (
        id, subject, body, normalized_markdown, status, publish_date,
        creation_date, modification_date, slug, description,
        image_url, canonical_url, email_type, secondary_id,
        absolute_url, metadata, featured, author, synced_at
      ) VALUES (
        @id, @subject, @body, @normalized_markdown, @status, @publish_date,
        @creation_date, @modification_date, @slug, @description,
        @image_url, @canonical_url, @email_type, @secondary_id,
        @absolute_url, @metadata, @featured, @author, @synced_at
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
        author = COALESCE(excluded.author, emails.author),
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
      author: author !== undefined ? author : null,
      synced_at: now,
    });

    logger.debug(`Upserted email: ${email.subject} (${email.id})`);
  }

  /**
   * Check if an email exists in the database
   *
   * @param id - The email ID to check
   * @returns True if the email exists, false otherwise
   *
   * @example
   * ```typescript
   * if (queries.emails.emailExists('email-123')) {
   *   // Email exists
   * }
   * ```
   */
  emailExists(id: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM emails WHERE id = ? LIMIT 1');
    return stmt.get(id) !== undefined;
  }

  /**
   * Get all emails ordered by publish date (newest first)
   *
   * @returns Array of all emails in the database
   *
   * @example
   * ```typescript
   * const emails = queries.emails.getAllEmails();
   * ```
   */
  getAllEmails(): any[] {
    return this.db
      .prepare('SELECT * FROM emails ORDER BY publish_date DESC')
      .all();
  }

  /**
   * Get an email with local image references
   *
   * @param emailId - The email ID to retrieve
   * @returns Email data with body content, or null if not found
   *
   * @example
   * ```typescript
   * const result = queries.emails.getEmailWithLocalImages('email-123');
   * if (result) {
   *   console.log(result.email.subject);
   * }
   * ```
   */
  getEmailWithLocalImages(emailId: string): {
    email: any;
    body: string;
  } | null {
    const emailStmt = this.db.prepare('SELECT * FROM emails WHERE id = ?');
    const email = emailStmt.get(emailId) as any;

    if (!email) {
      return null;
    }

    return {
      email,
      body: email.normalized_markdown || email.body,
    };
  }

  /**
   * Update normalized markdown for an email
   *
   * @param emailId - The email ID to update
   * @param normalizedMarkdown - The normalized markdown content
   *
   * @example
   * ```typescript
   * queries.emails.updateNormalizedMarkdown('email-123', '# Heading\n\nContent...');
   * ```
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
   * Get emails that don't have normalized markdown content
   *
   * @param limit - Optional limit on number of results
   * @returns Array of emails without normalized markdown
   *
   * @example
   * ```typescript
   * const emails = queries.emails.getEmailsWithoutNormalizedMarkdown(10);
   * ```
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
   *
   * @returns Number of emails missing normalized markdown
   *
   * @example
   * ```typescript
   * const count = queries.emails.countEmailsWithoutNormalizedMarkdown();
   * console.log(`${count} emails need processing`);
   * ```
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
   * Get all emails with their embedded image statistics
   *
   * @returns Array of emails with image counts and total sizes
   *
   * @example
   * ```typescript
   * const stats = queries.emails.getEmailsWithImageStats();
   * stats.forEach(email => {
   *   console.log(`${email.subject}: ${email.image_count} images`);
   * });
   * ```
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

  /**
   * Update the author field for an email
   *
   * @param emailId - The email ID to update
   * @param author - The author name or identifier (null for primary author)
   *
   * @example
   * ```typescript
   * queries.emails.updateAuthor('email-123', 'L');
   * queries.emails.updateAuthor('email-456', null); // Primary author
   * ```
   */
  updateAuthor(emailId: string, author: string | null): void {
    const stmt = this.db.prepare(`
      UPDATE emails
      SET author = ?
      WHERE id = ?
    `);

    stmt.run(author, emailId);
    logger.debug(`Updated author for email ${emailId}: ${author || 'primary'}`);
  }

  /**
   * Get emails by author
   *
   * @param author - The author name/identifier (null for primary author)
   * @returns Array of emails by the specified author
   *
   * @example
   * ```typescript
   * const lEmails = queries.emails.getEmailsByAuthor('L');
   * const primaryEmails = queries.emails.getEmailsByAuthor(null);
   * ```
   */
  getEmailsByAuthor(author: string | null): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM emails
      WHERE author IS ? 
      ORDER BY publish_date DESC
    `);

    return stmt.all(author);
  }

  /**
   * Get all unique authors
   *
   * @returns Array of author names with counts
   *
   * @example
   * ```typescript
   * const authors = queries.emails.getAllAuthors();
   * authors.forEach(a => {
   *   console.log(`${a.author || 'Primary'}: ${a.count} letters`);
   * });
   * ```
   */
  getAllAuthors(): Array<{ author: string | null; count: number }> {
    const stmt = this.db.prepare(`
      SELECT author, COUNT(*) as count
      FROM emails
      GROUP BY author
      ORDER BY count DESC
    `);

    return stmt.all() as any[];
  }
}
