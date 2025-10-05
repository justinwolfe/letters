#!/usr/bin/env ts-node
/**
 * Inspect email HTML to see what image formats are being used
 */

import { config } from 'dotenv';
import { initializeDatabase } from '../src/db/schema.js';
import { extractImageUrls } from '../src/utils/image-processor.js';

config();

async function main() {
  const db = initializeDatabase();

  try {
    // Get a few emails from 2024
    const emails = db
      .prepare(
        `
      SELECT id, subject, body, publish_date
      FROM emails
      WHERE publish_date LIKE '2024%'
      ORDER BY publish_date DESC
      LIMIT 5
    `
      )
      .all();

    console.log(`\nFound ${emails.length} emails from 2024\n`);

    for (const email of emails as any[]) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`ID: ${email.id}`);
      console.log(`Date: ${email.publish_date}`);
      console.log(`${'='.repeat(80)}\n`);

      // Extract images
      const urls = extractImageUrls(email.body);
      console.log(`Images found: ${urls.length}`);

      if (urls.length > 0) {
        console.log('\nImage URLs:');
        urls.forEach((url, i) => {
          console.log(
            `  ${i + 1}. ${url.substring(0, 100)}${
              url.length > 100 ? '...' : ''
            }`
          );
        });
      } else {
        console.log('\nNo images found by current extraction logic.');

        // Let's look for any URLs in the HTML
        const httpMatches = email.body.match(/https?:\/\/[^\s"'<>]+/g);
        if (httpMatches) {
          console.log(`\nFound ${httpMatches.length} HTTP URLs in the body:`);
          httpMatches.slice(0, 10).forEach((url: string, i: number) => {
            console.log(
              `  ${i + 1}. ${url.substring(0, 100)}${
                url.length > 100 ? '...' : ''
              }`
            );
          });
          if (httpMatches.length > 10) {
            console.log(`  ... and ${httpMatches.length - 10} more`);
          }
        }

        // Show a snippet of the HTML
        console.log('\nHTML snippet (first 500 chars):');
        console.log(email.body.substring(0, 500));
        console.log('\n...\n');
      }
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('Inspection failed:', error);
  process.exit(1);
});
