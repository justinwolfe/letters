/**
 * Generate an exhaustive index of repeated words and phrases in newsletters
 *
 * This script analyzes all newsletter content and creates a comprehensive index
 * similar to the back-of-book index, tracking where each word and phrase appears.
 *
 * Features:
 * - Word frequency analysis with stopword filtering
 * - Phrase detection (2-5 word n-grams)
 * - Context snippets for each occurrence
 * - Multiple output formats (JSON, HTML, Markdown)
 *
 * Usage:
 *   tsx scripts/generate-index.ts [options]
 *
 * Options:
 *   --min-word-freq <n>     Minimum word frequency to include (default: 3)
 *   --min-phrase-freq <n>   Minimum phrase frequency to include (default: 2)
 *   --max-phrases <n>       Maximum phrase length in words (default: 5)
 *   --max-occurrences <n>   Maximum occurrences to store per term (default: 100)
 *   --format <type>         Output format: json, html, markdown, all (default: all)
 *   --output-dir <path>     Output directory (default: ./index-output)
 *   --no-stopwords          Don't filter common stopwords
 *   --context-chars <n>     Characters of context around matches (default: 100)
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { EmailQueries } from '../lib/db/queries/emails.js';
import { logger } from '../lib/utils/logger.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Common English stopwords to filter out
const STOPWORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  "aren't",
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  "can't",
  'cannot',
  'could',
  "couldn't",
  'did',
  "didn't",
  'do',
  'does',
  "doesn't",
  'doing',
  "don't",
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  "hadn't",
  'has',
  "hasn't",
  'have',
  "haven't",
  'having',
  'he',
  "he'd",
  "he'll",
  "he's",
  'her',
  'here',
  "here's",
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  "how's",
  'i',
  "i'd",
  "i'll",
  "i'm",
  "i've",
  'if',
  'in',
  'into',
  'is',
  "isn't",
  'it',
  "it's",
  'its',
  'itself',
  "let's",
  'me',
  'more',
  'most',
  "mustn't",
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  "shan't",
  'she',
  "she'd",
  "she'll",
  "she's",
  'should',
  "shouldn't",
  'so',
  'some',
  'such',
  'than',
  'that',
  "that's",
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  "there's",
  'these',
  'they',
  "they'd",
  "they'll",
  "they're",
  "they've",
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  "wasn't",
  'we',
  "we'd",
  "we'll",
  "we're",
  "we've",
  'were',
  "weren't",
  'what',
  "what's",
  'when',
  "when's",
  'where',
  "where's",
  'which',
  'while',
  'who',
  "who's",
  'whom',
  'why',
  "why's",
  'with',
  "won't",
  'would',
  "wouldn't",
  'you',
  "you'd",
  "you'll",
  "you're",
  "you've",
  'your',
  'yours',
  'yourself',
  'yourselves',
]);

interface WordOccurrence {
  emailId: string;
  emailSubject: string;
  publishDate: string | null;
  context: string;
  position: number;
}

interface WordEntry {
  word: string;
  frequency: number;
  occurrences: WordOccurrence[];
}

interface PhraseOccurrence {
  emailId: string;
  emailSubject: string;
  publishDate: string | null;
  context: string;
  position: number;
}

interface PhraseEntry {
  phrase: string;
  frequency: number;
  occurrences: PhraseOccurrence[];
}

interface IndexData {
  metadata: {
    generatedAt: string;
    totalEmails: number;
    totalWords: number;
    totalPhrases: number;
    uniqueWords: number;
    uniquePhrases: number;
    minWordFrequency: number;
    minPhraseFrequency: number;
    maxPhraseLength: number;
    maxOccurrencesPerTerm: number;
  };
  words: WordEntry[];
  phrases: PhraseEntry[];
}

interface Config {
  minWordFreq: number;
  minPhraseFreq: number;
  maxPhraseLength: number;
  maxOccurrences: number;
  outputFormat: 'json' | 'html' | 'markdown' | 'all';
  outputDir: string;
  filterStopwords: boolean;
  contextChars: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    minWordFreq: 3,
    minPhraseFreq: 2,
    maxPhraseLength: 5,
    maxOccurrences: 100,
    outputFormat: 'all',
    outputDir: './index-output',
    filterStopwords: true,
    contextChars: 100,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--min-word-freq':
        config.minWordFreq = parseInt(args[++i], 10);
        break;
      case '--min-phrase-freq':
        config.minPhraseFreq = parseInt(args[++i], 10);
        break;
      case '--max-phrases':
        config.maxPhraseLength = parseInt(args[++i], 10);
        break;
      case '--max-occurrences':
        config.maxOccurrences = parseInt(args[++i], 10);
        break;
      case '--format':
        config.outputFormat = args[++i] as any;
        break;
      case '--output-dir':
        config.outputDir = args[++i];
        break;
      case '--no-stopwords':
        config.filterStopwords = false;
        break;
      case '--context-chars':
        config.contextChars = parseInt(args[++i], 10);
        break;
    }
  }

  return config;
}

/**
 * Extract and normalize text content from markdown/HTML
 */
function extractTextContent(content: string): string {
  // Remove HTML tags
  let text = content.replace(/<[^>]+>/g, ' ');

  // Remove markdown links but keep the text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove markdown images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]+`/g, ' ');

  // Remove URLs
  text = text.replace(/https?:\/\/[^\s]+/g, ' ');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  // Split on word boundaries and convert to lowercase
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Get context around a word position
 */
function getContext(
  text: string,
  position: number,
  contextChars: number
): string {
  const start = Math.max(0, position - contextChars);
  const end = Math.min(text.length, position + contextChars);

  let context = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.replace(/\s+/g, ' ').trim();
}

/**
 * Generate n-grams (phrases) from tokens
 */
function generateNGrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];

  for (let i = 0; i <= tokens.length - n; i++) {
    const ngram = tokens.slice(i, i + n).join(' ');
    ngrams.push(ngram);
  }

  return ngrams;
}

/**
 * Build word index from all emails
 */
function buildWordIndex(
  emails: any[],
  config: Config
): Map<string, WordOccurrence[]> {
  const wordIndex = new Map<string, WordOccurrence[]>();
  const wordCounts = new Map<string, number>();

  logger.info(`Analyzing ${emails.length} emails for words...`);
  logger.info('Phase 1: Counting word frequencies...');

  // First pass: count word frequencies
  for (const email of emails) {
    const content = email.normalized_markdown || email.body || '';
    const text = extractTextContent(content);
    const tokens = tokenize(text);

    // Track words we've seen in this email to avoid counting multiple times
    const seenInEmail = new Set<string>();

    // Track each word occurrence
    tokens.forEach((word) => {
      // Skip stopwords if filtering is enabled
      if (config.filterStopwords && STOPWORDS.has(word)) {
        return;
      }

      // Skip very short words (likely fragments)
      if (word.length < 2) {
        return;
      }

      // Only count once per email
      if (!seenInEmail.has(word)) {
        seenInEmail.add(word);
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });
  }

  // Filter words by minimum frequency
  const frequentWords = new Set<string>();
  for (const [word, count] of wordCounts.entries()) {
    if (count >= config.minWordFreq) {
      frequentWords.add(word);
    }
  }

  logger.info(
    `Phase 2: Building index for ${frequentWords.size} frequent words...`
  );

  // Second pass: collect occurrences only for frequent words
  for (const email of emails) {
    const content = email.normalized_markdown || email.body || '';
    const text = extractTextContent(content);
    const tokens = tokenize(text);

    // Track words we've seen in this email to avoid duplicates
    const seenInEmail = new Set<string>();

    tokens.forEach((word) => {
      // Skip if not frequent enough
      if (!frequentWords.has(word)) {
        return;
      }

      // Skip if we've already processed this word in this email
      if (seenInEmail.has(word)) {
        return;
      }
      seenInEmail.add(word);

      // Find position in original text for context
      const searchText = text.toLowerCase();
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      const match = searchText.match(wordRegex);

      if (match && match.index !== undefined) {
        const position = match.index;
        const context = getContext(text, position, config.contextChars);

        if (!wordIndex.has(word)) {
          wordIndex.set(word, []);
        }

        wordIndex.get(word)!.push({
          emailId: email.id,
          emailSubject: email.subject,
          publishDate: email.publish_date,
          context,
          position,
        });
      }
    });
  }

  logger.success(
    `Found ${wordIndex.size} unique words with ${config.minWordFreq}+ occurrences`
  );
  return wordIndex;
}

/**
 * Build phrase index from all emails
 */
function buildPhraseIndex(
  emails: any[],
  config: Config
): Map<string, PhraseOccurrence[]> {
  const phraseIndex = new Map<string, PhraseOccurrence[]>();
  const phraseCounts = new Map<string, number>();

  logger.info(`Analyzing ${emails.length} emails for phrases...`);
  logger.info('Phase 1: Counting phrase frequencies...');

  // First pass: count phrase frequencies
  for (const email of emails) {
    const content = email.normalized_markdown || email.body || '';
    const text = extractTextContent(content);
    const tokens = tokenize(text);

    // Track phrases we've seen in this email to avoid duplicates
    const seenInEmail = new Set<string>();

    // Generate n-grams for different phrase lengths
    for (let n = 2; n <= config.maxPhraseLength; n++) {
      const ngrams = generateNGrams(tokens, n);

      ngrams.forEach((phrase) => {
        // Skip if we've already seen this phrase in this email
        if (seenInEmail.has(phrase)) {
          return;
        }

        // Skip phrases that are all stopwords
        const phraseWords = phrase.split(' ');
        if (
          config.filterStopwords &&
          phraseWords.every((w) => STOPWORDS.has(w))
        ) {
          return;
        }

        seenInEmail.add(phrase);
        phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
      });
    }
  }

  // Filter phrases by minimum frequency
  const frequentPhrases = new Set<string>();
  for (const [phrase, count] of phraseCounts.entries()) {
    if (count >= config.minPhraseFreq) {
      frequentPhrases.add(phrase);
    }
  }

  logger.info(
    `Phase 2: Building index for ${frequentPhrases.size} frequent phrases...`
  );

  // Second pass: collect occurrences only for frequent phrases
  for (const email of emails) {
    const content = email.normalized_markdown || email.body || '';
    const text = extractTextContent(content);
    const tokens = tokenize(text);
    const searchText = text.toLowerCase();

    // Track phrases we've seen in this email to avoid duplicates
    const seenInEmail = new Set<string>();

    // Generate n-grams for different phrase lengths
    for (let n = 2; n <= config.maxPhraseLength; n++) {
      const ngrams = generateNGrams(tokens, n);

      ngrams.forEach((phrase) => {
        // Skip if not frequent enough
        if (!frequentPhrases.has(phrase)) {
          return;
        }

        // Skip if we've already processed this phrase in this email
        if (seenInEmail.has(phrase)) {
          return;
        }
        seenInEmail.add(phrase);

        // Find phrase in original text for context
        const phrasePos = searchText.indexOf(phrase);

        if (phrasePos !== -1) {
          const context = getContext(text, phrasePos, config.contextChars);

          if (!phraseIndex.has(phrase)) {
            phraseIndex.set(phrase, []);
          }

          phraseIndex.get(phrase)!.push({
            emailId: email.id,
            emailSubject: email.subject,
            publishDate: email.publish_date,
            context,
            position: phrasePos,
          });
        }
      });
    }
  }

  logger.success(
    `Found ${phraseIndex.size} unique phrases with ${config.minPhraseFreq}+ occurrences`
  );
  return phraseIndex;
}

/**
 * Filter and sort index entries by frequency
 */
function processWordIndex(
  wordIndex: Map<string, WordOccurrence[]>,
  minFrequency: number,
  maxOccurrences: number
): WordEntry[] {
  const entries: WordEntry[] = [];

  for (const [word, occurrences] of wordIndex.entries()) {
    if (occurrences.length >= minFrequency) {
      // Sort occurrences by publish date, newest first
      const sortedOccurrences = occurrences.sort((a, b) => {
        if (!a.publishDate) return 1;
        if (!b.publishDate) return -1;
        return b.publishDate.localeCompare(a.publishDate);
      });

      // Limit occurrences to reduce memory usage
      const limitedOccurrences = sortedOccurrences.slice(0, maxOccurrences);

      entries.push({
        word,
        frequency: occurrences.length, // Keep total count
        occurrences: limitedOccurrences,
      });
    }
  }

  // Sort by frequency, highest first
  entries.sort((a, b) => b.frequency - a.frequency);

  return entries;
}

/**
 * Filter and sort phrase entries by frequency
 */
function processPhraseIndex(
  phraseIndex: Map<string, PhraseOccurrence[]>,
  minFrequency: number,
  maxOccurrences: number
): PhraseEntry[] {
  const entries: PhraseEntry[] = [];

  for (const [phrase, occurrences] of phraseIndex.entries()) {
    if (occurrences.length >= minFrequency) {
      // Sort occurrences by publish date, newest first
      const sortedOccurrences = occurrences.sort((a, b) => {
        if (!a.publishDate) return 1;
        if (!b.publishDate) return -1;
        return b.publishDate.localeCompare(a.publishDate);
      });

      // Limit occurrences to reduce memory usage
      const limitedOccurrences = sortedOccurrences.slice(0, maxOccurrences);

      entries.push({
        phrase,
        frequency: occurrences.length, // Keep total count
        occurrences: limitedOccurrences,
      });
    }
  }

  // Sort by frequency, highest first
  entries.sort((a, b) => b.frequency - a.frequency);

  return entries;
}

/**
 * Generate JSON output
 */
function generateJSON(data: IndexData, outputDir: string): void {
  const outputPath = join(outputDir, 'index.json');
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  logger.success(`Generated JSON index: ${outputPath}`);
}

/**
 * Generate HTML output
 */
function generateHTML(data: IndexData, outputDir: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Index</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .metadata {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
    }
    .metadata-label {
      font-weight: 600;
      font-size: 0.85em;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metadata-value {
      font-size: 1.5em;
      color: #2c3e50;
      margin-top: 5px;
    }
    .nav {
      position: sticky;
      top: 0;
      background: white;
      padding: 15px 0;
      border-bottom: 2px solid #eee;
      margin-bottom: 20px;
      z-index: 100;
    }
    .nav a {
      margin-right: 20px;
      text-decoration: none;
      color: #3498db;
      font-weight: 600;
    }
    .nav a:hover {
      text-decoration: underline;
    }
    .section {
      margin-bottom: 50px;
    }
    .index-entry {
      margin-bottom: 30px;
      border-left: 3px solid #3498db;
      padding-left: 20px;
    }
    .term {
      font-size: 1.3em;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 5px;
    }
    .frequency {
      color: #7f8c8d;
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    .occurrence {
      margin: 10px 0;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .occurrence-title {
      font-weight: 600;
      color: #34495e;
      margin-bottom: 5px;
    }
    .occurrence-date {
      font-size: 0.85em;
      color: #7f8c8d;
      margin-bottom: 5px;
    }
    .context {
      font-style: italic;
      color: #555;
      font-size: 0.95em;
      padding: 8px;
      background: white;
      border-radius: 3px;
      margin-top: 5px;
    }
    .search-box {
      margin: 20px 0;
      padding: 10px;
      width: 100%;
      max-width: 500px;
      font-size: 1em;
      border: 2px solid #ddd;
      border-radius: 4px;
    }
    .search-box:focus {
      outline: none;
      border-color: #3498db;
    }
  </style>
</head>
<body>
  <h1>📚 Newsletter Index</h1>
  
  <div class="metadata">
    <h2>Index Statistics</h2>
    <div class="metadata-grid">
      <div class="metadata-item">
        <span class="metadata-label">Generated</span>
        <span class="metadata-value">${new Date(
          data.metadata.generatedAt
        ).toLocaleDateString()}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Total Emails</span>
        <span class="metadata-value">${data.metadata.totalEmails.toLocaleString()}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Unique Words</span>
        <span class="metadata-value">${data.metadata.uniqueWords.toLocaleString()}</span>
      </div>
      <div class="metadata-item">
        <span class="metadata-label">Unique Phrases</span>
        <span class="metadata-value">${data.metadata.uniquePhrases.toLocaleString()}</span>
      </div>
    </div>
  </div>

  <div class="nav">
    <a href="#words">Words</a>
    <a href="#phrases">Phrases</a>
  </div>

  <input type="text" class="search-box" id="searchBox" placeholder="Search index...">

  <div id="words" class="section">
    <h2>Word Index</h2>
    <p>Words appearing at least ${data.metadata.minWordFrequency} times</p>
    ${data.words
      .map(
        (entry) => `
      <div class="index-entry" data-term="${entry.word}">
        <div class="term">${entry.word}</div>
        <div class="frequency">${entry.frequency} occurrence${
          entry.frequency !== 1 ? 's' : ''
        }</div>
        ${entry.occurrences
          .slice(0, 10)
          .map(
            (occ) => `
          <div class="occurrence">
            <div class="occurrence-title">${escapeHtml(occ.emailSubject)}</div>
            ${
              occ.publishDate
                ? `<div class="occurrence-date">${new Date(
                    occ.publishDate
                  ).toLocaleDateString()}</div>`
                : ''
            }
            <div class="context">${escapeHtml(occ.context)}</div>
          </div>
        `
          )
          .join('')}
        ${
          entry.occurrences.length > 10
            ? `<div style="color: #7f8c8d; font-size: 0.9em; margin-top: 10px;">...and ${
                entry.occurrences.length - 10
              } more occurrences</div>`
            : ''
        }
      </div>
    `
      )
      .join('')}
  </div>

  <div id="phrases" class="section">
    <h2>Phrase Index</h2>
    <p>Phrases appearing at least ${data.metadata.minPhraseFrequency} times</p>
    ${data.phrases
      .map(
        (entry) => `
      <div class="index-entry" data-term="${entry.phrase}">
        <div class="term">"${entry.phrase}"</div>
        <div class="frequency">${entry.frequency} occurrence${
          entry.frequency !== 1 ? 's' : ''
        }</div>
        ${entry.occurrences
          .slice(0, 10)
          .map(
            (occ) => `
          <div class="occurrence">
            <div class="occurrence-title">${escapeHtml(occ.emailSubject)}</div>
            ${
              occ.publishDate
                ? `<div class="occurrence-date">${new Date(
                    occ.publishDate
                  ).toLocaleDateString()}</div>`
                : ''
            }
            <div class="context">${escapeHtml(occ.context)}</div>
          </div>
        `
          )
          .join('')}
        ${
          entry.occurrences.length > 10
            ? `<div style="color: #7f8c8d; font-size: 0.9em; margin-top: 10px;">...and ${
                entry.occurrences.length - 10
              } more occurrences</div>`
            : ''
        }
      </div>
    `
      )
      .join('')}
  </div>

  <script>
    // Simple search functionality
    const searchBox = document.getElementById('searchBox');
    const entries = document.querySelectorAll('.index-entry');
    
    searchBox.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      
      entries.forEach(entry => {
        const term = entry.getAttribute('data-term').toLowerCase();
        if (term.includes(query) || query === '') {
          entry.style.display = 'block';
        } else {
          entry.style.display = 'none';
        }
      });
    });
  </script>
</body>
</html>`;

  const outputPath = join(outputDir, 'index.html');
  writeFileSync(outputPath, html);
  logger.success(`Generated HTML index: ${outputPath}`);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Generate Markdown output
 */
function generateMarkdown(data: IndexData, outputDir: string): void {
  const lines: string[] = [];

  lines.push('# Newsletter Index\n');
  lines.push('## Statistics\n');
  lines.push(
    `- **Generated:** ${new Date(
      data.metadata.generatedAt
    ).toLocaleDateString()}`
  );
  lines.push(
    `- **Total Emails:** ${data.metadata.totalEmails.toLocaleString()}`
  );
  lines.push(
    `- **Unique Words:** ${data.metadata.uniqueWords.toLocaleString()}`
  );
  lines.push(
    `- **Unique Phrases:** ${data.metadata.uniquePhrases.toLocaleString()}`
  );
  lines.push('');

  lines.push('## Table of Contents\n');
  lines.push('- [Word Index](#word-index)');
  lines.push('- [Phrase Index](#phrase-index)');
  lines.push('');

  lines.push('## Word Index\n');
  lines.push(
    `Words appearing at least ${data.metadata.minWordFrequency} times.\n`
  );

  for (const entry of data.words) {
    lines.push(`### ${entry.word}`);
    lines.push(
      `*${entry.frequency} occurrence${entry.frequency !== 1 ? 's' : ''}*\n`
    );

    for (const occ of entry.occurrences.slice(0, 5)) {
      lines.push(`**${occ.emailSubject}**`);
      if (occ.publishDate) {
        lines.push(`*${new Date(occ.publishDate).toLocaleDateString()}*`);
      }
      lines.push(`> ${occ.context}`);
      lines.push('');
    }

    if (entry.occurrences.length > 5) {
      lines.push(`*...and ${entry.occurrences.length - 5} more occurrences*\n`);
    }

    lines.push('---\n');
  }

  lines.push('## Phrase Index\n');
  lines.push(
    `Phrases appearing at least ${data.metadata.minPhraseFrequency} times.\n`
  );

  for (const entry of data.phrases) {
    lines.push(`### "${entry.phrase}"`);
    lines.push(
      `*${entry.frequency} occurrence${entry.frequency !== 1 ? 's' : ''}*\n`
    );

    for (const occ of entry.occurrences.slice(0, 5)) {
      lines.push(`**${occ.emailSubject}**`);
      if (occ.publishDate) {
        lines.push(`*${new Date(occ.publishDate).toLocaleDateString()}*`);
      }
      lines.push(`> ${occ.context}`);
      lines.push('');
    }

    if (entry.occurrences.length > 5) {
      lines.push(`*...and ${entry.occurrences.length - 5} more occurrences*\n`);
    }

    lines.push('---\n');
  }

  const outputPath = join(outputDir, 'index.md');
  writeFileSync(outputPath, lines.join('\n'));
  logger.success(`Generated Markdown index: ${outputPath}`);
}

/**
 * Main function
 */
async function main() {
  const config = parseArgs();

  logger.info('Generating newsletter index...');
  logger.info(`Configuration: ${JSON.stringify(config, null, 2)}`);

  // Initialize database
  const db = initializeDatabase();
  const emailQueries = new EmailQueries(db);

  // Get all emails
  const emails = emailQueries.getAllEmails();

  if (emails.length === 0) {
    logger.error('No emails found in database');
    db.close();
    process.exit(1);
  }

  logger.info(`Processing ${emails.length} emails...`);

  // Build indices
  const wordIndex = buildWordIndex(emails, config);
  const phraseIndex = buildPhraseIndex(emails, config);

  // Process and filter indices
  const words = processWordIndex(
    wordIndex,
    config.minWordFreq,
    config.maxOccurrences
  );
  const phrases = processPhraseIndex(
    phraseIndex,
    config.minPhraseFreq,
    config.maxOccurrences
  );

  // Calculate total occurrences
  const totalWords = Array.from(wordIndex.values()).reduce(
    (sum, occs) => sum + occs.length,
    0
  );
  const totalPhrases = Array.from(phraseIndex.values()).reduce(
    (sum, occs) => sum + occs.length,
    0
  );

  // Create index data
  const indexData: IndexData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalEmails: emails.length,
      totalWords,
      totalPhrases,
      uniqueWords: words.length,
      uniquePhrases: phrases.length,
      minWordFrequency: config.minWordFreq,
      minPhraseFrequency: config.minPhraseFreq,
      maxPhraseLength: config.maxPhraseLength,
      maxOccurrencesPerTerm: config.maxOccurrences,
    },
    words,
    phrases,
  };

  // Create output directory
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true });
  }

  // Generate output files
  if (config.outputFormat === 'json' || config.outputFormat === 'all') {
    generateJSON(indexData, config.outputDir);
  }

  if (config.outputFormat === 'html' || config.outputFormat === 'all') {
    generateHTML(indexData, config.outputDir);
  }

  if (config.outputFormat === 'markdown' || config.outputFormat === 'all') {
    generateMarkdown(indexData, config.outputDir);
  }

  logger.success('\n=== Index Generation Complete ===');
  logger.info(`Words indexed: ${words.length.toLocaleString()}`);
  logger.info(`Phrases indexed: ${phrases.length.toLocaleString()}`);
  logger.info(`Output directory: ${config.outputDir}`);

  db.close();
}

// Run main function
main().catch((error) => {
  logger.error('Error generating index:', error);
  process.exit(1);
});
