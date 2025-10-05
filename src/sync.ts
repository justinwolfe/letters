/**
 * Sync orchestration - fetches emails and attachments from Buttondown
 */

import { ButtondownClient } from './api/client.js';
import { DatabaseQueries } from './db/queries.js';
import { logger } from './utils/logger.js';
import { downloadAllImages } from './utils/image-processor.js';
import type { Email } from './api/types.js';
import type Database from 'better-sqlite3';

export interface SyncOptions {
  full?: boolean; // Force full sync (ignore last sync date)
  dryRun?: boolean; // Don't write to database
  verbose?: boolean; // Verbose logging
  downloadImages?: boolean; // Download and store embedded images
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
    const {
      full = false,
      dryRun = false,
      verbose = false,
      downloadImages = false,
    } = options;

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
      const emailCount = await this.syncEmails(
        lastSyncDate,
        dryRun,
        downloadImages
      );

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
  private async syncEmails(
    since?: string,
    dryRun = false,
    downloadImages = false
  ): Promise<number> {
    let count = 0;
    let processedCount = 0;

    // Include multiple statuses to catch sent, imported, and draft emails
    // By default, the API only returns 'sent' emails
    const params = since
      ? {
          modification_date__start: since.split('T')[0],
          status: ['sent', 'imported', 'draft'] as any,
        }
      : {
          status: ['sent', 'imported', 'draft'] as any,
        };

    logger.info(
      'Fetching emails from Buttondown (including sent, imported, and draft)...'
    );

    for await (const email of this.client.fetchAllEmails(params)) {
      count++;

      if (count % 10 === 0) {
        logger.info(`Fetched ${count} emails...`);
      }

      if (!dryRun) {
        await this.processEmail(email, downloadImages);
        processedCount++;
      }
    }

    return dryRun ? count : processedCount;
  }

  /**
   * Process a single email (upsert and handle attachments)
   */
  private async processEmail(
    email: Email,
    downloadImages = false
  ): Promise<void> {
    // Use transaction for atomicity
    this.queries.transaction(() => {
      // Upsert the email
      this.queries.upsertEmail(email);

      // Handle attachments if present
      if (email.attachments && email.attachments.length > 0) {
        this.syncEmailAttachments(email.id, email.attachments);
      }
    });

    // Download embedded images if requested (outside transaction for async)
    if (downloadImages) {
      await this.downloadEmailImages(email.id, email.body);
    }
  }

  /**
   * Download and store embedded images from email HTML
   */
  private async downloadEmailImages(
    emailId: string,
    htmlBody: string
  ): Promise<void> {
    try {
      // Check if we already have images for this email
      const existingCount = this.queries.countEmbeddedImages(emailId);
      if (existingCount > 0) {
        logger.debug(
          `Email ${emailId} already has ${existingCount} images, skipping`
        );
        return;
      }

      // Download all images
      const images = await downloadAllImages(htmlBody);

      if (images.size === 0) {
        return;
      }

      // Store images in database
      this.queries.transaction(() => {
        for (const image of images.values()) {
          this.queries.storeEmbeddedImage(emailId, image);
        }
      });

      logger.info(`Stored ${images.size} embedded images for email ${emailId}`);
    } catch (error) {
      logger.warn(`Failed to download images for email ${emailId}:`, error);
    }
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

  /**
   * Download embedded images for all existing emails
   * This can be run separately to backfill images for existing emails
   */
  async downloadImagesForExistingEmails(dryRun = false): Promise<void> {
    logger.info('Downloading embedded images for existing emails...');

    // Get all emails
    const emails = this.queries.getAllEmails();
    logger.info(`Found ${emails.length} emails to process`);

    let processedCount = 0;
    let totalImagesDownloaded = 0;

    for (const email of emails) {
      // Check if this email already has images
      const existingCount = this.queries.countEmbeddedImages(email.id);
      if (existingCount > 0) {
        logger.debug(
          `Email ${email.id} already has ${existingCount} images, skipping`
        );
        continue;
      }

      processedCount++;
      logger.info(
        `[${processedCount}/${emails.length}] Processing: ${email.subject}`
      );

      if (!dryRun) {
        try {
          const images = await downloadAllImages(email.body);

          if (images.size > 0) {
            this.queries.transaction(() => {
              for (const image of images.values()) {
                this.queries.storeEmbeddedImage(email.id, image);
              }
            });

            totalImagesDownloaded += images.size;
            logger.success(
              `  ✓ Downloaded ${images.size} images for "${email.subject}"`
            );
          } else {
            logger.debug(`  No images found in "${email.subject}"`);
          }
        } catch (error) {
          logger.warn(`  ✗ Failed to process "${email.subject}":`, error);
        }
      }
    }

    if (!dryRun) {
      logger.success(
        `Downloaded ${totalImagesDownloaded} images for ${processedCount} emails`
      );
    } else {
      logger.info(`Would process ${processedCount} emails (dry run)`);
    }
  }
}
