#!/usr/bin/env node
/**
 * Reset the database (DESTRUCTIVE - for testing only)
 */

import { unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const DB_PATH = join(PROJECT_ROOT, 'data', 'newsletters.db');

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('\n⚠️  WARNING: This will DELETE the entire database!\n');

  if (!existsSync(DB_PATH)) {
    console.log('Database does not exist. Nothing to delete.');
    return;
  }

  const confirmed = await confirm('Are you sure you want to continue? (y/N): ');

  if (!confirmed) {
    console.log('Cancelled.');
    return;
  }

  try {
    unlinkSync(DB_PATH);
    console.log('✓ Database deleted successfully');
    console.log(`  ${DB_PATH}`);
    console.log('\nRun "npm run sync" to create a new database.');
  } catch (error) {
    console.error('Failed to delete database:', error);
    process.exit(1);
  }
}

main();
