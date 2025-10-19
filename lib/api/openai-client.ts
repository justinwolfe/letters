/**
 * OpenAI API client
 *
 * Provides a TypeScript client for interacting with the OpenAI API.
 * Includes support for chat completions, batch processing, and streaming.
 *
 * @example
 * ```typescript
 * const client = new OpenAIClient(process.env.OPENAI_API_KEY!);
 *
 * // Simple chat completion
 * const response = await client.createChatCompletion({
 *   model: 'gpt-5-mini',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 *
 * // Bulk processing with progress tracking
 * const results = await client.processBatch(items, async (item) => {
 *   return await client.createChatCompletion({
 *     model: 'gpt-5-mini',
 *     messages: [{ role: 'user', content: item.prompt }]
 *   });
 * }, { concurrency: 5 });
 * ```
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletion,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';

export interface BatchProcessOptions {
  /** Number of concurrent requests (default: 5) */
  concurrency?: number;
  /** Delay between batches in milliseconds (default: 0) */
  delayMs?: number;
  /** Callback for progress updates */
  onProgress?: (completed: number, total: number, item?: any) => void;
  /** Callback for individual errors (continues processing if provided) */
  onError?: (error: Error, item: any, index: number) => void;
}

export interface BatchResult<T, R> {
  /** Successfully processed items with results */
  successful: Array<{ item: T; result: R; index: number }>;
  /** Failed items with errors */
  failed: Array<{ item: T; error: Error; index: number }>;
  /** Total processing time in milliseconds */
  durationMs: number;
}

/**
 * OpenAI API client with batch processing support
 */
export class OpenAIClient {
  private client: OpenAI;

  /**
   * Create a new OpenAI API client
   *
   * @param apiKey - Your OpenAI API key from https://platform.openai.com/api-keys
   * @param options - Additional OpenAI client options
   *
   * @example
   * ```typescript
   * const client = new OpenAIClient(process.env.OPENAI_API_KEY!);
   * ```
   */
  constructor(
    apiKey: string,
    options?: Partial<ConstructorParameters<typeof OpenAI>[0]>
  ) {
    this.client = new OpenAI({
      apiKey,
      ...options,
    });
    logger.info('OpenAI client initialized');
  }

  /**
   * Create a chat completion
   *
   * @param params - Chat completion parameters
   * @returns The chat completion response
   * @throws {Error} If the API request fails
   *
   * @example
   * ```typescript
   * const response = await client.createChatCompletion({
   *   model: 'gpt-5-mini',
   *   messages: [
   *     { role: 'system', content: 'You are a helpful assistant.' },
   *     { role: 'user', content: 'What is TypeScript?' }
   *   ],
   *   temperature: 0.7,
   *   max_tokens: 500
   * });
   * console.log(response.choices[0].message.content);
   * ```
   */
  async createChatCompletion(
    params: ChatCompletionCreateParamsNonStreaming
  ): Promise<ChatCompletion> {
    logger.debug(`Creating chat completion with model: ${params.model}`);
    try {
      const completion = await this.client.chat.completions.create(params);
      logger.debug(
        `Completion created. Tokens used: ${
          completion.usage?.total_tokens || 'unknown'
        }`
      );
      return completion;
    } catch (error) {
      logger.error('Failed to create chat completion:', error);
      throw error;
    }
  }

  /**
   * Create a streaming chat completion
   *
   * @param params - Chat completion parameters with stream: true
   * @returns An async iterable of chat completion chunks
   * @throws {Error} If the API request fails
   *
   * @example
   * ```typescript
   * const stream = await client.createChatCompletionStream({
   *   model: 'gpt-5-mini',
   *   messages: [{ role: 'user', content: 'Write a story' }],
   *   stream: true
   * });
   *
   * for await (const chunk of stream) {
   *   const content = chunk.choices[0]?.delta?.content || '';
   *   process.stdout.write(content);
   * }
   * ```
   */
  async createChatCompletionStream(
    params: ChatCompletionCreateParamsStreaming
  ): Promise<AsyncIterable<ChatCompletionChunk>> {
    logger.debug(
      `Creating streaming chat completion with model: ${params.model}`
    );
    try {
      return await this.client.chat.completions.create(params);
    } catch (error) {
      logger.error('Failed to create streaming chat completion:', error);
      throw error;
    }
  }

  /**
   * Process a batch of items with controlled concurrency
   *
   * Useful for bulk operations like analyzing multiple emails, generating
   * summaries, or processing a large dataset. Handles rate limiting and
   * provides progress tracking.
   *
   * @param items - Array of items to process
   * @param processor - Async function that processes each item
   * @param options - Batch processing options
   * @returns Results with successful and failed items
   *
   * @example
   * ```typescript
   * const emails = await loadEmails();
   * const result = await client.processBatch(
   *   emails,
   *   async (email) => {
   *     const completion = await client.createChatCompletion({
   *       model: 'gpt-5-mini',
   *       messages: [{
   *         role: 'user',
   *         content: `Summarize this email: ${email.body}`
   *       }]
   *     });
   *     return completion.choices[0].message.content;
   *   },
   *   {
   *     concurrency: 5,
   *     delayMs: 100,
   *     onProgress: (completed, total) => {
   *       console.log(`Progress: ${completed}/${total}`);
   *     }
   *   }
   * );
   * console.log(`Processed ${result.successful.length} successfully`);
   * ```
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: BatchProcessOptions = {}
  ): Promise<BatchResult<T, R>> {
    const { concurrency = 5, delayMs = 0, onProgress, onError } = options;

    const startTime = Date.now();
    const successful: Array<{ item: T; result: R; index: number }> = [];
    const failed: Array<{ item: T; error: Error; index: number }> = [];
    let completed = 0;

    logger.info(
      `Starting batch processing: ${items.length} items, concurrency: ${concurrency}`
    );

    // Process items in batches with controlled concurrency
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchPromises = batch.map(async (item, batchIndex) => {
        const index = i + batchIndex;
        try {
          const result = await processor(item, index);
          successful.push({ item, result, index });
          completed++;
          onProgress?.call(null, completed, items.length, item);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          failed.push({ item, error: err, index });
          completed++;

          if (onError) {
            onError(err, item, index);
          } else {
            logger.error(`Error processing item ${index}:`, err);
          }

          onProgress?.call(null, completed, items.length, item);
        }
      });

      await Promise.all(batchPromises);

      // Add delay between batches if specified
      if (delayMs > 0 && i + concurrency < items.length) {
        await this.sleep(delayMs);
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      `Batch processing complete: ${successful.length} successful, ${failed.length} failed, ${durationMs}ms`
    );

    return { successful, failed, durationMs };
  }

  /**
   * Process items sequentially (one at a time)
   *
   * Useful when you need guaranteed sequential processing or want to
   * minimize rate limiting issues.
   *
   * @param items - Array of items to process
   * @param processor - Async function that processes each item
   * @param options - Processing options (only onProgress and onError are used)
   * @returns Results with successful and failed items
   *
   * @example
   * ```typescript
   * const result = await client.processSequential(
   *   items,
   *   async (item) => processItem(item),
   *   {
   *     onProgress: (completed, total) => {
   *       console.log(`${completed}/${total}`);
   *     }
   *   }
   * );
   * ```
   */
  async processSequential<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: Pick<BatchProcessOptions, 'onProgress' | 'onError'> = {}
  ): Promise<BatchResult<T, R>> {
    return this.processBatch(items, processor, {
      ...options,
      concurrency: 1,
    });
  }

  /**
   * Extract text content from a chat completion response
   *
   * Helper method to get the text content from the first choice.
   *
   * @param completion - Chat completion response
   * @returns The text content or null if not found
   *
   * @example
   * ```typescript
   * const completion = await client.createChatCompletion({...});
   * const text = client.extractContent(completion);
   * console.log(text);
   * ```
   */
  extractContent(completion: ChatCompletion): string | null {
    return completion.choices[0]?.message?.content || null;
  }

  /**
   * Sleep for a specified duration
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the underlying OpenAI client for advanced operations
   *
   * Use this if you need direct access to other OpenAI API endpoints
   * like embeddings, images, audio, etc.
   *
   * @returns The OpenAI client instance
   *
   * @example
   * ```typescript
   * const rawClient = client.getRawClient();
   * const embedding = await rawClient.embeddings.create({
   *   model: 'text-embedding-3-small',
   *   input: 'Some text'
   * });
   * ```
   */
  getRawClient(): OpenAI {
    return this.client;
  }
}
