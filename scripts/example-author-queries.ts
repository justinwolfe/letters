/**
 * Example queries for working with author data
 *
 * Run with: tsx scripts/example-author-queries.ts
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { logger } from '../lib/utils/logger.js';

async function exampleQueries() {
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  try {
    // Example 1: Get all authors and their counts
    logger.info('\n=== All Authors ===');
    const authors = queries.emails.getAllAuthors();
    authors.forEach((author) => {
      const name = author.author || 'Primary Author';
      logger.info(`${name}: ${author.count} letters`);
    });

    // Example 2: Get letters by specific contributor
    logger.info('\n=== Letters by "L" ===');
    const lLetters = queries.emails.getEmailsByAuthor('L');
    logger.info(`Found ${lLetters.length} letters by L`);
    lLetters.slice(0, 5).forEach((email: any) => {
      logger.info(`- ${email.subject} (${email.publish_date?.split('T')[0]})`);
    });

    // Example 3: Get all primary author letters
    logger.info('\n=== Primary Author Statistics ===');
    const primaryLetters = queries.emails.getEmailsByAuthor(null);
    logger.info(`Primary author has written ${primaryLetters.length} letters`);

    // Example 4: Get letters by multiple contributors
    logger.info('\n=== Top 5 Contributors ===');
    const topContributors = authors
      .filter((a) => a.author !== null)
      .slice(0, 5);

    for (const contributor of topContributors) {
      const letters = queries.emails.getEmailsByAuthor(contributor.author);
      logger.info(`\n${contributor.author}: ${letters.length} letters`);
      letters.slice(0, 3).forEach((email: any) => {
        logger.info(`  - ${email.subject}`);
      });
    }

    // Example 5: Count letters by year and author
    logger.info('\n=== Letters by Year (Sample Contributors) ===');
    const sampleAuthors = ['L', 'fsa', 'moe', null]; // null = primary

    for (const author of sampleAuthors) {
      const name = author || 'Primary';
      const letters = queries.emails.getEmailsByAuthor(author);
      const byYear = new Map<string, number>();

      letters.forEach((email: any) => {
        if (email.publish_date) {
          const year = email.publish_date.split('-')[0];
          byYear.set(year, (byYear.get(year) || 0) + 1);
        }
      });

      logger.info(`\n${name}:`);
      Array.from(byYear.entries())
        .sort()
        .forEach(([year, count]) => {
          logger.info(`  ${year}: ${count} letters`);
        });
    }

    // Example 6: Manually update an author (if needed)
    // Uncomment to use:
    // queries.emails.updateAuthor('some-email-id', 'CorrectAuthorName');
    // logger.info('Author updated!');
  } catch (error) {
    logger.error('Error running queries:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleQueries().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { exampleQueries };
