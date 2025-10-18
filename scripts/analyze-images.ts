/**
 * Analyze embedded images in the database
 * Provides statistics about image sizes, resolutions, and recommendations for compression
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries.js';
import { logger } from '../lib/utils/logger.js';

interface ImageStats {
  id: number;
  email_id: string;
  original_url: string;
  mime_type: string;
  file_size: number;
  width?: number;
  height?: number;
  downloaded_at: string;
}

interface ImageAnalysis {
  totalImages: number;
  totalSize: number;
  avgSize: number;
  medianSize: number;
  largestImages: ImageStats[];
  sizeByType: Map<string, { count: number; totalSize: number }>;
  sizeDistribution: {
    under100KB: number;
    between100KBand500KB: number;
    between500KBand1MB: number;
    over1MB: number;
    over2MB: number;
  };
  resolutionStats: {
    hasResolution: number;
    avgWidth?: number;
    avgHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
}

function analyzeImages(images: ImageStats[]): ImageAnalysis {
  if (images.length === 0) {
    return {
      totalImages: 0,
      totalSize: 0,
      avgSize: 0,
      medianSize: 0,
      largestImages: [],
      sizeByType: new Map(),
      sizeDistribution: {
        under100KB: 0,
        between100KBand500KB: 0,
        between500KBand1MB: 0,
        over1MB: 0,
        over2MB: 0,
      },
      resolutionStats: {
        hasResolution: 0,
      },
    };
  }

  const totalSize = images.reduce((sum, img) => sum + img.file_size, 0);
  const avgSize = totalSize / images.length;

  // Calculate median
  const sortedSizes = images.map((img) => img.file_size).sort((a, b) => a - b);
  const medianSize = sortedSizes[Math.floor(sortedSizes.length / 2)];

  // Top 20 largest images
  const largestImages = [...images]
    .sort((a, b) => b.file_size - a.file_size)
    .slice(0, 20);

  // Size by MIME type
  const sizeByType = new Map<string, { count: number; totalSize: number }>();
  images.forEach((img) => {
    const stats = sizeByType.get(img.mime_type) || {
      count: 0,
      totalSize: 0,
    };
    stats.count++;
    stats.totalSize += img.file_size;
    sizeByType.set(img.mime_type, stats);
  });

  // Size distribution
  const sizeDistribution = {
    under100KB: 0,
    between100KBand500KB: 0,
    between500KBand1MB: 0,
    over1MB: 0,
    over2MB: 0,
  };

  images.forEach((img) => {
    const sizeKB = img.file_size / 1024;
    const sizeMB = sizeKB / 1024;

    if (sizeKB < 100) {
      sizeDistribution.under100KB++;
    } else if (sizeKB < 500) {
      sizeDistribution.between100KBand500KB++;
    } else if (sizeMB < 1) {
      sizeDistribution.between500KBand1MB++;
    } else {
      sizeDistribution.over1MB++;
      if (sizeMB > 2) {
        sizeDistribution.over2MB++;
      }
    }
  });

  // Resolution statistics
  const imagesWithResolution = images.filter(
    (img) => img.width != null && img.height != null
  );
  const resolutionStats: ImageAnalysis['resolutionStats'] = {
    hasResolution: imagesWithResolution.length,
  };

  if (imagesWithResolution.length > 0) {
    resolutionStats.avgWidth =
      imagesWithResolution.reduce((sum, img) => sum + (img.width || 0), 0) /
      imagesWithResolution.length;
    resolutionStats.avgHeight =
      imagesWithResolution.reduce((sum, img) => sum + (img.height || 0), 0) /
      imagesWithResolution.length;
    resolutionStats.maxWidth = Math.max(
      ...imagesWithResolution.map((img) => img.width || 0)
    );
    resolutionStats.maxHeight = Math.max(
      ...imagesWithResolution.map((img) => img.height || 0)
    );
  }

  return {
    totalImages: images.length,
    totalSize,
    avgSize,
    medianSize,
    largestImages,
    sizeByType,
    sizeDistribution,
    resolutionStats,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function printAnalysis(analysis: ImageAnalysis) {
  console.log('\n=== IMAGE ANALYSIS REPORT ===\n');

  // Overall stats
  console.log('📊 OVERALL STATISTICS');
  console.log(`Total images: ${analysis.totalImages}`);
  console.log(`Total size: ${formatBytes(analysis.totalSize)}`);
  console.log(`Average size: ${formatBytes(analysis.avgSize)}`);
  console.log(`Median size: ${formatBytes(analysis.medianSize)}`);

  // Size distribution
  console.log('\n📈 SIZE DISTRIBUTION');
  console.log(`  < 100 KB:        ${analysis.sizeDistribution.under100KB}`);
  console.log(
    `  100 KB - 500 KB: ${analysis.sizeDistribution.between100KBand500KB}`
  );
  console.log(
    `  500 KB - 1 MB:   ${analysis.sizeDistribution.between500KBand1MB}`
  );
  console.log(`  > 1 MB:          ${analysis.sizeDistribution.over1MB}`);
  console.log(`  > 2 MB:          ${analysis.sizeDistribution.over2MB}`);

  // By MIME type
  console.log('\n🎨 BY MIME TYPE');
  Array.from(analysis.sizeByType.entries())
    .sort((a, b) => b[1].totalSize - a[1].totalSize)
    .forEach(([type, stats]) => {
      console.log(
        `  ${type}: ${stats.count} images, ${formatBytes(
          stats.totalSize
        )} (avg: ${formatBytes(stats.totalSize / stats.count)})`
      );
    });

  // Resolution stats
  console.log('\n📐 RESOLUTION STATISTICS');
  if (analysis.resolutionStats.hasResolution > 0) {
    console.log(
      `Images with resolution data: ${analysis.resolutionStats.hasResolution} / ${analysis.totalImages}`
    );
    console.log(
      `Average dimensions: ${analysis.resolutionStats.avgWidth?.toFixed(
        0
      )}x${analysis.resolutionStats.avgHeight?.toFixed(0)}px`
    );
    console.log(
      `Max dimensions: ${analysis.resolutionStats.maxWidth}x${analysis.resolutionStats.maxHeight}px`
    );
  } else {
    console.log('No resolution data available');
  }

  // Largest images
  console.log('\n🔍 TOP 20 LARGEST IMAGES');
  analysis.largestImages.forEach((img, index) => {
    const resolution =
      img.width && img.height ? ` (${img.width}x${img.height}px)` : '';
    console.log(
      `${index + 1}. ${formatBytes(img.file_size)}${resolution} - ${
        img.mime_type
      }`
    );
    console.log(`   URL: ${img.original_url.substring(0, 80)}...`);
    console.log(`   Email ID: ${img.email_id}`);
  });

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');

  const potentialSavings = calculatePotentialSavings(analysis);
  console.log(`\nPotential storage savings: ${formatBytes(potentialSavings)}`);
  console.log(
    `Percentage reduction: ${(
      (potentialSavings / analysis.totalSize) *
      100
    ).toFixed(1)}%`
  );

  printCompressionRecommendations(analysis);
}

function calculatePotentialSavings(analysis: ImageAnalysis): number {
  let savings = 0;

  // Estimate savings based on typical compression ratios
  // JPEGs over 500KB: 50% reduction (quality 85)
  // PNGs over 500KB: 70% reduction (convert to WebP or optimize)
  // Images over 1MB: 60% reduction on average

  analysis.largestImages.forEach((img) => {
    if (img.file_size > 1024 * 1024) {
      // Over 1MB
      if (img.mime_type === 'image/png') {
        savings += img.file_size * 0.7; // 70% reduction for large PNGs
      } else if (img.mime_type === 'image/jpeg') {
        savings += img.file_size * 0.5; // 50% reduction for large JPEGs
      }
    } else if (img.file_size > 500 * 1024) {
      // Over 500KB
      if (img.mime_type === 'image/png') {
        savings += img.file_size * 0.6; // 60% reduction
      } else if (img.mime_type === 'image/jpeg') {
        savings += img.file_size * 0.4; // 40% reduction
      }
    }
  });

  return savings;
}

function printCompressionRecommendations(analysis: ImageAnalysis) {
  console.log('\n🎯 COMPRESSION STRATEGY:\n');

  if (analysis.sizeDistribution.over1MB > 0) {
    console.log(
      `1. Priority: ${analysis.sizeDistribution.over1MB} images over 1MB`
    );
    console.log(
      '   → Aggressive compression (quality 85 for JPEG, WebP for PNG)'
    );
    console.log('   → Expected: 50-70% size reduction\n');
  }

  if (analysis.sizeDistribution.between500KBand1MB > 0) {
    console.log(
      `2. Medium priority: ${analysis.sizeDistribution.between500KBand1MB} images 500KB-1MB`
    );
    console.log('   → Moderate compression (quality 90 for JPEG)');
    console.log('   → Expected: 30-50% size reduction\n');
  }

  if (analysis.sizeDistribution.between100KBand500KB > 0) {
    console.log(
      `3. Low priority: ${analysis.sizeDistribution.between100KBand500KB} images 100KB-500KB`
    );
    console.log('   → Light optimization (quality 92 for JPEG)');
    console.log('   → Expected: 15-30% size reduction\n');
  }

  console.log('\n📋 RECOMMENDED SETTINGS:\n');
  console.log('For JPEG images:');
  console.log(
    '  - Quality 85 for images > 1MB (barely noticeable quality loss)'
  );
  console.log('  - Quality 90 for images 500KB-1MB');
  console.log('  - Quality 92 for images 100KB-500KB');
  console.log('  - Max width: 2000px (sufficient for modern displays)');
  console.log('  - Convert progressive JPEG for faster loading\n');

  console.log('For PNG images:');
  console.log('  - Consider converting to WebP (70% smaller, great quality)');
  console.log('  - Or use pngquant for lossy PNG compression');
  console.log('  - Or use optipng/pngcrush for lossless optimization');
  console.log('  - Preserve transparency where needed\n');

  console.log('For GIF images:');
  console.log('  - Convert static GIFs to PNG/WebP');
  console.log('  - Optimize animated GIFs or convert to video\n');

  console.log('\n🔧 IMPLEMENTATION OPTIONS:\n');
  console.log('Option 1: Sharp library (recommended)');
  console.log('  - Fast, modern, supports all formats');
  console.log('  - Can resize, compress, and convert formats');
  console.log('  - npm install sharp\n');

  console.log('Option 2: Browser-native Canvas API');
  console.log('  - No dependencies');
  console.log('  - Limited to JPEG/PNG');
  console.log('  - Slower than Sharp\n');

  console.log('Option 3: ImageMagick (via imagemagick package)');
  console.log('  - Very powerful but slower');
  console.log('  - Requires system install\n');

  console.log('\n⚠️  IMPORTANT CONSIDERATIONS:\n');
  console.log('1. Always keep original URLs in case reprocessing is needed');
  console.log('2. Test compression on a sample first');
  console.log('3. Create backup before bulk compression');
  console.log('4. Verify visual quality after compression');
  console.log('5. Consider max dimensions (e.g., 2000px wide is sufficient)');
}

async function main() {
  try {
    logger.info('Starting image analysis...');

    const db = initializeDatabase();
    const queries = new DatabaseQueries(db);

    // Get all embedded images (without loading the actual BLOB data)
    const images = queries.getAllEmbeddedImages();

    if (images.length === 0) {
      logger.warn('No embedded images found in database');
      console.log(
        '\nNo images to analyze. Run "npm run images:download" first.'
      );
      return;
    }

    logger.success(`Found ${images.length} images to analyze`);

    // Perform analysis
    const analysis = analyzeImages(images);

    // Print results
    printAnalysis(analysis);

    db.close();
  } catch (error) {
    logger.error('Error analyzing images:', error);
    process.exit(1);
  }
}

main();
