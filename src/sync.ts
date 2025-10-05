/**
 * Sync orchestration - fetches emails and attachments from Buttondown
 */

import { ButtondownClient } from './api/client.js';
import { DatabaseQueries } from './db/queries.js';
import { logger } from './utils/logger.js';
import type { Email } from './api/types.js';
import type Database from 'better-sqlite3';

export interface SyncOptions {
  full?: boolean; // Force full sync (ignore last sync date)
  dryRun?: boolean; // Don't write to database
  verbose?: boolean; // Verbose logging
}

export class SyncEngine {
  private client: ButtondownClient;
  private queries: DatabaseQueries;

  constructor(client: ButtondownClient, db: Database.Database) {
    this.client = client;
    this.queries = new DatabaseQueries(db);
  }

  /**
   * Run the sync process
   */
  async sync(options: SyncOptions = {}): Promise<void> {
    const { full = false, dryRun = false, verbose = false } = options;

    if (verbose) {
      logger.debug('Starting sync with options:', options);
    }

    try {
      // Update status to in_progress
      if (!dryRun) {
        this.queries.updateSyncMetadata('last_sync_status', 'in_progress');
      }

      // Determine sync strategy
      const lastSyncDate = full ? undefined : this.queries.getLastSyncDate();

      if (lastSyncDate) {
        logger.info(`Starting incremental sync (since ${lastSyncDate})...`);
      } else {
        logger.info('Starting full sync (this may take a while)...');
      }

      // Fetch and sync emails
      const emailCount = await this.syncEmails(lastSyncDate, dryRun);

      logger.success(`Synced ${emailCount} emails`);

      // Update sync metadata
      if (!dryRun) {
        const now = new Date().toISOString();
        this.queries.updateSyncMetadata('last_sync_date', now);
        this.queries.updateSyncMetadata('last_sync_status', 'success');
        this.queries.updateSyncMetadata(
          'total_emails_synced',
          String(emailCount)
        );
      }

      logger.success('Sync completed successfully');
    } catch (error) {
      logger.error('Sync failed:', error);

      if (!dryRun) {
        this.queries.updateSyncMetadata('last_sync_status', 'error');
      }

      throw error;
    }
  }

  /**
   * Sync emails from Buttondown
   */
  private async syncEmails(since?: string, dryRun = false): Promise<number> {
    let count = 0;
    let processedCount = 0;

    const params = since
      ? { modification_date__start: since.split('T')[0] }
      : {};

    logger.info('Fetching emails from Buttondown...');

    for await (const email of this.client.fetchAllEmails(params)) {
      count++;

      if (count % 10 === 0) {
        logger.info(`Fetched ${count} emails...`);
      }

      if (!dryRun) {
        await this.processEmail(email);
        processedCount++;
      }
    }

    return dryRun ? count : processedCount;
  }

  /**
   * Process a single email (upsert and handle attachments)
   */
  private async processEmail(email: Email): Promise<void> {
    // Use transaction for atomicity
    this.queries.transaction(() => {
      // Upsert the email
      this.queries.upsertEmail(email);

      // Handle attachments if present
      if (email.attachments && email.attachments.length > 0) {
        this.syncEmailAttachments(email.id, email.attachments);
      }
    });
  }

  /**
   * Sync attachments for an email
   */
  private syncEmailAttachments(emailId: string, attachmentIds: string[]): void {
    for (const attachmentId of attachmentIds) {
      try {
        // Check if we already have this attachment
        const existing = this.queries.getAttachment(attachmentId);

        if (!existing) {
          logger.debug(
            `Attachment ${attachmentId} not in database, will be synced later`
          );
          // Note: We'll sync all attachments in a separate pass if needed
          // For now, just create the link
        }

        // Link email to attachment
        this.queries.linkEmailAttachment(emailId, attachmentId);
      } catch (error) {
        logger.warn(`Failed to process attachment ${attachmentId}:`, error);
      }
    }
  }

  /**
   * Sync all attachments from Buttondown
   * This can be run separately to backfill attachment metadata
   */
  async syncAttachments(dryRun = false): Promise<number> {
    let count = 0;

    logger.info('Fetching attachments from Buttondown...');

    for await (const attachment of this.client.fetchAllAttachments()) {
      count++;

      if (count % 10 === 0) {
        logger.info(`Fetched ${count} attachments...`);
      }

      if (!dryRun) {
        this.queries.upsertAttachment(attachment);
      }
    }

    logger.success(`Synced ${count} attachments`);
    return count;
  }
}
