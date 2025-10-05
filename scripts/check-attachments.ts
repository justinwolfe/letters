#!/usr/bin/env node
/**
 * Quick script to check if emails have attachments
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const DB_PATH = join(PROJECT_ROOT, 'data', 'newsletters.db');

const db = new Database(DB_PATH);

// Check raw email data for attachment references
const emails = db
  .prepare(
    `
  SELECT id, subject, body
  FROM emails 
  WHERE body LIKE '%attachment%' OR body LIKE '%download%'
  LIMIT 5
`
  )
  .all();

console.log('Sample emails that might have attachments:');
console.log(JSON.stringify(emails, null, 2));

db.close();
