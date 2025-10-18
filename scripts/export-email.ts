#!/usr/bin/env ts-node
/**
 * Export a single email with embedded images as a standalone HTML file
 */

import { config } from 'dotenv';
import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { writeFileSync } from 'fs';
import { logger } from '../lib/utils/logger.js';

config();

async function main() {
  const emailId = process.argv[2];
  const outputPath = process.argv[3] || `email-${emailId}.html`;

  if (!emailId) {
    console.log(`
Usage: npm run export-email <email-id> [output-path]

Export an email with embedded images as a standalone HTML file.
Images will be embedded as data URIs.

Example:
  npm run export-email abc123 output.html
`);
    process.exit(1);
  }

  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  try {
    logger.info(`Exporting email ${emailId}...`);

    // Get email with local images
    const result = queries.emails.getEmailWithLocalImages(emailId);

    if (!result) {
      logger.error(`Email ${emailId} not found`);
      process.exit(1);
    }

    const { email, body } = result;

    // Create a complete HTML document
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${email.subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    h1 {
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .metadata {
      color: #666;
      font-size: 0.9em;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>${email.subject}</h1>
  <div class="metadata">
    ${
      email.publish_date
        ? `Published: ${new Date(email.publish_date).toLocaleDateString()}<br>`
        : ''
    }
    Status: ${email.status}
  </div>
  ${body}
</body>
</html>`;

    // Write to file
    writeFileSync(outputPath, html);

    logger.success(`Exported to ${outputPath}`);
    logger.info(`Subject: ${email.subject}`);
    logger.info(`Images: ${queries.images.countEmbeddedImages(emailId)}`);
    logger.info(
      `Size: ${(queries.images.getEmbeddedImagesSize(emailId) / 1024).toFixed(
        2
      )} KB`
    );
  } finally {
    db.close();
  }
}

main().catch((error) => {
  logger.error('Export failed:', error);
  process.exit(1);
});
