/**
 * TypeScript types for Buttondown API
 * Based on buttondownOpenAPI.json
 */

export interface Email {
  id: string;
  creation_date: string;
  modification_date: string;
  publish_date?: string;
  subject: string;
  body: string;
  status: EmailStatus;
  suppression_reason?: string;
  slug?: string;
  canonical_url: string;
  email_type?: EmailType;
  image: string;
  description: string;
  metadata?: Record<string, string>;
  source?: string;
  secondary_id?: number;
  commenting_mode?: string;
  absolute_url: string;
  filters?: any;
  analytics?: any;
  template?: any;
  attachments?: string[];
  related_email_ids: string[];
  featured: boolean;
  should_trigger_pay_per_email_billing: boolean;
}

export type EmailStatus =
  | 'draft'
  | 'managed_by_rss'
  | 'about_to_send'
  | 'scheduled'
  | 'in_flight'
  | 'paused'
  | 'deleted'
  | 'errored'
  | 'sent'
  | 'imported';

export type EmailType = 'public' | 'premium' | 'private';

export interface EmailPage {
  results: Email[];
  next?: string;
  previous?: string;
  count: number;
}

export interface Attachment {
  id: string;
  creation_date: string;
  name: string;
  file: string; // URL to file
}

export interface AttachmentPage {
  results: Attachment[];
  next?: string;
  previous?: string;
  count: number;
}

export interface EmailQueryParams {
  status?: EmailStatus[];
  negative_status?: EmailStatus[];
  ordering?: string;
  creation_date__start?: string;
  creation_date__end?: string;
  publish_date__start?: string;
  publish_date__end?: string;
  modification_date__start?: string;
  modification_date__end?: string;
  page_size?: number;
}
