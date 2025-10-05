#!/usr/bin/env node
/**
 * Debug script to check email attachments from API
 */

import { config } from 'dotenv';
import { ButtondownClient } from '../lib/api/client.js';

config();

const apiKey = process.env.BUTTONDOWN_API_KEY;
if (!apiKey) {
  console.error('BUTTONDOWN_API_KEY not found');
  process.exit(1);
}

const client = new ButtondownClient(apiKey);

// Fetch a few emails and check if they have attachments field
let count = 0;
let withAttachments = 0;

for await (const email of client.fetchAllEmails()) {
  count++;

  if (email.attachments && email.attachments.length > 0) {
    console.log(`\nEmail: ${email.subject}`);
    console.log(`  Attachments: ${JSON.stringify(email.attachments)}`);
    withAttachments++;
  }

  if (count >= 100) break; // Check first 100 emails
}

console.log(`\nChecked ${count} emails`);
console.log(`Emails with attachments: ${withAttachments}`);
