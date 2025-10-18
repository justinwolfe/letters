/**
 * Buttondown API client
 *
 * Provides a TypeScript client for interacting with the Buttondown API.
 * Includes automatic pagination, rate limiting, and retry logic.
 *
 * @example
 * ```typescript
 * const client = new ButtondownClient(process.env.BUTTONDOWN_API_KEY!);
 *
 * // Fetch all emails
 * for await (const email of client.fetchAllEmails()) {
 *   console.log(email.subject);
 * }
 *
 * // Fetch a single email
 * const email = await client.fetchEmail('email-id');
 * ```
 */

import { logger } from '../utils/logger.js';
import type {
  Email,
  EmailPage,
  Attachment,
  AttachmentPage,
  EmailQueryParams,
} from './types.js';

const BASE_URL = 'https://api.buttondown.com/v1';

/**
 * Buttondown API client with automatic pagination and retry logic
 */
export class ButtondownClient {
  private apiKey: string;
  private baseUrl: string;

  /**
   * Create a new Buttondown API client
   *
   * @param apiKey - Your Buttondown API key from https://buttondown.com/settings
   * @param baseUrl - API base URL (defaults to production API)
   *
   * @example
   * ```typescript
   * const client = new ButtondownClient(process.env.BUTTONDOWN_API_KEY!);
   * ```
   */
  constructor(apiKey: string, baseUrl: string = BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Make a GET request to the API with automatic retry logic
   *
   * Handles rate limiting (429) and network errors with exponential backoff.
   *
   * @param path - API path or full URL
   * @param retries - Number of retry attempts remaining (default: 3)
   * @returns The parsed JSON response
   * @throws {Error} If the API request fails after all retries
   */
  private async request<T>(path: string, retries = 3): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    logger.debug(`API request: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429 && retries > 0) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(
            response.headers.get('Retry-After') || '5'
          );
          logger.warn(`Rate limited. Retrying after ${retryAfter}s...`);
          await this.sleep(retryAfter * 1000);
          return this.request<T>(path, retries - 1);
        }

        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (
        retries > 0 &&
        error instanceof Error &&
        error.message.includes('fetch')
      ) {
        // Network error - retry
        logger.warn(`Network error, retrying... (${retries} attempts left)`);
        await this.sleep(2000);
        return this.request<T>(path, retries - 1);
      }
      throw error;
    }
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
   * Fetch a single page of emails from the API
   *
   * @param params - Query parameters for filtering emails
   * @returns A page of emails with pagination metadata
   * @throws {Error} If API request fails or rate limit is exceeded
   *
   * @example
   * ```typescript
   * const page = await client.fetchEmailsPage({
   *   status: ['sent'],
   *   publish_date__start: '2024-01-01'
   * });
   * console.log(`Found ${page.results.length} emails`);
   * ```
   */
  async fetchEmailsPage(params?: EmailQueryParams): Promise<EmailPage> {
    const query = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => query.append(key, String(v)));
          } else {
            query.append(key, String(value));
          }
        }
      });
    }

    const path = `/emails${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<EmailPage>(path);
  }

  /**
   * Fetch all emails using automatic pagination
   *
   * Returns an async generator for memory-efficient iteration over large datasets.
   * Automatically handles pagination and includes small delays between requests
   * to be respectful of API rate limits.
   *
   * @param params - Query parameters for filtering emails
   * @yields Individual email objects
   *
   * @example
   * ```typescript
   * // Fetch all sent emails
   * for await (const email of client.fetchAllEmails({ status: ['sent'] })) {
   *   console.log(email.subject);
   * }
   *
   * // Fetch emails modified since a date
   * for await (const email of client.fetchAllEmails({
   *   modification_date__start: '2024-01-01'
   * })) {
   *   console.log(email.subject);
   * }
   * ```
   */
  async *fetchAllEmails(params?: EmailQueryParams): AsyncGenerator<Email> {
    let nextUrl: string | undefined = undefined;
    let isFirstPage = true;

    while (isFirstPage || nextUrl) {
      const page: EmailPage = isFirstPage
        ? await this.fetchEmailsPage(params)
        : await this.request<EmailPage>(nextUrl!);

      yield* page.results;

      nextUrl = page.next;
      isFirstPage = false;

      // Add small delay to be nice to the API
      if (nextUrl) {
        await this.sleep(100);
      }
    }
  }

  /**
   * Fetch a single email by ID
   *
   * @param id - The email ID to fetch
   * @returns The email object
   * @throws {Error} If the email is not found or request fails
   *
   * @example
   * ```typescript
   * const email = await client.fetchEmail('abc123');
   * console.log(email.subject);
   * ```
   */
  async fetchEmail(id: string): Promise<Email> {
    return this.request<Email>(`/emails/${id}`);
  }

  /**
   * Fetch all attachments using automatic pagination
   *
   * Returns an async generator for memory-efficient iteration.
   *
   * @yields Individual attachment objects
   *
   * @example
   * ```typescript
   * for await (const attachment of client.fetchAllAttachments()) {
   *   console.log(attachment.name);
   * }
   * ```
   */
  async *fetchAllAttachments(): AsyncGenerator<Attachment> {
    let nextUrl: string | undefined = '/attachments';

    while (nextUrl) {
      const page: AttachmentPage = await this.request<AttachmentPage>(nextUrl);
      yield* page.results;
      nextUrl = page.next;

      // Add small delay
      if (nextUrl) {
        await this.sleep(100);
      }
    }
  }

  /**
   * Fetch a single attachment by ID
   *
   * @param id - The attachment ID to fetch
   * @returns The attachment object
   * @throws {Error} If the attachment is not found or request fails
   *
   * @example
   * ```typescript
   * const attachment = await client.fetchAttachment('att-123');
   * console.log(attachment.name, attachment.file);
   * ```
   */
  async fetchAttachment(id: string): Promise<Attachment> {
    return this.request<Attachment>(`/attachments/${id}`);
  }
}
