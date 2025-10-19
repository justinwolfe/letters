/**
 * Generate a topic-based index with links to static site articles
 *
 * This script creates a meaningful, navigable index of topics, themes, people,
 * places, and concepts mentioned across your newsletters. Each entry links
 * directly to the relevant newsletter pages on your static site.
 *
 * Features:
 * - Extracts named entities (people, places, products)
 * - Identifies technical terms and concepts
 * - Finds meaningful multi-word phrases
 * - Filters generic conversational language
 * - Links directly to static site pages
 * - Organized alphabetically and by theme
 *
 * Usage:
 *   tsx scripts/generate-topic-index.ts [options]
 *
 * Options:
 *   --min-frequency <n>    Minimum occurrences to include (default: 3)
 *   --output-dir <path>    Output directory (default: ./public)
 *   --base-url <url>       Base URL for static site (default: /letters/)
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { EmailQueries } from '../lib/db/queries/emails.js';
import { logger } from '../lib/utils/logger.js';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Expanded stopwords to filter generic conversational language
const STOPWORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'also',
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
  'can',
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
  'even',
  'ever',
  'every',
  'few',
  'feel',
  'felt',
  'for',
  'from',
  'further',
  'get',
  'go',
  'going',
  'good',
  'got',
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
  'just',
  'know',
  'last',
  "let's",
  'like',
  'made',
  'make',
  'many',
  'may',
  'me',
  'more',
  'most',
  "mustn't",
  'my',
  'myself',
  'new',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'one',
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
  'really',
  'said',
  'same',
  'say',
  'see',
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
  'thankful',
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
  'things',
  'think',
  'this',
  'those',
  'though',
  'through',
  'time',
  'to',
  'too',
  'two',
  'under',
  'until',
  'up',
  'use',
  'used',
  'very',
  'want',
  'was',
  "wasn't",
  'way',
  'we',
  "we'd",
  "we'll",
  "we're",
  "we've",
  'well',
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
  'will',
  'with',
  "won't",
  'work',
  'would',
  "wouldn't",
  'yes',
  'yet',
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

interface TopicOccurrence {
  emailId: string;
  emailSubject: string;
  publishDate: string | null;
  slug: string | null;
  context: string;
}

interface TopicEntry {
  topic: string;
  type: 'entity' | 'concept' | 'phrase';
  frequency: number;
  occurrences: TopicOccurrence[];
}

interface Config {
  minFrequency: number;
  outputDir: string;
  baseUrl: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    minFrequency: 3,
    outputDir: './public',
    baseUrl: '/letters/',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--min-frequency':
        config.minFrequency = parseInt(args[++i], 10);
        break;
      case '--output-dir':
        config.outputDir = args[++i];
        break;
      case '--base-url':
        config.baseUrl = args[++i];
        break;
    }
  }

  return config;
}

/**
 * Extract clean text from HTML/Markdown
 */
function extractText(content: string): string {
  let text = content.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]+`/g, ' ');
  text = text.replace(/https?:\/\/[^\s]+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Check if a word is capitalized (potential proper noun)
 */
function isCapitalized(word: string): boolean {
  return word.length > 0 && word[0] === word[0].toUpperCase();
}

/**
 * Check if a phrase is meaningful
 */
function isMeaningfulPhrase(phrase: string): boolean {
  const words = phrase.split(' ');

  // Filter out phrases starting with underscore or markdown artifacts
  if (phrase.startsWith('_') || phrase.includes('&#')) {
    return false;
  }

  // Filter out pure numbers or years alone
  if (/^\d+$/.test(phrase) && phrase.length <= 4) {
    return false;
  }

  // Must have at least one capitalized word or technical term
  const hasCapitalized = words.some((w) => isCapitalized(w) && w.length > 2);
  const hasLongWord = words.some((w) => w.length >= 7);

  // Filter out phrases that are all stopwords
  const hasContent = words.some((w) => !STOPWORDS.has(w.toLowerCase()));

  // Filter out single short words
  if (words.length === 1 && words[0].length < 4) {
    return false;
  }

  // Prefer phrases with proper nouns or longer technical terms
  return hasContent && (hasCapitalized || hasLongWord);
}

/**
 * Clean and normalize a topic
 */
function cleanTopic(topic: string): string {
  // Remove markdown formatting
  let cleaned = topic.replace(/^[_*`]+|[_*`]+$/g, '');

  // Remove leading/trailing punctuation except hyphens
  cleaned = cleaned.replace(/^[^\w\s-]+|[^\w\s-]+$/g, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Check if topic should be included
 */
function isValidTopic(topic: string): boolean {
  // Too short
  if (topic.length < 3) return false;

  // Contains markdown or HTML artifacts
  if (topic.includes('_') || topic.includes('*') || topic.includes('`'))
    return false;

  // Pure numbers
  if (/^\d+$/.test(topic)) return false;

  // All lowercase generic words
  const words = topic.split(' ');
  if (words.every((w) => STOPWORDS.has(w.toLowerCase()))) return false;

  // Must have at least one meaningful word
  const hasMeaningful = words.some((w) => {
    const lower = w.toLowerCase();
    return (
      !STOPWORDS.has(lower) &&
      w.length >= 4 &&
      (isCapitalized(w) || w.length >= 7)
    );
  });

  return hasMeaningful;
}

/**
 * Extract named entities (capitalized words/phrases)
 */
function extractEntities(text: string): Map<string, string[]> {
  const entities = new Map<string, string[]>();
  const sentences = text.split(/[.!?]+/);

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);

    // Look for capitalized sequences (but not sentence starts)
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w\s'-]/g, '');

      // Skip if it's likely a sentence start
      if (i === 0) continue;

      if (
        isCapitalized(word) &&
        word.length > 2 &&
        !STOPWORDS.has(word.toLowerCase())
      ) {
        // Try to capture multi-word entities
        let entity = word;
        let j = i + 1;

        while (j < words.length && j < i + 4) {
          const nextWord = words[j].replace(/[^\w\s'-]/g, '');
          if (
            isCapitalized(nextWord) ||
            ['of', 'and', 'the', 'de', 'von', 'van'].includes(
              nextWord.toLowerCase()
            )
          ) {
            entity += ' ' + nextWord;
            j++;
          } else {
            break;
          }
        }

        // Clean and validate
        entity = cleanTopic(entity);
        if (entity.length < 3 || !isValidTopic(entity)) {
          i = j - 1;
          continue;
        }

        // Store entity and its context
        const startIdx = sentence.indexOf(entity);
        if (startIdx !== -1) {
          const contextStart = Math.max(0, startIdx - 50);
          const contextEnd = Math.min(
            sentence.length,
            startIdx + entity.length + 50
          );
          const context = sentence.substring(contextStart, contextEnd).trim();

          if (!entities.has(entity)) {
            entities.set(entity, []);
          }
          entities.get(entity)!.push(context);
        }

        i = j - 1; // Skip past the entity
      }
    }
  }

  return entities;
}

/**
 * Extract meaningful phrases (non-generic n-grams)
 */
function extractPhrases(
  text: string,
  minLength: number = 2,
  maxLength: number = 4
): Map<string, string[]> {
  const phrases = new Map<string, string[]>();
  const words = text.split(/\s+/).map((w) => w.replace(/[^\w\s'-]/g, ''));

  for (let length = minLength; length <= maxLength; length++) {
    for (let i = 0; i <= words.length - length; i++) {
      const phraseWords = words.slice(i, i + length);
      const phrase = phraseWords.join(' ');

      // Skip if not meaningful
      if (!isMeaningfulPhrase(phrase)) continue;

      // Clean the phrase
      const cleanedPhrase = cleanTopic(phrase);
      if (!isValidTopic(cleanedPhrase)) continue;

      // Get context
      const textLower = text.toLowerCase();
      const phraseIdx = textLower.indexOf(cleanedPhrase.toLowerCase());

      if (phraseIdx !== -1) {
        const contextStart = Math.max(0, phraseIdx - 50);
        const contextEnd = Math.min(
          text.length,
          phraseIdx + cleanedPhrase.length + 50
        );
        const context = text.substring(contextStart, contextEnd).trim();

        if (!phrases.has(cleanedPhrase)) {
          phrases.set(cleanedPhrase, []);
        }
        phrases.get(cleanedPhrase)!.push(context);
      }
    }
  }

  return phrases;
}

/**
 * Build topic index from all emails
 */
function buildTopicIndex(emails: any[], config: Config): TopicEntry[] {
  const topicMap = new Map<
    string,
    {
      type: 'entity' | 'concept' | 'phrase';
      occurrences: TopicOccurrence[];
    }
  >();

  logger.info(`Analyzing ${emails.length} emails for topics...`);

  let processedCount = 0;

  for (const email of emails) {
    const content = email.normalized_markdown || email.body || '';
    const text = extractText(content);

    // Extract entities
    const entities = extractEntities(text);
    for (const [entity, contexts] of entities.entries()) {
      if (!topicMap.has(entity)) {
        topicMap.set(entity, { type: 'entity', occurrences: [] });
      }

      // Only add once per email
      const context = contexts[0] || '';
      topicMap.get(entity)!.occurrences.push({
        emailId: email.id,
        emailSubject: email.subject,
        publishDate: email.publish_date,
        slug: email.slug,
        context,
      });
    }

    // Extract meaningful phrases
    const phrases = extractPhrases(text);
    for (const [phrase, contexts] of phrases.entries()) {
      // Skip if already captured as entity
      if (topicMap.has(phrase)) continue;

      if (!topicMap.has(phrase)) {
        topicMap.set(phrase, { type: 'phrase', occurrences: [] });
      }

      // Only add once per email
      const context = contexts[0] || '';
      topicMap.get(phrase)!.occurrences.push({
        emailId: email.id,
        emailSubject: email.subject,
        publishDate: email.publish_date,
        slug: email.slug,
        context,
      });
    }

    processedCount++;
    if (processedCount % 100 === 0) {
      logger.info(`Processed ${processedCount}/${emails.length} emails...`);
    }
  }

  logger.success(`Found ${topicMap.size} unique topics`);

  // Convert to array and filter by frequency
  const topics: TopicEntry[] = [];

  for (const [topic, data] of topicMap.entries()) {
    if (data.occurrences.length >= config.minFrequency) {
      topics.push({
        topic,
        type: data.type,
        frequency: data.occurrences.length,
        occurrences: data.occurrences.sort((a, b) => {
          if (!a.publishDate) return 1;
          if (!b.publishDate) return -1;
          return b.publishDate.localeCompare(a.publishDate);
        }),
      });
    }
  }

  // Sort by frequency, then alphabetically
  topics.sort((a, b) => {
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    return a.topic.localeCompare(b.topic);
  });

  logger.success(
    `Filtered to ${topics.length} topics with ${config.minFrequency}+ occurrences`
  );

  return topics;
}

/**
 * Generate URL for an email
 */
function getEmailUrl(
  email: { slug: string | null; secondary_id: number | null },
  baseUrl: string
): string {
  if (email.slug) {
    return `${baseUrl}${email.slug}.html`;
  } else if (email.secondary_id) {
    return `${baseUrl}${email.secondary_id}.html`;
  }
  return '#';
}

/**
 * Group topics alphabetically
 */
function groupTopicsAlphabetically(
  topics: TopicEntry[]
): Map<string, TopicEntry[]> {
  const groups = new Map<string, TopicEntry[]>();

  for (const topic of topics) {
    const firstChar = topic.topic[0].toUpperCase();
    const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';

    if (!groups.has(letter)) {
      groups.set(letter, []);
    }
    groups.get(letter)!.push(topic);
  }

  return groups;
}

/**
 * Generate HTML index page
 */
function generateIndexPage(topics: TopicEntry[], config: Config): void {
  const groups = groupTopicsAlphabetically(topics);
  const letters = Array.from(groups.keys()).sort();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Topic Index</title>
  <style>
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
      background: #fafafa;
    }
    
    header {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    
    h1 {
      margin: 0 0 10px 0;
      color: #2c3e50;
      font-size: 2.5em;
    }
    
    .subtitle {
      color: #7f8c8d;
      font-size: 1.1em;
      margin: 0;
    }
    
    .stats {
      display: flex;
      gap: 30px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #eee;
    }
    
    .stat {
      display: flex;
      flex-direction: column;
    }
    
    .stat-value {
      font-size: 2em;
      font-weight: 700;
      color: #3498db;
    }
    
    .stat-label {
      font-size: 0.9em;
      color: #7f8c8d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .alphabet-nav {
      position: sticky;
      top: 0;
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 30px;
      z-index: 100;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    
    .alphabet-nav a {
      display: inline-block;
      width: 32px;
      height: 32px;
      line-height: 32px;
      text-align: center;
      text-decoration: none;
      color: #3498db;
      font-weight: 600;
      border-radius: 4px;
      transition: all 0.2s;
    }
    
    .alphabet-nav a:hover {
      background: #3498db;
      color: white;
    }
    
    .search-box {
      margin: 20px 0;
      padding: 12px 20px;
      width: 100%;
      font-size: 1em;
      border: 2px solid #ddd;
      border-radius: 8px;
      transition: border-color 0.2s;
    }
    
    .search-box:focus {
      outline: none;
      border-color: #3498db;
    }
    
    .letter-section {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    
    .letter-heading {
      font-size: 3em;
      color: #3498db;
      margin: 0 0 20px 0;
      padding-bottom: 15px;
      border-bottom: 3px solid #3498db;
    }
    
    .topic-entry {
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #3498db;
    }
    
    .topic-header {
      display: flex;
      align-items: baseline;
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .topic-name {
      font-size: 1.4em;
      font-weight: 600;
      color: #2c3e50;
      margin: 0;
    }
    
    .topic-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-entity {
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .badge-phrase {
      background: #e3f2fd;
      color: #1565c0;
    }
    
    .topic-count {
      color: #7f8c8d;
      font-size: 0.9em;
    }
    
    .occurrences {
      display: grid;
      gap: 10px;
    }
    
    .occurrence-link {
      display: block;
      padding: 12px 15px;
      background: white;
      border-radius: 6px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
      border: 1px solid #e0e0e0;
    }
    
    .occurrence-link:hover {
      transform: translateX(5px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border-color: #3498db;
    }
    
    .occurrence-title {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 5px;
    }
    
    .occurrence-date {
      font-size: 0.85em;
      color: #7f8c8d;
      margin-bottom: 8px;
    }
    
    .occurrence-context {
      font-size: 0.9em;
      color: #555;
      font-style: italic;
      line-height: 1.4;
    }
    
    .show-more {
      display: inline-block;
      margin-top: 10px;
      padding: 8px 16px;
      background: #3498db;
      color: white;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.9em;
      font-weight: 600;
      transition: background 0.2s;
    }
    
    .show-more:hover {
      background: #2980b9;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      header {
        padding: 20px;
      }
      
      h1 {
        font-size: 1.8em;
      }
      
      .stats {
        flex-direction: column;
        gap: 15px;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>📚 Newsletter Topic Index</h1>
    <p class="subtitle">Browse by topic, person, place, or concept</p>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${topics.length}</div>
        <div class="stat-label">Topics</div>
      </div>
      <div class="stat">
        <div class="stat-value">${topics.reduce(
          (sum, t) => sum + t.frequency,
          0
        )}</div>
        <div class="stat-label">Total References</div>
      </div>
      <div class="stat">
        <div class="stat-value">${
          topics.filter((t) => t.type === 'entity').length
        }</div>
        <div class="stat-label">Named Entities</div>
      </div>
    </div>
  </header>

  <nav class="alphabet-nav">
    ${letters.map((letter) => `<a href="#${letter}">${letter}</a>`).join('')}
  </nav>

  <input 
    type="text" 
    class="search-box" 
    id="searchBox" 
    placeholder="Search topics..."
  >

  <main>
    ${letters
      .map((letter) => {
        const letterTopics = groups.get(letter) || [];
        return `
      <section class="letter-section" id="${letter}">
        <h2 class="letter-heading">${letter}</h2>
        ${letterTopics
          .map(
            (topic) => `
          <div class="topic-entry" data-topic="${topic.topic.toLowerCase()}">
            <div class="topic-header">
              <h3 class="topic-name">${escapeHtml(topic.topic)}</h3>
              <span class="topic-badge badge-${topic.type}">${topic.type}</span>
              <span class="topic-count">${topic.frequency} reference${
              topic.frequency !== 1 ? 's' : ''
            }</span>
            </div>
            <div class="occurrences">
              ${topic.occurrences
                .slice(0, 5)
                .map((occ) => {
                  const url = getEmailUrl(
                    { slug: occ.slug, secondary_id: null },
                    config.baseUrl
                  );
                  const date = occ.publishDate
                    ? new Date(occ.publishDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Date unknown';
                  return `
                <a href="${url}" class="occurrence-link">
                  <div class="occurrence-title">${escapeHtml(
                    occ.emailSubject
                  )}</div>
                  <div class="occurrence-date">${date}</div>
                  <div class="occurrence-context">${escapeHtml(
                    occ.context
                  )}</div>
                </a>
                `;
                })
                .join('')}
              ${
                topic.occurrences.length > 5
                  ? `
                <div style="color: #7f8c8d; font-size: 0.9em; padding: 10px;">
                  ...and ${topic.occurrences.length - 5} more reference${
                      topic.occurrences.length - 5 !== 1 ? 's' : ''
                    }
                </div>
              `
                  : ''
              }
            </div>
          </div>
        `
          )
          .join('')}
      </section>
      `;
      })
      .join('')}
  </main>

  <script>
    // Search functionality
    const searchBox = document.getElementById('searchBox');
    const topicEntries = document.querySelectorAll('.topic-entry');
    const sections = document.querySelectorAll('.letter-section');
    
    searchBox.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      
      sections.forEach(section => {
        let hasVisibleTopics = false;
        const topics = section.querySelectorAll('.topic-entry');
        
        topics.forEach(entry => {
          const topic = entry.getAttribute('data-topic');
          if (topic.includes(query) || query === '') {
            entry.style.display = 'block';
            hasVisibleTopics = true;
          } else {
            entry.style.display = 'none';
          }
        });
        
        // Hide section if no visible topics
        section.style.display = hasVisibleTopics || query === '' ? 'block' : 'none';
      });
    });
    
    // Smooth scroll for alphabet nav
    document.querySelectorAll('.alphabet-nav a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  </script>
</body>
</html>`;

  const outputPath = join(config.outputDir, 'topic-index.html');
  writeFileSync(outputPath, html);
  logger.success(`Generated topic index: ${outputPath}`);
}

/**
 * Escape HTML
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
 * Main function
 */
async function main() {
  const config = parseArgs();

  logger.info('Generating topic-based index...');
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

  // Build topic index
  const topics = buildTopicIndex(emails, config);

  // Create output directory
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true });
  }

  // Generate index page
  generateIndexPage(topics, config);

  logger.success('\n=== Topic Index Generation Complete ===');
  logger.info(`Topics indexed: ${topics.length}`);
  logger.info(
    `Named entities: ${topics.filter((t) => t.type === 'entity').length}`
  );
  logger.info(`Output: ${config.outputDir}/topic-index.html`);

  db.close();
}

// Run
main().catch((error) => {
  logger.error('Error generating topic index:', error);
  process.exit(1);
});
