#!/usr/bin/env node
/**
 * CLI entry point for Buttondown newsletter sync
 */

import { config } from 'dotenv';
import { ButtondownClient } from './api/client.js';
import {
  initializeDatabase,
  getDatabaseStats,
  getDbPath,
} from './db/schema.js';
import { SyncEngine } from './sync.js';
import { logger, LogLevel } from './utils/logger.js';

// Load environment variables
config();

function printUsage() {
  console.log(`
Buttondown Newsletter Sync

Usage:
  npm run sync                      Run incremental sync
  npm run sync -- --full            Run full sync (re-fetch all emails)
  npm run sync -- --download-images Sync emails and download embedded images
  npm run sync -- --dry-run         Preview changes without writing
  npm run sync:status               Show sync status
  npm run sync:info                 Show database info
  
Commands:
  sync                  Sync emails (default)
  sync-attachments      Sync attachment metadata from Buttondown
  download-images       Download embedded images for existing emails
  image-stats           Show embedded image statistics
  status                Show sync status
  info                  Show database info

Options:
  --full              Force full sync (ignore last sync date)
  --download-images   Download and store embedded images from emails
  --dry-run           Preview changes without writing to database
  --verbose           Enable verbose logging
  --help              Show this help message
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sync';

  // Parse flags
  const flags = {
    full: args.includes('--full'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    downloadImages: args.includes('--download-images'),
    help: args.includes('--help'),
  };

  if (flags.verbose) {
    logger.setLevel(LogLevel.DEBUG);
  }

  if (flags.help || command === 'help') {
    printUsage();
    return;
  }

  // Check for API key
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    logger.error('BUTTONDOWN_API_KEY not found in environment');
    logger.error('Please create a .env file with your API key:');
    logger.error('  BUTTONDOWN_API_KEY=your_key_here');
    process.exit(1);
  }

  // Initialize database
  const db = initializeDatabase();

  try {
    switch (command) {
      case 'sync': {
        const client = new ButtondownClient(apiKey);
        const engine = new SyncEngine(client, db);
        await engine.sync({
          full: flags.full,
          dryRun: flags.dryRun,
          verbose: flags.verbose,
          downloadImages: flags.downloadImages,
        });
        break;
      }

      case 'sync-attachments': {
        const client = new ButtondownClient(apiKey);
        const engine = new SyncEngine(client, db);
        await engine.syncAttachments(flags.dryRun);
        break;
      }

      case 'status': {
        const stats = getDatabaseStats(db);
        console.log('\n📊 Sync Status\n');
        console.log(`  Total emails:     ${stats.totalEmails}`);
        console.log(`  Total attachments: ${stats.totalAttachments}`);
        console.log(`  Last sync:        ${stats.lastSyncDate || 'never'}`);
        console.log(`  Status:           ${stats.lastSyncStatus}`);
        console.log('');
        break;
      }

      case 'info': {
        const stats = getDatabaseStats(db);
        console.log('\n📚 Database Information\n');
        console.log(`  Database path:    ${getDbPath()}`);
        console.log(`  Total emails:     ${stats.totalEmails}`);
        console.log(`  Total attachments: ${stats.totalAttachments}`);
        console.log('');
        break;
      }

      case 'download-images': {
        const client = new ButtondownClient(apiKey);
        const engine = new SyncEngine(client, db);
        await engine.downloadImagesForExistingEmails(flags.dryRun);
        break;
      }

      case 'image-stats': {
        const { DatabaseQueries } = await import('./db/queries.js');
        const queries = new DatabaseQueries(db);
        const stats = queries.getEmailsWithImageStats();

        console.log('\n🖼️  Embedded Image Statistics\n');

        if (stats.length === 0) {
          console.log('  No embedded images found.');
          console.log(
            '  Run "download-images" to download images for your emails.'
          );
        } else {
          let totalImages = 0;
          let totalSize = 0;

          console.log('  Emails with embedded images:\n');
          stats.forEach((email, i) => {
            totalImages += email.image_count;
            totalSize += email.total_size;

            const sizeMB = (email.total_size / 1024 / 1024).toFixed(2);
            console.log(
              `  ${i + 1}. ${email.subject.substring(0, 50)}${
                email.subject.length > 50 ? '...' : ''
              }`
            );
            console.log(`     ${email.image_count} images, ${sizeMB} MB\n`);
          });

          console.log('  Summary:');
          console.log(`    Total emails with images: ${stats.length}`);
          console.log(`    Total images: ${totalImages}`);
          console.log(
            `    Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`
          );
        }
        break;
      }

      default:
        logger.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    db.close();
  }
}

// Run CLI
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
