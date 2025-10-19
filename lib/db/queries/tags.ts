/**
 * Tag-related database queries
 */

import Database from 'better-sqlite3';
import { logger } from '../../utils/logger.js';

export interface Tag {
  id: number;
  name: string;
  normalized_name: string;
  created_at: string;
}

export interface TagWithCount extends Tag {
  email_count: number;
}

export class TagQueries {
  constructor(private db: Database.Database) {}

  /**
   * Normalize a tag name for consistent storage and matching
   * - Converts to lowercase
   * - Trims whitespace
   * - Removes extra spaces
   * - Removes special characters except hyphens and underscores
   *
   * @param tagName - The raw tag name to normalize
   * @returns The normalized tag name
   *
   * @example
   * ```typescript
   * const normalized = queries.tags.normalizeTagName('Machine Learning');
   * // Returns: 'machine-learning'
   * ```
   */
  normalizeTagName(tagName: string): string {
    return tagName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get or create a tag by name
   * If the tag already exists (based on normalized name), returns the existing tag.
   * Otherwise, creates a new tag.
   *
   * @param tagName - The tag name (will be normalized)
   * @returns The tag object
   *
   * @example
   * ```typescript
   * const tag = queries.tags.getOrCreateTag('Machine Learning');
   * ```
   */
  getOrCreateTag(tagName: string): Tag {
    const normalized = this.normalizeTagName(tagName);
    const now = new Date().toISOString();

    // Try to find existing tag
    const existing = this.db
      .prepare('SELECT * FROM tags WHERE normalized_name = ?')
      .get(normalized) as Tag | undefined;

    if (existing) {
      return existing;
    }

    // Create new tag
    const result = this.db
      .prepare(
        `
      INSERT INTO tags (name, normalized_name, created_at)
      VALUES (?, ?, ?)
    `
      )
      .run(tagName, normalized, now);

    return {
      id: result.lastInsertRowid as number,
      name: tagName,
      normalized_name: normalized,
      created_at: now,
    };
  }

  /**
   * Add a tag to an email
   *
   * @param emailId - The email ID
   * @param tagName - The tag name (will be normalized)
   *
   * @example
   * ```typescript
   * queries.tags.addTagToEmail('email-123', 'artificial-intelligence');
   * ```
   */
  addTagToEmail(emailId: string, tagName: string): void {
    const tag = this.getOrCreateTag(tagName);

    try {
      this.db
        .prepare(
          `
        INSERT INTO email_tags (email_id, tag_id)
        VALUES (?, ?)
      `
        )
        .run(emailId, tag.id);
    } catch (error: any) {
      // Ignore duplicate key errors (tag already associated with email)
      if (!error.message.includes('UNIQUE constraint failed')) {
        throw error;
      }
    }
  }

  /**
   * Add multiple tags to an email
   *
   * @param emailId - The email ID
   * @param tagNames - Array of tag names
   *
   * @example
   * ```typescript
   * queries.tags.addTagsToEmail('email-123', ['AI', 'Machine Learning', 'Technology']);
   * ```
   */
  addTagsToEmail(emailId: string, tagNames: string[]): void {
    for (const tagName of tagNames) {
      this.addTagToEmail(emailId, tagName);
    }
    logger.debug(
      `Added ${tagNames.length} tags to email ${emailId}: ${tagNames.join(
        ', '
      )}`
    );
  }

  /**
   * Remove all tags from an email
   *
   * @param emailId - The email ID
   *
   * @example
   * ```typescript
   * queries.tags.clearEmailTags('email-123');
   * ```
   */
  clearEmailTags(emailId: string): void {
    this.db.prepare('DELETE FROM email_tags WHERE email_id = ?').run(emailId);
  }

  /**
   * Replace all tags for an email
   * Clears existing tags and adds new ones
   *
   * @param emailId - The email ID
   * @param tagNames - Array of tag names
   *
   * @example
   * ```typescript
   * queries.tags.setEmailTags('email-123', ['AI', 'Technology']);
   * ```
   */
  setEmailTags(emailId: string, tagNames: string[]): void {
    this.clearEmailTags(emailId);
    this.addTagsToEmail(emailId, tagNames);
  }

  /**
   * Get all tags for an email
   *
   * @param emailId - The email ID
   * @returns Array of tags
   *
   * @example
   * ```typescript
   * const tags = queries.tags.getEmailTags('email-123');
   * ```
   */
  getEmailTags(emailId: string): Tag[] {
    return this.db
      .prepare(
        `
      SELECT t.*
      FROM tags t
      JOIN email_tags et ON t.id = et.tag_id
      WHERE et.email_id = ?
      ORDER BY t.name
    `
      )
      .all(emailId) as Tag[];
  }

  /**
   * Get all emails with a specific tag
   *
   * @param tagName - The tag name (will be normalized)
   * @returns Array of email IDs
   *
   * @example
   * ```typescript
   * const emails = queries.tags.getEmailsByTag('machine-learning');
   * ```
   */
  getEmailsByTag(tagName: string): any[] {
    const normalized = this.normalizeTagName(tagName);

    return this.db
      .prepare(
        `
      SELECT e.*
      FROM emails e
      JOIN email_tags et ON e.id = et.email_id
      JOIN tags t ON et.tag_id = t.id
      WHERE t.normalized_name = ?
      ORDER BY e.publish_date DESC
    `
      )
      .all(normalized) as any[];
  }

  /**
   * Get all tags with email counts
   *
   * @returns Array of tags with email counts
   *
   * @example
   * ```typescript
   * const tags = queries.tags.getAllTagsWithCounts();
   * tags.forEach(tag => {
   *   console.log(`${tag.name}: ${tag.email_count} emails`);
   * });
   * ```
   */
  getAllTagsWithCounts(): TagWithCount[] {
    return this.db
      .prepare(
        `
      SELECT 
        t.*,
        COUNT(et.email_id) as email_count
      FROM tags t
      LEFT JOIN email_tags et ON t.id = et.tag_id
      GROUP BY t.id
      ORDER BY email_count DESC, t.name
    `
      )
      .all() as TagWithCount[];
  }

  /**
   * Get all tags (without counts)
   *
   * @returns Array of all tags
   *
   * @example
   * ```typescript
   * const tags = queries.tags.getAllTags();
   * ```
   */
  getAllTags(): Tag[] {
    return this.db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
  }

  /**
   * Delete a tag by ID
   * This will also remove all email associations
   *
   * @param tagId - The tag ID
   *
   * @example
   * ```typescript
   * queries.tags.deleteTag(5);
   * ```
   */
  deleteTag(tagId: number): void {
    this.db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);
    logger.debug(`Deleted tag ${tagId}`);
  }

  /**
   * Merge two tags
   * Moves all emails from sourceTag to targetTag, then deletes sourceTag
   *
   * @param sourceTagId - The tag to merge from (will be deleted)
   * @param targetTagId - The tag to merge into (will keep)
   *
   * @example
   * ```typescript
   * queries.tags.mergeTags(5, 3); // Merge tag 5 into tag 3
   * ```
   */
  mergeTags(sourceTagId: number, targetTagId: number): void {
    // Update email_tags to point to target tag
    this.db
      .prepare(
        `
      UPDATE email_tags 
      SET tag_id = ?
      WHERE tag_id = ?
      AND email_id NOT IN (
        SELECT email_id FROM email_tags WHERE tag_id = ?
      )
    `
      )
      .run(targetTagId, sourceTagId, targetTagId);

    // Delete duplicate associations
    this.db
      .prepare(
        `
      DELETE FROM email_tags
      WHERE tag_id = ?
    `
      )
      .run(sourceTagId);

    // Delete source tag
    this.deleteTag(sourceTagId);

    logger.info(
      `Merged tag ${sourceTagId} into ${targetTagId} and deleted source`
    );
  }

  /**
   * Get tags that match a pattern (useful for finding similar tags)
   *
   * @param pattern - SQL LIKE pattern
   * @returns Array of matching tags
   *
   * @example
   * ```typescript
   * const tags = queries.tags.searchTags('%machine%');
   * ```
   */
  searchTags(pattern: string): Tag[] {
    return this.db
      .prepare(
        `
      SELECT * FROM tags
      WHERE name LIKE ? OR normalized_name LIKE ?
      ORDER BY name
    `
      )
      .all(pattern, pattern) as Tag[];
  }

  /**
   * Get statistics about tags
   *
   * @returns Object with tag statistics
   *
   * @example
   * ```typescript
   * const stats = queries.tags.getTagStats();
   * console.log(`Total tags: ${stats.totalTags}`);
   * ```
   */
  getTagStats(): {
    totalTags: number;
    totalEmailTags: number;
    avgTagsPerEmail: number;
    maxTagsPerEmail: number;
  } {
    const totalTags = this.db
      .prepare('SELECT COUNT(*) as count FROM tags')
      .get() as { count: number };

    const totalEmailTags = this.db
      .prepare('SELECT COUNT(*) as count FROM email_tags')
      .get() as { count: number };

    const avgTags = this.db
      .prepare(
        `
      SELECT AVG(tag_count) as avg
      FROM (
        SELECT COUNT(*) as tag_count
        FROM email_tags
        GROUP BY email_id
      )
    `
      )
      .get() as { avg: number | null };

    const maxTags = this.db
      .prepare(
        `
      SELECT MAX(tag_count) as max
      FROM (
        SELECT COUNT(*) as tag_count
        FROM email_tags
        GROUP BY email_id
      )
    `
      )
      .get() as { max: number | null };

    return {
      totalTags: totalTags.count,
      totalEmailTags: totalEmailTags.count,
      avgTagsPerEmail: avgTags.avg || 0,
      maxTagsPerEmail: maxTags.max || 0,
    };
  }
}
