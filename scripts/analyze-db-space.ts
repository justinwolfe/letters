/**
 * Analyze database space usage by table and content type
 */

import { initializeDatabase } from '../lib/db/schema.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface TableSize {
  name: string;
  rows: number;
  totalSize: number;
  avgRowSize: number;
}

function analyzeDatabase() {
  const db = initializeDatabase();

  console.log('\n=== DATABASE SPACE ANALYSIS ===\n');

  // Get overall database info
  const pageCount = db.prepare('PRAGMA page_count').get() as {
    page_count: number;
  };
  const pageSize = db.prepare('PRAGMA page_size').get() as {
    page_size: number;
  };
  const totalSize = pageCount.page_count * pageSize.page_size;

  console.log('📊 OVERALL DATABASE');
  console.log(`Total pages: ${pageCount.page_count}`);
  console.log(`Page size: ${pageSize.page_size} bytes`);
  console.log(`Database size: ${formatBytes(totalSize)}`);

  // Get table sizes
  const tables = [
    'emails',
    'attachments',
    'email_attachments',
    'embedded_images',
    'sync_metadata',
  ];
  const tableSizes: TableSize[] = [];

  console.log('\n📋 TABLE SIZES\n');

  for (const table of tables) {
    try {
      const countResult = db
        .prepare(`SELECT COUNT(*) as count FROM ${table}`)
        .get() as { count: number };
      const rows = countResult.count;

      // Get approximate size using dbstat virtual table (if available)
      let totalSize = 0;
      try {
        const sizeResult = db
          .prepare(
            `
          SELECT SUM(pgsize) as size 
          FROM dbstat 
          WHERE name = ?
        `
          )
          .get(table) as { size: number | null };
        totalSize = sizeResult.size || 0;
      } catch {
        // dbstat not available, estimate from actual data
        // This is a fallback
        totalSize = 0;
      }

      const avgRowSize = rows > 0 ? totalSize / rows : 0;

      tableSizes.push({
        name: table,
        rows,
        totalSize,
        avgRowSize,
      });

      console.log(`${table}:`);
      console.log(`  Rows: ${rows.toLocaleString()}`);
      if (totalSize > 0) {
        console.log(`  Size: ${formatBytes(totalSize)}`);
        console.log(`  Avg row: ${formatBytes(avgRowSize)}`);
      }
      console.log('');
    } catch (error) {
      console.log(`${table}: Error - ${error}`);
    }
  }

  // Analyze emails table content
  console.log('📧 EMAIL CONTENT ANALYSIS\n');

  const emails = db
    .prepare('SELECT id, subject, body, normalized_markdown FROM emails')
    .all() as Array<{
    id: string;
    subject: string;
    body: string;
    normalized_markdown: string | null;
  }>;

  let totalBodySize = 0;
  let totalNormalizedSize = 0;
  let totalSubjectSize = 0;

  for (const email of emails) {
    totalSubjectSize += Buffer.byteLength(email.subject || '', 'utf8');
    totalBodySize += Buffer.byteLength(email.body || '', 'utf8');
    totalNormalizedSize += Buffer.byteLength(
      email.normalized_markdown || '',
      'utf8'
    );
  }

  console.log(`Total emails: ${emails.length}`);
  console.log(
    `Subject text: ${formatBytes(totalSubjectSize)} (avg ${formatBytes(
      totalSubjectSize / emails.length
    )})`
  );
  console.log(
    `Body HTML: ${formatBytes(totalBodySize)} (avg ${formatBytes(
      totalBodySize / emails.length
    )})`
  );
  console.log(
    `Normalized markdown: ${formatBytes(
      totalNormalizedSize
    )} (avg ${formatBytes(totalNormalizedSize / emails.length)})`
  );
  console.log(
    `Total text content: ${formatBytes(
      totalSubjectSize + totalBodySize + totalNormalizedSize
    )}`
  );

  // Analyze embedded images table
  console.log('\n🖼️  EMBEDDED IMAGES BREAKDOWN\n');

  const imageStats = db
    .prepare(
      `
    SELECT 
      SUM(file_size) as total_size,
      COUNT(*) as count,
      AVG(file_size) as avg_size
    FROM embedded_images
  `
    )
    .get() as { total_size: number; count: number; avg_size: number };

  console.log(`Total images: ${imageStats.count}`);
  console.log(`Total image data: ${formatBytes(imageStats.total_size)}`);
  console.log(`Average image size: ${formatBytes(imageStats.avg_size)}`);

  // Calculate overhead (metadata, indices, etc.)
  const accountedSize =
    totalSubjectSize +
    totalBodySize +
    totalNormalizedSize +
    imageStats.total_size;
  const overhead = totalSize - accountedSize;

  console.log('\n💾 SPACE ACCOUNTING\n');
  console.log(
    `Image data:           ${formatBytes(imageStats.total_size)} (${(
      (imageStats.total_size / totalSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `Email HTML (body):    ${formatBytes(totalBodySize)} (${(
      (totalBodySize / totalSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `Markdown (normalized):${formatBytes(totalNormalizedSize)} (${(
      (totalNormalizedSize / totalSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `Subjects:             ${formatBytes(totalSubjectSize)} (${(
      (totalSubjectSize / totalSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `Metadata & overhead:  ${formatBytes(overhead)} (${(
      (overhead / totalSize) *
      100
    ).toFixed(1)}%)`
  );
  console.log(`${'─'.repeat(50)}`);
  console.log(`Total:                ${formatBytes(totalSize)}`);

  // Find largest emails
  console.log('\n📈 TOP 10 LARGEST EMAILS (by text content)\n');

  const largestEmails = emails
    .map((email) => ({
      id: email.id,
      subject: email.subject,
      bodySize: Buffer.byteLength(email.body || '', 'utf8'),
      normalizedSize: Buffer.byteLength(
        email.normalized_markdown || '',
        'utf8'
      ),
      totalSize:
        Buffer.byteLength(email.body || '', 'utf8') +
        Buffer.byteLength(email.normalized_markdown || '', 'utf8') +
        Buffer.byteLength(email.subject || '', 'utf8'),
    }))
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 10);

  largestEmails.forEach((email, i) => {
    console.log(`${i + 1}. ${email.subject.substring(0, 60)}...`);
    console.log(`   ID: ${email.id}`);
    console.log(
      `   Body: ${formatBytes(email.bodySize)}, Markdown: ${formatBytes(
        email.normalizedSize
      )}`
    );
    console.log(`   Total: ${formatBytes(email.totalSize)}`);
    console.log('');
  });

  // Check if there's duplication between body and normalized_markdown
  console.log('🔍 DUPLICATION ANALYSIS\n');

  const withBoth = emails.filter((e) => e.body && e.normalized_markdown);
  console.log(
    `Emails with both body and normalized_markdown: ${withBoth.length}`
  );

  if (withBoth.length > 0) {
    const bodyOnlyTotal = withBoth.reduce(
      (sum, e) => sum + Buffer.byteLength(e.body || '', 'utf8'),
      0
    );
    const normalizedOnlyTotal = withBoth.reduce(
      (sum, e) => sum + Buffer.byteLength(e.normalized_markdown || '', 'utf8'),
      0
    );
    const bothTotal = bodyOnlyTotal + normalizedOnlyTotal;

    console.log(`Space used by body: ${formatBytes(bodyOnlyTotal)}`);
    console.log(
      `Space used by normalized_markdown: ${formatBytes(normalizedOnlyTotal)}`
    );
    console.log(`Total for both: ${formatBytes(bothTotal)}`);
    console.log(
      `\n⚠️  You're storing both HTML and Markdown for ${withBoth.length} emails`
    );
    console.log(
      `   This uses ${formatBytes(bothTotal)} vs ${formatBytes(
        Math.max(bodyOnlyTotal, normalizedOnlyTotal)
      )} if storing only one`
    );
    console.log(
      `   Potential savings: ${formatBytes(
        bothTotal - Math.max(bodyOnlyTotal, normalizedOnlyTotal)
      )}`
    );
  }

  db.close();
}

analyzeDatabase();
