#!/usr/bin/env ts-node
/**
 * Final retry with very conservative rate limiting
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { OpenAIClient } from '../lib/api/openai-client.js';
import { logger } from '../lib/utils/logger.js';

interface ExtractedTags {
  tags: string[];
}

const SYSTEM_PROMPT = `You are a content analyst specializing in extracting relevant tags from newsletter content.

Your task is to analyze email newsletter content and extract 3-8 meaningful tags that:
- Capture the main topics and themes discussed
- Are specific enough to be useful for categorization
- Include both broad topics (e.g., "technology", "business") and specific concepts (e.g., "machine learning", "startup funding")
- Use clear, professional terminology
- Avoid overly generic tags like "update", "news", "thoughts"

Guidelines:
- Extract 3-8 tags per email (aim for 5-6 when possible)
- Use singular form for nouns (e.g., "book" not "books")
- Prefer full phrases when appropriate (e.g., "machine learning" rather than just "ML")
- Include both technical and non-technical tags when relevant
- Consider the tone and target audience in tag selection

Return ONLY a JSON object with a "tags" array of strings. No additional explanation.

Example response:
{"tags": ["artificial intelligence", "ethics", "technology policy", "machine learning", "regulation"]}`;

const USER_PROMPT_TEMPLATE = `Analyze this newsletter and extract 3-8 meaningful tags:

SUBJECT: {subject}

CONTENT:
{content}

Extract tags that capture the key topics, themes, and concepts discussed. Return only JSON with a "tags" array.`;

async function extractTagsForEmail(
  client: OpenAIClient,
  email: any
): Promise<string[]> {
  const content = email.normalized_markdown || email.body;

  const maxContentLength = 8000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '...'
      : content;

  const prompt = USER_PROMPT_TEMPLATE.replace(
    '{subject}',
    email.subject
  ).replace('{content}', truncatedContent);

  const completion = await client.createChatCompletion({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const responseText = client.extractContent(completion);
  if (!responseText) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(responseText) as ExtractedTags;
  return parsed.tags || [];
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);
  const client = new OpenAIClient(apiKey);

  try {
    // Find emails without tags
    const emailsWithoutTags = db
      .prepare(
        `
      SELECT e.id, e.subject, e.body, e.normalized_markdown
      FROM emails e
      LEFT JOIN email_tags et ON e.id = et.email_id
      WHERE et.tag_id IS NULL
      GROUP BY e.id
      ORDER BY e.publish_date DESC
    `
      )
      .all() as Array<{
      id: string;
      subject: string;
      body: string;
      normalized_markdown: string | null;
    }>;

    logger.info(`Found ${emailsWithoutTags.length} emails without tags`);

    if (emailsWithoutTags.length === 0) {
      logger.success('All emails have tags!');
      return;
    }

    logger.info('\nProcessing with 5-second delays between requests...\n');

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < emailsWithoutTags.length; i++) {
      const email = emailsWithoutTags[i];

      try {
        logger.info(
          `[${i + 1}/${emailsWithoutTags.length}] ${email.subject.substring(
            0,
            60
          )}...`
        );

        // Extract tags
        const tags = await extractTagsForEmail(client, email);

        // Store in database (no normalization for remaining emails)
        queries.tags.setEmailTags(email.id, tags);

        processed++;
        logger.success(`  ✓ Tagged with: ${tags.join(', ')}`);

        // 5-second delay to be very conservative
        if (i < emailsWithoutTags.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error: any) {
        failed++;

        if (error.status === 429) {
          logger.warn(`  ⚠ Rate limit hit, waiting 60 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 60000));

          // Retry this email
          try {
            const tags = await extractTagsForEmail(client, email);
            queries.tags.setEmailTags(email.id, tags);
            processed++;
            failed--;
            logger.success(`  ✓ Retried successfully`);
          } catch (retryError) {
            logger.error(
              `  ✗ Retry failed: ${
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError)
              }`
            );
          }
        } else {
          logger.error(`  ✗ Failed: ${error.message || String(error)}`);
        }

        // Wait before continuing
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    logger.success(`\n=== Final Retry Complete ===`);
    logger.info(`Successfully processed: ${processed}`);
    logger.info(`Failed: ${failed}`);

    // Show final stats
    const stats = queries.tags.getTagStats();
    const topTags = queries.tags.getAllTagsWithCounts().slice(0, 20);

    logger.info(`\nFinal Statistics:`);
    logger.info(`Total tags: ${stats.totalTags}`);
    logger.info(`Total associations: ${stats.totalEmailTags}`);
    logger.info(`Average tags per email: ${stats.avgTagsPerEmail.toFixed(2)}`);

    logger.info('\nTop 20 tags:');
    topTags.forEach((tag, index) => {
      logger.info(`  ${index + 1}. ${tag.name} (${tag.email_count} emails)`);
    });
  } finally {
    db.close();
  }
}

main().catch((error) => {
  logger.error('Final retry failed:', error);
  process.exit(1);
});
