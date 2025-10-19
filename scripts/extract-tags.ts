#!/usr/bin/env ts-node
/**
 * Extract and generate tags for all emails using OpenAI
 *
 * This script:
 * 1. Loads all emails from the database
 * 2. Uses OpenAI to analyze each email and extract meaningful tags
 * 3. Normalizes tags across all emails to ensure consistency
 * 4. Stores tags in the database with email associations
 *
 * Usage:
 *   npm run extract-tags
 *   # or with limits
 *   npm run extract-tags -- --limit 10
 *   # or process specific emails
 *   npm run extract-tags -- --email-id abc123
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { OpenAIClient } from '../lib/api/openai-client.js';
import { logger } from '../lib/utils/logger.js';

interface ExtractedTags {
  tags: string[];
}

interface ProcessingStats {
  total: number;
  processed: number;
  failed: number;
  totalTags: number;
  avgTagsPerEmail: number;
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

/**
 * Extract tags from a single email using OpenAI
 */
async function extractTagsForEmail(
  client: OpenAIClient,
  email: any
): Promise<string[]> {
  const content = email.normalized_markdown || email.body;

  // Truncate content if too long (to manage token usage)
  const maxContentLength = 8000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '...'
      : content;

  const prompt = USER_PROMPT_TEMPLATE.replace(
    '{subject}',
    email.subject
  ).replace('{content}', truncatedContent);

  try {
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
  } catch (error) {
    logger.error(`Failed to extract tags for email ${email.id}:`, error);
    throw error;
  }
}

/**
 * Normalize and deduplicate tags across all extracted tags
 * This helps consolidate similar tags like "AI" and "Artificial Intelligence"
 */
async function normalizeTagsBatch(
  client: OpenAIClient,
  allTags: Set<string>
): Promise<Map<string, string>> {
  const tagArray = Array.from(allTags);

  if (tagArray.length === 0) {
    return new Map();
  }

  logger.info(`Normalizing ${tagArray.length} unique tags...`);

  const normalizationPrompt = `You are a tag normalization expert. Given a list of tags, identify duplicates and similar tags that should be merged.

Consider:
- Different capitalizations (e.g., "AI" vs "ai")
- Abbreviations vs full forms (e.g., "AI" vs "Artificial Intelligence")
- Plural vs singular (e.g., "books" vs "book")
- Similar concepts (e.g., "machine learning" vs "ML")
- Spelling variations

For each group of similar tags, choose the BEST canonical form (most clear and professional).

Input tags:
${tagArray.map((tag, i) => `${i + 1}. ${tag}`).join('\n')}

Return a JSON object where keys are the original tags and values are their canonical forms.
If a tag should not be merged with others, map it to itself.

Example format:
{
  "AI": "artificial intelligence",
  "ai": "artificial intelligence",
  "Artificial Intelligence": "artificial intelligence",
  "machine learning": "machine learning",
  "ML": "machine learning"
}`;

  try {
    const completion = await client.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: normalizationPrompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const responseText = client.extractContent(completion);
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const mappings = JSON.parse(responseText) as Record<string, string>;
    return new Map(Object.entries(mappings));
  } catch (error) {
    logger.error('Failed to normalize tags:', error);
    // Return identity mapping as fallback
    return new Map(tagArray.map((tag) => [tag, tag]));
  }
}

/**
 * Main extraction function
 */
async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined;
  const emailIdIndex = args.indexOf('--email-id');
  const specificEmailId =
    emailIdIndex >= 0 ? args[emailIdIndex + 1] : undefined;

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error(
      'OPENAI_API_KEY environment variable is required. See docs/OPENAI_SETUP.md'
    );
    process.exit(1);
  }

  // Initialize database and OpenAI client
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);
  const client = new OpenAIClient(apiKey);

  try {
    // Get emails to process
    let emails: any[];
    if (specificEmailId) {
      const email = queries.emails.getEmailWithLocalImages(specificEmailId);
      if (!email) {
        logger.error(`Email not found: ${specificEmailId}`);
        process.exit(1);
      }
      emails = [email.email];
      logger.info(`Processing single email: ${specificEmailId}`);
    } else {
      emails = queries.emails.getAllEmails();
      if (limit) {
        emails = emails.slice(0, limit);
        logger.info(`Processing ${limit} emails (limited)`);
      } else {
        logger.info(`Processing all ${emails.length} emails`);
      }
    }

    const stats: ProcessingStats = {
      total: emails.length,
      processed: 0,
      failed: 0,
      totalTags: 0,
      avgTagsPerEmail: 0,
    };

    // Track all extracted tags for normalization
    const allExtractedTags = new Map<string, string[]>(); // email_id -> raw tags
    const allUniqueRawTags = new Set<string>();

    logger.info('Step 1: Extracting tags from emails...');

    // Extract tags from each email
    const result = await client.processBatch(
      emails,
      async (email) => {
        const tags = await extractTagsForEmail(client, email);
        allExtractedTags.set(email.id, tags);
        tags.forEach((tag) => allUniqueRawTags.add(tag));
        return tags;
      },
      {
        concurrency: 3, // Reduced concurrency to avoid rate limits
        delayMs: 500, // Add delay between batches
        onProgress: (completed, total) => {
          logger.info(
            `Progress: ${completed}/${total} (${Math.round(
              (completed / total) * 100
            )}%)`
          );
        },
        onError: (error, item: any) => {
          logger.error(`Failed to process email ${item.id}: ${error.message}`);
          stats.failed++;
        },
      }
    );

    stats.processed = result.successful.length;

    logger.info(
      `Step 1 complete: ${stats.processed} emails processed, ${stats.failed} failed`
    );
    logger.info(`Extracted ${allUniqueRawTags.size} unique raw tags`);

    // Step 2: Normalize tags using OpenAI
    logger.info('Step 2: Normalizing tags...');
    const tagMappings = await normalizeTagsBatch(client, allUniqueRawTags);

    // Step 3: Store normalized tags in database
    logger.info('Step 3: Storing tags in database...');

    for (const [emailId, rawTags] of allExtractedTags.entries()) {
      // Map raw tags to normalized forms
      const normalizedTags = rawTags
        .map((tag) => tagMappings.get(tag) || tag)
        .filter((tag, index, self) => self.indexOf(tag) === index); // Deduplicate

      // Store in database
      queries.tags.setEmailTags(emailId, normalizedTags);
      stats.totalTags += normalizedTags.length;
    }

    stats.avgTagsPerEmail = stats.totalTags / stats.processed;

    // Get final tag statistics
    const tagStats = queries.tags.getTagStats();
    const topTags = queries.tags.getAllTagsWithCounts().slice(0, 20);

    logger.success('\n=== Tag Extraction Complete ===');
    logger.info(`Emails processed: ${stats.processed}`);
    logger.info(`Emails failed: ${stats.failed}`);
    logger.info(`Total tags created: ${tagStats.totalTags}`);
    logger.info(`Total tag associations: ${tagStats.totalEmailTags}`);
    logger.info(`Average tags per email: ${stats.avgTagsPerEmail.toFixed(2)}`);
    logger.info(`Max tags on one email: ${tagStats.maxTagsPerEmail}`);

    logger.info('\nTop 20 most common tags:');
    topTags.forEach((tag, index) => {
      logger.info(`  ${index + 1}. ${tag.name} (${tag.email_count} emails)`);
    });

    logger.success('\nTags have been extracted and stored successfully!');
  } catch (error) {
    logger.error('Tag extraction failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  logger.error('Unexpected error:', error);
  process.exit(1);
});
