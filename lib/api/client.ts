/**
 * Buttondown API client
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

export class ButtondownClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Make a GET request to the API
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch a single page of emails
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
   * Fetch all emails using pagination
   * Returns an async generator for memory efficiency
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
   */
  async fetchEmail(id: string): Promise<Email> {
    return this.request<Email>(`/emails/${id}`);
  }

  /**
   * Fetch all attachments
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
   */
  async fetchAttachment(id: string): Promise<Attachment> {
    return this.request<Attachment>(`/attachments/${id}`);
  }
}
