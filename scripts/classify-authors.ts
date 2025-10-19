/**
 * Classify emails and identify guest contributors using OpenAI
 *
 * This script analyzes email subject lines to identify letters from guest
 * contributors (indicated by names or letters in parentheses) and updates
 * the database accordingly.
 *
 * Run with: npm run tsx scripts/classify-authors.ts
 */

import 'dotenv/config';
import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { OpenAIClient } from '../lib/api/openai-client.js';
import { logger } from '../lib/utils/logger.js';
import { extractAuthor } from '../lib/utils/author-extractor.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface AuthorClassification {
  emailId: string;
  subject: string;
  author: string | null;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

const CLASSIFICATION_PROMPT = `You are analyzing email subject lines to identify if they are from guest contributors.

Guest contributors are identified by:
1. Names or initials in parentheses, like "(L)", "(R)", "(Scarlett)", "((Dr)L)"
2. Sometimes combined with numbers like "(L)(2)", "(L)(5)"

Your task:
- If the subject contains a name/initial in parentheses, extract just the author identifier (e.g., "L", "R", "Scarlett")
- NOTE: "Dr. L" and "L" are the same person - always normalize to just "L"
- If it's clearly from the primary author (no parentheses with names), return null
- Be conservative: only mark as guest author if you're confident

Return JSON in this exact format:
{
  "author": "L" or null,
  "confidence": "high" | "medium" | "low",
  "explanation": "Brief reason for classification"
}

Examples:
- "thank you notes (L)" → {"author": "L", "confidence": "high", "explanation": "Clear author marker in parentheses"}
- "thank you notes (Scarlett)(2)" → {"author": "Scarlett", "confidence": "high", "explanation": "Named author in parentheses"}
- "tyn ((Dr)L)(4)" → {"author": "L", "confidence": "high", "explanation": "Dr. L normalized to L"}
- "4/2" → {"author": null, "confidence": "high", "explanation": "No author marker, primary author"}
- "don't read if you just ate or are at work (butt stuff)" → {"author": null, "confidence": "high", "explanation": "Parentheses contain description, not author"}`;

async function classifyAuthors(dryRun: boolean = false) {
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY not found in environment variables');
    logger.info('Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }

  const client = new OpenAIClient(process.env.OPENAI_API_KEY);
  const classifications: AuthorClassification[] = [];

  try {
    logger.info('Fetching all emails...');
    const emails = queries.emails.getAllEmails();
    logger.info(`Found ${emails.length} emails to classify`);

    if (dryRun) {
      logger.info('Running in DRY RUN mode - no database changes will be made');
    }

    // Process emails in batches
    const result = await client.processBatch(
      emails,
      async (email: any) => {
        try {
          // First try local extraction
          let author = extractAuthor(email.subject);

          // If local extraction finds an author, use it (high confidence)
          if (author !== null) {
            const result: AuthorClassification = {
              emailId: email.id,
              subject: email.subject,
              author: author,
              confidence: 'high',
              explanation: 'Extracted from subject line pattern',
            };

            classifications.push(result);

            // Update database if not dry run and author changed
            if (!dryRun && author !== email.author) {
              queries.emails.updateAuthor(email.id, author);
            }

            return result;
          }

          // Fall back to AI classification for edge cases
          const response = await client.createChatCompletion({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: CLASSIFICATION_PROMPT,
              },
              {
                role: 'user',
                content: `Analyze this subject line: "${email.subject}"`,
              },
            ],
            temperature: 0.1, // Low temperature for consistent classification
            response_format: { type: 'json_object' },
          });

          const content = client.extractContent(response);
          if (!content) {
            throw new Error('No content in response');
          }

          const classification = JSON.parse(content);

          const result: AuthorClassification = {
            emailId: email.id,
            subject: email.subject,
            author: classification.author,
            confidence: classification.confidence,
            explanation: classification.explanation,
          };

          classifications.push(result);

          // Update database if not dry run and author changed
          if (!dryRun && classification.author !== email.author) {
            queries.emails.updateAuthor(email.id, classification.author);
          }

          return result;
        } catch (error) {
          logger.error(`Failed to classify email ${email.id}:`, error);
          throw error;
        }
      },
      {
        concurrency: 10, // Process 10 at a time
        delayMs: 100, // Small delay between batches
        onProgress: (completed, total) => {
          if (completed % 50 === 0 || completed === total) {
            logger.info(`Progress: ${completed}/${total} emails classified`);
          }
        },
        onError: (error, item: any) => {
          logger.error(
            `Error classifying "${item.subject}" (${item.id}):`,
            error.message
          );
        },
      }
    );

    logger.success(
      `Classification complete: ${result.successful.length} successful, ${result.failed.length} failed`
    );

    // Generate statistics
    const authorCounts = new Map<string, number>();
    classifications.forEach((c) => {
      const author = c.author || 'primary';
      authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    });

    logger.info('\n=== Author Statistics ===');
    Array.from(authorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([author, count]) => {
        logger.info(`${author}: ${count} letters`);
      });

    // Save detailed results to JSON
    const outputPath = join(process.cwd(), 'author-classifications.json');
    writeFileSync(
      outputPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          dryRun,
          total: emails.length,
          successful: result.successful.length,
          failed: result.failed.length,
          classifications: classifications.sort((a, b) =>
            (a.author || 'zzz').localeCompare(b.author || 'zzz')
          ),
          authorStats: Array.from(authorCounts.entries()).map(
            ([author, count]) => ({
              author,
              count,
            })
          ),
        },
        null,
        2
      )
    );

    logger.success(`Detailed results saved to: ${outputPath}`);

    if (dryRun) {
      logger.info(
        '\nThis was a dry run. Re-run without --dry-run to apply changes to the database.'
      );
    }
  } catch (error) {
    logger.error('Fatal error during classification:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  classifyAuthors(dryRun).catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { classifyAuthors };
