/**
 * View and analyze the newsletter index
 *
 * This script provides tools to explore the generated index without
 * loading the large files. It can show top terms, search for specific
 * words/phrases, and generate focused reports.
 *
 * Usage:
 *   tsx scripts/view-index.ts [command] [options]
 *
 * Commands:
 *   top-words [n]        Show top N words by frequency (default: 50)
 *   top-phrases [n]      Show top N phrases by frequency (default: 50)
 *   search <term>        Search for a specific word or phrase
 *   stats                Show index statistics
 *   export-top [n]       Export top N terms to smaller HTML file
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../lib/utils/logger.js';

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
  words: Array<{
    word: string;
    frequency: number;
    occurrences: Array<{
      emailId: string;
      emailSubject: string;
      publishDate: string | null;
      context: string;
      position: number;
    }>;
  }>;
  phrases: Array<{
    phrase: string;
    frequency: number;
    occurrences: Array<{
      emailId: string;
      emailSubject: string;
      publishDate: string | null;
      context: string;
      position: number;
    }>;
  }>;
}

/**
 * Load the index data
 */
function loadIndex(indexPath: string = './index-output/index.json'): IndexData {
  if (!existsSync(indexPath)) {
    logger.error(`Index file not found: ${indexPath}`);
    logger.info('Run: npm run index:generate');
    process.exit(1);
  }

  logger.info(`Loading index from ${indexPath}...`);
  const data = JSON.parse(readFileSync(indexPath, 'utf-8'));
  logger.success('Index loaded successfully');
  return data;
}

/**
 * Show statistics
 */
function showStats(data: IndexData): void {
  console.log('\n📊 Index Statistics\n');
  console.log('═'.repeat(60));
  console.log(
    `Generated:           ${new Date(
      data.metadata.generatedAt
    ).toLocaleString()}`
  );
  console.log(
    `Total Emails:        ${data.metadata.totalEmails.toLocaleString()}`
  );
  console.log(
    `Total Words:         ${data.metadata.totalWords.toLocaleString()}`
  );
  console.log(
    `Total Phrases:       ${data.metadata.totalPhrases.toLocaleString()}`
  );
  console.log(
    `Unique Words:        ${data.metadata.uniqueWords.toLocaleString()}`
  );
  console.log(
    `Unique Phrases:      ${data.metadata.uniquePhrases.toLocaleString()}`
  );
  console.log(`Min Word Frequency:  ${data.metadata.minWordFrequency}`);
  console.log(`Min Phrase Frequency: ${data.metadata.minPhraseFrequency}`);
  console.log(`Max Phrase Length:   ${data.metadata.maxPhraseLength} words`);
  console.log('═'.repeat(60));

  // Additional statistics
  const avgWordFreq = data.metadata.totalWords / data.metadata.uniqueWords;
  const avgPhraseFreq =
    data.metadata.totalPhrases / data.metadata.uniquePhrases;

  console.log(`\nAverage word frequency:   ${avgWordFreq.toFixed(2)}`);
  console.log(`Average phrase frequency: ${avgPhraseFreq.toFixed(2)}`);

  // Top 5 words and phrases
  console.log('\n🏆 Top 5 Words:');
  data.words.slice(0, 5).forEach((entry, i) => {
    console.log(
      `  ${i + 1}. "${
        entry.word
      }" (${entry.frequency.toLocaleString()} occurrences)`
    );
  });

  console.log('\n🏆 Top 5 Phrases:');
  data.phrases.slice(0, 5).forEach((entry, i) => {
    console.log(
      `  ${i + 1}. "${
        entry.phrase
      }" (${entry.frequency.toLocaleString()} occurrences)`
    );
  });
  console.log('');
}

/**
 * Show top words
 */
function showTopWords(data: IndexData, n: number = 50): void {
  console.log(`\n📝 Top ${n} Words by Frequency\n`);
  console.log('═'.repeat(80));

  data.words.slice(0, n).forEach((entry, i) => {
    const rank = (i + 1).toString().padStart(3, ' ');
    const freq = entry.frequency.toString().padStart(5, ' ');
    console.log(`${rank}. ${entry.word.padEnd(30)} ${freq} occurrences`);

    // Show first occurrence
    if (entry.occurrences.length > 0) {
      const occ = entry.occurrences[0];
      const date = occ.publishDate
        ? new Date(occ.publishDate).toLocaleDateString()
        : 'N/A';
      console.log(`     Latest: "${occ.emailSubject}" (${date})`);
      console.log(`     "${occ.context.slice(0, 100)}..."`);
    }
    console.log('');
  });
}

/**
 * Show top phrases
 */
function showTopPhrases(data: IndexData, n: number = 50): void {
  console.log(`\n💬 Top ${n} Phrases by Frequency\n`);
  console.log('═'.repeat(80));

  data.phrases.slice(0, n).forEach((entry, i) => {
    const rank = (i + 1).toString().padStart(3, ' ');
    const freq = entry.frequency.toString().padStart(5, ' ');
    console.log(
      `${rank}. "${entry.phrase}"`.padEnd(50) + `${freq} occurrences`
    );

    // Show first occurrence
    if (entry.occurrences.length > 0) {
      const occ = entry.occurrences[0];
      const date = occ.publishDate
        ? new Date(occ.publishDate).toLocaleDateString()
        : 'N/A';
      console.log(`     Latest: "${occ.emailSubject}" (${date})`);
      console.log(`     "${occ.context.slice(0, 100)}..."`);
    }
    console.log('');
  });
}

/**
 * Search for a specific term
 */
function searchTerm(data: IndexData, term: string): void {
  const normalizedTerm = term.toLowerCase();

  // Search in words
  const wordMatch = data.words.find(
    (w) => w.word.toLowerCase() === normalizedTerm
  );

  // Search in phrases
  const phraseMatch = data.phrases.find((p) =>
    p.phrase.toLowerCase().includes(normalizedTerm)
  );

  if (wordMatch) {
    console.log(`\n🔍 Word Match: "${wordMatch.word}"\n`);
    console.log('═'.repeat(80));
    console.log(
      `Frequency: ${wordMatch.frequency.toLocaleString()} occurrences\n`
    );

    console.log('Recent occurrences:\n');
    wordMatch.occurrences.slice(0, 10).forEach((occ, i) => {
      const date = occ.publishDate
        ? new Date(occ.publishDate).toLocaleDateString()
        : 'N/A';
      console.log(`${i + 1}. "${occ.emailSubject}" (${date})`);
      console.log(`   "${occ.context}"\n`);
    });

    if (wordMatch.occurrences.length > 10) {
      console.log(
        `   ...and ${wordMatch.occurrences.length - 10} more occurrences\n`
      );
    }
  }

  if (phraseMatch) {
    console.log(`\n🔍 Phrase Match: "${phraseMatch.phrase}"\n`);
    console.log('═'.repeat(80));
    console.log(
      `Frequency: ${phraseMatch.frequency.toLocaleString()} occurrences\n`
    );

    console.log('Recent occurrences:\n');
    phraseMatch.occurrences.slice(0, 10).forEach((occ, i) => {
      const date = occ.publishDate
        ? new Date(occ.publishDate).toLocaleDateString()
        : 'N/A';
      console.log(`${i + 1}. "${occ.emailSubject}" (${date})`);
      console.log(`   "${occ.context}"\n`);
    });

    if (phraseMatch.occurrences.length > 10) {
      console.log(
        `   ...and ${phraseMatch.occurrences.length - 10} more occurrences\n`
      );
    }
  }

  if (!wordMatch && !phraseMatch) {
    console.log(`\n❌ No matches found for "${term}"\n`);
  }
}

/**
 * Export top terms to a smaller HTML file
 */
function exportTop(data: IndexData, n: number = 100): void {
  const topWords = data.words.slice(0, n);
  const topPhrases = data.phrases.slice(0, n);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Index - Top ${n} Terms</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2 {
      color: #2c3e50;
    }
    .stats {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
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
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      position: sticky;
      top: 60px;
      z-index: 10;
    }
    .rank {
      width: 50px;
      text-align: center;
      color: #7f8c8d;
    }
    .term {
      font-weight: 600;
      color: #2c3e50;
    }
    .freq {
      width: 150px;
      text-align: right;
      color: #7f8c8d;
    }
    .details {
      font-size: 0.9em;
      color: #555;
    }
    .context {
      font-style: italic;
      color: #666;
      font-size: 0.85em;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <h1>📚 Newsletter Index - Top ${n} Terms</h1>
  
  <div class="stats">
    <h2>Statistics</h2>
    <p><strong>Generated:</strong> ${new Date(
      data.metadata.generatedAt
    ).toLocaleString()}</p>
    <p><strong>Total Emails:</strong> ${data.metadata.totalEmails.toLocaleString()}</p>
    <p><strong>Showing:</strong> Top ${n} of ${data.metadata.uniqueWords.toLocaleString()} words and ${data.metadata.uniquePhrases.toLocaleString()} phrases</p>
  </div>

  <div class="nav">
    <a href="#words">Top Words</a>
    <a href="#phrases">Top Phrases</a>
  </div>

  <h2 id="words">Top ${n} Words</h2>
  <table>
    <thead>
      <tr>
        <th class="rank">#</th>
        <th>Word</th>
        <th class="freq">Frequency</th>
        <th>Latest Example</th>
      </tr>
    </thead>
    <tbody>
      ${topWords
        .map((entry, i) => {
          const occ = entry.occurrences[0];
          const date = occ?.publishDate
            ? new Date(occ.publishDate).toLocaleDateString()
            : 'N/A';
          return `
          <tr>
            <td class="rank">${i + 1}</td>
            <td class="term">${entry.word}</td>
            <td class="freq">${entry.frequency.toLocaleString()}</td>
            <td>
              <div class="details">"${occ?.emailSubject}" (${date})</div>
              <div class="context">${occ?.context}</div>
            </td>
          </tr>
        `;
        })
        .join('')}
    </tbody>
  </table>

  <h2 id="phrases">Top ${n} Phrases</h2>
  <table>
    <thead>
      <tr>
        <th class="rank">#</th>
        <th>Phrase</th>
        <th class="freq">Frequency</th>
        <th>Latest Example</th>
      </tr>
    </thead>
    <tbody>
      ${topPhrases
        .map((entry, i) => {
          const occ = entry.occurrences[0];
          const date = occ?.publishDate
            ? new Date(occ.publishDate).toLocaleDateString()
            : 'N/A';
          return `
          <tr>
            <td class="rank">${i + 1}</td>
            <td class="term">"${entry.phrase}"</td>
            <td class="freq">${entry.frequency.toLocaleString()}</td>
            <td>
              <div class="details">"${occ?.emailSubject}" (${date})</div>
              <div class="context">${occ?.context}</div>
            </td>
          </tr>
        `;
        })
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

  const outputPath = join('./index-output', `index-top-${n}.html`);
  writeFileSync(outputPath, html);
  logger.success(`Exported top ${n} terms to: ${outputPath}`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';

  // Load index
  const data = loadIndex();

  switch (command) {
    case 'stats':
      showStats(data);
      break;

    case 'top-words':
      const wordCount = args[1] ? parseInt(args[1], 10) : 50;
      showTopWords(data, wordCount);
      break;

    case 'top-phrases':
      const phraseCount = args[1] ? parseInt(args[1], 10) : 50;
      showTopPhrases(data, phraseCount);
      break;

    case 'search':
      if (!args[1]) {
        logger.error('Please provide a search term');
        process.exit(1);
      }
      searchTerm(data, args.slice(1).join(' '));
      break;

    case 'export-top':
      const exportCount = args[1] ? parseInt(args[1], 10) : 100;
      exportTop(data, exportCount);
      break;

    default:
      console.log(`
📚 Newsletter Index Viewer

Usage:
  tsx scripts/view-index.ts [command] [options]

Commands:
  stats              Show index statistics (default)
  top-words [n]      Show top N words (default: 50)
  top-phrases [n]    Show top N phrases (default: 50)
  search <term>      Search for a specific word or phrase
  export-top [n]     Export top N terms to smaller HTML (default: 100)

Examples:
  tsx scripts/view-index.ts stats
  tsx scripts/view-index.ts top-words 100
  tsx scripts/view-index.ts search "artificial intelligence"
  tsx scripts/view-index.ts export-top 200
      `);
  }
}

main();
