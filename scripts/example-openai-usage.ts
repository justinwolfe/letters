/**
 * Example script demonstrating OpenAI client usage
 *
 * This shows various ways to use the OpenAI client for bulk processing tasks.
 * Run with: tsx scripts/example-openai-usage.ts
 */

// @ts-nocheck - Example functions are meant to be selectively uncommented

import 'dotenv/config';
import { OpenAIClient } from '../lib/api/openai-client.js';
import { logger } from '../lib/utils/logger.js';

// Initialize the client
const client = new OpenAIClient(process.env.OPENAI_API_KEY!);

/**
 * Example 1: Simple chat completion
 */
async function exampleSimpleCompletion() {
  logger.info('Example 1: Simple chat completion');

  const response = await client.createChatCompletion({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that provides concise answers.',
      },
      {
        role: 'user',
        content: 'What is TypeScript in one sentence?',
      },
    ],
    temperature: 0.7,
    max_tokens: 100,
  });

  const content = client.extractContent(response);
  logger.info('Response:', content);
}

/**
 * Example 2: Batch processing with progress tracking
 */
async function exampleBatchProcessing() {
  logger.info('Example 2: Batch processing with progress tracking');

  // Sample data to process
  const topics = [
    'artificial intelligence',
    'quantum computing',
    'blockchain technology',
    'renewable energy',
    'space exploration',
  ];

  const result = await client.processBatch(
    topics,
    async (topic) => {
      const response = await client.createChatCompletion({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'user',
            content: `Write a one-sentence description of ${topic}.`,
          },
        ],
        max_tokens: 50,
      });
      return client.extractContent(response);
    },
    {
      concurrency: 3, // Process 3 at a time
      delayMs: 500, // Wait 500ms between batches
      onProgress: (completed, total) => {
        logger.info(`Progress: ${completed}/${total}`);
      },
      onError: (error, item) => {
        logger.error(`Failed to process "${item}":`, error.message);
      },
    }
  );

  logger.info(`\nResults:`);
  logger.info(`✓ Successful: ${result.successful.length}`);
  logger.info(`✗ Failed: ${result.failed.length}`);
  logger.info(`⏱ Duration: ${result.durationMs}ms`);

  result.successful.forEach(({ item, result: res }) => {
    logger.info(`\n${item}: ${res}`);
  });
}

/**
 * Example 3: Sequential processing
 */
async function exampleSequentialProcessing() {
  logger.info('Example 3: Sequential processing');

  const items = ['First', 'Second', 'Third'];

  const result = await client.processSequential(
    items,
    async (item) => {
      const response = await client.createChatCompletion({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'user',
            content: `Say "${item}" in a creative way.`,
          },
        ],
        max_tokens: 30,
      });
      return client.extractContent(response);
    },
    {
      onProgress: (completed, total) => {
        logger.info(`Processed ${completed}/${total} items`);
      },
    }
  );

  result.successful.forEach(({ item, result: res }) => {
    logger.info(`${item} → ${res}`);
  });
}

/**
 * Example 4: Streaming response
 */
async function exampleStreaming() {
  logger.info('Example 4: Streaming response');

  const stream = await client.createChatCompletionStream({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'user',
        content: 'Write a haiku about coding.',
      },
    ],
    stream: true,
  });

  process.stdout.write('Response: ');
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(content);
  }
  process.stdout.write('\n');
}

/**
 * Example 5: Using the raw client for advanced operations
 */
async function exampleRawClient() {
  logger.info('Example 5: Using raw client for embeddings');

  const rawClient = client.getRawClient();

  const embedding = await rawClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'This is a test sentence for embedding.',
  });

  logger.info(
    `Generated embedding with ${embedding.data[0].embedding.length} dimensions`
  );
}

// Main function to run examples
async function main() {
  try {
    // Uncomment the examples you want to run:

    // await exampleSimpleCompletion();
    // await exampleBatchProcessing();
    // await exampleSequentialProcessing();
    // await exampleStreaming();
    // await exampleRawClient();

    logger.info('\n✓ All examples completed!');
    logger.info('\nUncomment the examples in main() to run them individually.');
  } catch (error) {
    logger.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
