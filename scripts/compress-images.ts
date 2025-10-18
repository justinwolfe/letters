/**
 * Compress embedded images in the database
 * Uses Sharp library for high-quality image compression
 */

import { initializeDatabase } from '../lib/db/schema.js';
import { DatabaseQueries } from '../lib/db/queries/index.js';
import { logger } from '../lib/utils/logger.js';
import sharp from 'sharp';

interface CompressionOptions {
  dryRun?: boolean;
  minSizeKB?: number;
  maxWidth?: number;
  jpegQuality?: number;
  pngQuality?: number;
  convertPngToWebp?: boolean;
  verbose?: boolean;
}

interface CompressionResult {
  id: number;
  originalSize: number;
  compressedSize: number;
  saved: number;
  mimeType: string;
  success: boolean;
  error?: string;
}

async function compressImage(
  imageData: Buffer,
  mimeType: string,
  options: CompressionOptions
): Promise<{ data: Buffer; mimeType: string }> {
  const image = sharp(imageData);
  const metadata = await image.metadata();

  // Resize if image is too large
  if (options.maxWidth && metadata.width && metadata.width > options.maxWidth) {
    image.resize(options.maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });
    logger.debug(
      `Resizing from ${metadata.width}px to max ${options.maxWidth}px width`
    );
  }

  // Determine compression strategy based on MIME type
  if (mimeType === 'image/jpeg') {
    // JPEG compression
    const quality = options.jpegQuality || 85;
    const compressed = await image
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();

    return { data: compressed, mimeType: 'image/jpeg' };
  } else if (mimeType === 'image/png') {
    // PNG handling
    if (options.convertPngToWebp) {
      // Convert to WebP for best compression
      const compressed = await image
        .webp({
          quality: 90,
          effort: 6,
        })
        .toBuffer();

      return { data: compressed, mimeType: 'image/webp' };
    } else {
      // PNG compression
      const quality = options.pngQuality || 80;
      const compressed = await image
        .png({
          quality,
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true,
        })
        .toBuffer();

      return { data: compressed, mimeType: 'image/png' };
    }
  } else if (mimeType === 'image/gif') {
    // For GIFs, convert static ones to PNG or WebP
    // Note: Sharp doesn't handle animated GIFs well, so we'll convert to WebP
    const compressed = await image
      .webp({
        quality: 90,
        effort: 6,
      })
      .toBuffer();

    return { data: compressed, mimeType: 'image/webp' };
  } else if (mimeType === 'image/webp') {
    // Re-compress WebP if it's large
    const compressed = await image
      .webp({
        quality: 90,
        effort: 6,
      })
      .toBuffer();

    return { data: compressed, mimeType: 'image/webp' };
  } else {
    // Unknown format, try to convert to WebP
    const compressed = await image
      .webp({
        quality: 90,
        effort: 6,
      })
      .toBuffer();

    return { data: compressed, mimeType: 'image/webp' };
  }
}

async function compressImagesInDatabase(
  options: CompressionOptions = {}
): Promise<CompressionResult[]> {
  const db = initializeDatabase();
  const queries = new DatabaseQueries(db);

  // Get all embedded images
  const images = queries.images.getAllEmbeddedImages();
  const minSizeBytes = (options.minSizeKB || 100) * 1024;

  // Filter images that meet the size threshold
  const imagesToCompress = images.filter(
    (img) => img.file_size >= minSizeBytes
  );

  logger.info(
    `Found ${imagesToCompress.length} images above ${options.minSizeKB}KB threshold`
  );

  const results: CompressionResult[] = [];
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;

  for (let i = 0; i < imagesToCompress.length; i++) {
    const img = imagesToCompress[i];
    const progress = `[${i + 1}/${imagesToCompress.length}]`;

    try {
      // Get the full image data
      const fullImage = queries.images.getEmbeddedImageById(img.id);
      if (!fullImage) {
        logger.warn(`${progress} Image ${img.id} not found, skipping`);
        continue;
      }

      const originalSize = fullImage.file_size;
      totalOriginalSize += originalSize;

      if (options.verbose) {
        logger.info(
          `${progress} Processing image ${img.id} (${(
            originalSize / 1024
          ).toFixed(2)}KB, ${img.mime_type})`
        );
      }

      // Compress the image
      const { data: compressedData, mimeType: newMimeType } =
        await compressImage(fullImage.image_data, img.mime_type, options);

      const compressedSize = compressedData.length;
      totalCompressedSize += compressedSize;
      const saved = originalSize - compressedSize;
      const percentSaved = ((saved / originalSize) * 100).toFixed(1);

      results.push({
        id: img.id,
        originalSize,
        compressedSize,
        saved,
        mimeType: newMimeType,
        success: true,
      });

      if (saved > 0) {
        logger.success(
          `${progress} Compressed image ${img.id}: ${(
            originalSize / 1024
          ).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(
            2
          )}KB (saved ${percentSaved}%)`
        );
      } else {
        logger.info(
          `${progress} Image ${img.id} already optimal (${(
            originalSize / 1024
          ).toFixed(2)}KB)`
        );
      }

      // Update the database (unless dry run)
      if (!options.dryRun && compressedSize < originalSize) {
        // Get fresh metadata from compressed image
        const metadata = await sharp(compressedData).metadata();

        db.prepare(
          `
          UPDATE embedded_images
          SET image_data = ?,
              mime_type = ?,
              file_size = ?,
              width = ?,
              height = ?
          WHERE id = ?
        `
        ).run(
          compressedData,
          newMimeType,
          compressedSize,
          metadata.width || null,
          metadata.height || null,
          img.id
        );

        logger.debug(`${progress} Updated database for image ${img.id}`);
      }
    } catch (error) {
      logger.error(`${progress} Error compressing image ${img.id}:`, error);
      results.push({
        id: img.id,
        originalSize: img.file_size,
        compressedSize: img.file_size,
        saved: 0,
        mimeType: img.mime_type,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      totalCompressedSize += img.file_size;
    }
  }

  db.close();

  // Print summary
  console.log('\n=== COMPRESSION SUMMARY ===\n');
  console.log(`Total images processed: ${results.length}`);
  console.log(`Successful: ${results.filter((r) => r.success).length}`);
  console.log(`Failed: ${results.filter((r) => !r.success).length}`);
  console.log(
    `\nOriginal total size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`
  );
  console.log(
    `Compressed total size: ${(totalCompressedSize / 1024 / 1024).toFixed(
      2
    )} MB`
  );
  console.log(
    `Total saved: ${(
      (totalOriginalSize - totalCompressedSize) /
      1024 /
      1024
    ).toFixed(2)} MB (${(
      ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) *
      100
    ).toFixed(1)}%)`
  );

  if (options.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes were made to the database');
  }

  // Show images that saved the most
  const topSavings = results
    .filter((r) => r.success && r.saved > 0)
    .sort((a, b) => b.saved - a.saved)
    .slice(0, 10);

  if (topSavings.length > 0) {
    console.log('\n📊 Top 10 compression savings:');
    topSavings.forEach((result, i) => {
      const percentSaved = ((result.saved / result.originalSize) * 100).toFixed(
        1
      );
      console.log(
        `${i + 1}. Image ${result.id}: saved ${(result.saved / 1024).toFixed(
          2
        )}KB (${percentSaved}%)`
      );
    });
  }

  return results;
}

function parseArgs(): CompressionOptions {
  const args = process.argv.slice(2);
  const options: CompressionOptions = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    convertPngToWebp: args.includes('--webp'),
  };

  // Parse minimum size
  const minSizeIndex = args.indexOf('--min-size');
  if (minSizeIndex !== -1 && args[minSizeIndex + 1]) {
    options.minSizeKB = parseInt(args[minSizeIndex + 1], 10);
  } else {
    options.minSizeKB = 100; // Default: compress images over 100KB
  }

  // Parse max width
  const maxWidthIndex = args.indexOf('--max-width');
  if (maxWidthIndex !== -1 && args[maxWidthIndex + 1]) {
    options.maxWidth = parseInt(args[maxWidthIndex + 1], 10);
  } else {
    options.maxWidth = 2000; // Default: max 2000px wide
  }

  // Parse JPEG quality
  const jpegQualityIndex = args.indexOf('--jpeg-quality');
  if (jpegQualityIndex !== -1 && args[jpegQualityIndex + 1]) {
    options.jpegQuality = parseInt(args[jpegQualityIndex + 1], 10);
  } else {
    options.jpegQuality = 85; // Default: 85% quality
  }

  // Parse PNG quality
  const pngQualityIndex = args.indexOf('--png-quality');
  if (pngQualityIndex !== -1 && args[pngQualityIndex + 1]) {
    options.pngQuality = parseInt(args[pngQualityIndex + 1], 10);
  } else {
    options.pngQuality = 80; // Default: 80% quality for PNG
  }

  return options;
}

function printUsage() {
  console.log(`
Image Compression Tool

Usage: npm run images:compress [options]

Options:
  --dry-run              Preview compression without saving changes
  --min-size <KB>        Minimum image size to compress (default: 100)
  --max-width <px>       Maximum width for resizing (default: 2000)
  --jpeg-quality <0-100> JPEG quality (default: 85)
  --png-quality <0-100>  PNG quality (default: 80)
  --webp                 Convert PNG images to WebP format
  --verbose, -v          Show detailed progress
  --help, -h             Show this help message

Examples:
  # Dry run to see potential savings
  npm run images:compress -- --dry-run --verbose

  # Compress images over 500KB with aggressive settings
  npm run images:compress -- --min-size 500 --jpeg-quality 80

  # Convert large PNGs to WebP
  npm run images:compress -- --min-size 500 --webp

  # Compress all images over 100KB and resize to max 1500px
  npm run images:compress -- --max-width 1500
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  try {
    logger.info('Starting image compression...');

    const options = parseArgs();

    console.log('\nCompression settings:');
    console.log(`  Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
    console.log(`  Min size: ${options.minSizeKB}KB`);
    console.log(`  Max width: ${options.maxWidth}px`);
    console.log(`  JPEG quality: ${options.jpegQuality}`);
    console.log(`  PNG quality: ${options.pngQuality}`);
    console.log(
      `  Convert PNG to WebP: ${options.convertPngToWebp ? 'Yes' : 'No'}`
    );
    console.log('');

    const results = await compressImagesInDatabase(options);

    if (results.length === 0) {
      logger.info('No images found matching compression criteria');
    }

    logger.success('Compression complete!');
  } catch (error) {
    logger.error('Error during compression:', error);
    process.exit(1);
  }
}

main();
