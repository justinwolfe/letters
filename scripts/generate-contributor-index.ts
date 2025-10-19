/**
 * Generate HTML index of contributor letters for review
 *
 * Creates a simple HTML page showing all letters organized by author,
 * making it easy to review the classification work.
 *
 * Run with: npm run tsx scripts/generate-contributor-index.ts
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { logger } from '../lib/utils/logger.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface EmailRecord {
  id: string;
  subject: string;
  author: string | null;
  publish_date: string | null;
  slug: string | null;
}

function generateHTML(emailsByAuthor: Map<string, EmailRecord[]>): string {
  const totalEmails = Array.from(emailsByAuthor.values()).reduce(
    (sum, emails) => sum + emails.length,
    0
  );

  const authors = Array.from(emailsByAuthor.keys()).sort((a, b) => {
    // Primary author first, then alphabetically
    if (a === 'primary') return -1;
    if (b === 'primary') return 1;
    return a.localeCompare(b);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Letters Contributors Index</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 2.5em;
    }

    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1em;
    }

    .stats {
      background: #f0f7ff;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      display: flex;
      gap: 30px;
      flex-wrap: wrap;
    }

    .stat {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #0066cc;
    }

    .stat-label {
      color: #666;
      font-size: 0.9em;
    }

    .author-section {
      margin-bottom: 40px;
      border-bottom: 2px solid #eee;
      padding-bottom: 30px;
    }

    .author-section:last-child {
      border-bottom: none;
    }

    .author-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .author-name {
      font-size: 1.5em;
      font-weight: bold;
    }

    .author-count {
      background: rgba(255,255,255,0.2);
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.9em;
    }

    .email-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
    }

    .email-card {
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 15px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .email-card:hover {
      background: #f0f0f0;
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .email-subject {
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
      font-size: 1.05em;
    }

    .email-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #666;
      font-size: 0.85em;
    }

    .email-date {
      color: #999;
    }

    .email-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }

    .email-link:hover {
      text-decoration: underline;
    }

    .no-date {
      color: #cc6666;
      font-style: italic;
    }

    .primary-badge {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
    }

    .contributor-badge {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: white;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
    }

    .toc {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .toc h2 {
      color: #333;
      margin-bottom: 15px;
      font-size: 1.3em;
    }

    .toc-list {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }

    .toc-item {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 10px 15px;
    }

    .toc-link {
      text-decoration: none;
      color: #667eea;
      font-weight: 500;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .toc-link:hover {
      color: #764ba2;
    }

    .toc-count {
      background: #eee;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.85em;
      color: #666;
    }

    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #999;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📬 Letters Contributors Index</h1>
    <p class="subtitle">A comprehensive index of all letters organized by author</p>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${totalEmails}</div>
        <div class="stat-label">Total Letters</div>
      </div>
      <div class="stat">
        <div class="stat-value">${authors.length}</div>
        <div class="stat-label">Authors</div>
      </div>
      <div class="stat">
        <div class="stat-value">${authors.length - 1}</div>
        <div class="stat-label">Guest Contributors</div>
      </div>
    </div>

    <div class="toc">
      <h2>Quick Navigation</h2>
      <ul class="toc-list">
        ${authors
          .map((author) => {
            const emails = emailsByAuthor.get(author)!;
            const displayName =
              author === 'primary' ? '✍️ Primary Author' : `✨ ${author}`;
            return `
          <li class="toc-item">
            <a href="#author-${author}" class="toc-link">
              <span>${displayName}</span>
              <span class="toc-count">${emails.length}</span>
            </a>
          </li>`;
          })
          .join('')}
      </ul>
    </div>

    ${authors
      .map((author) => {
        const emails = emailsByAuthor.get(author)!;
        const displayName = author === 'primary' ? 'Primary Author' : author;
        const isPrimary = author === 'primary';

        return `
    <div class="author-section" id="author-${author}">
      <div class="author-header">
        <div class="author-name">
          ${isPrimary ? '✍️' : '✨'} ${displayName}
        </div>
        <div class="author-count">${emails.length} ${
          emails.length === 1 ? 'letter' : 'letters'
        }</div>
      </div>

      <div class="email-grid">
        ${emails
          .map((email) => {
            const date = email.publish_date
              ? new Date(email.publish_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null;

            return `
        <div class="email-card" onclick="window.open('/letters/${
          email.slug || email.id
        }.html', '_blank')">
          <div class="email-subject">${escapeHtml(
            email.subject || 'Untitled'
          )}</div>
          <div class="email-meta">
            <span class="email-date">${
              date || '<span class="no-date">No date</span>'
            }</span>
            ${
              isPrimary
                ? '<span class="primary-badge">Primary</span>'
                : '<span class="contributor-badge">Guest</span>'
            }
          </div>
        </div>`;
          })
          .join('')}
      </div>
    </div>`;
      })
      .join('')}

    <footer>
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>This index helps review contributor classifications for the Letters project</p>
    </footer>
  </div>
</body>
</html>`;
}

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

async function generateContributorIndex() {
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  try {
    logger.info('Fetching all emails with author information...');
    const emails = queries.emails.getAllEmails() as EmailRecord[];
    logger.info(`Found ${emails.length} emails`);

    // Group emails by author
    const emailsByAuthor = new Map<string, EmailRecord[]>();
    emails.forEach((email) => {
      const author = email.author || 'primary';
      if (!emailsByAuthor.has(author)) {
        emailsByAuthor.set(author, []);
      }
      emailsByAuthor.get(author)!.push(email);
    });

    // Sort emails within each author by publish date
    emailsByAuthor.forEach((emails) => {
      emails.sort((a, b) => {
        if (!a.publish_date) return 1;
        if (!b.publish_date) return -1;
        return (
          new Date(b.publish_date).getTime() -
          new Date(a.publish_date).getTime()
        );
      });
    });

    logger.info(`Found ${emailsByAuthor.size} unique authors`);

    // Generate HTML
    const html = generateHTML(emailsByAuthor);

    // Save to file
    const outputDir = join(process.cwd(), 'contributor-index');
    mkdirSync(outputDir, { recursive: true });

    const outputPath = join(outputDir, 'index.html');
    writeFileSync(outputPath, html);

    logger.success(`Contributor index generated: ${outputPath}`);
    logger.info('\nAuthor breakdown:');
    Array.from(emailsByAuthor.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([author, emails]) => {
        logger.info(
          `  ${author === 'primary' ? 'Primary Author' : author}: ${
            emails.length
          } letters`
        );
      });

    logger.info('\nTo view the index:');
    logger.info(`  1. Open ${outputPath} in your browser`);
    logger.info(`  2. Or run: open ${outputPath}`);
  } catch (error) {
    logger.error('Error generating contributor index:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateContributorIndex().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateContributorIndex };
