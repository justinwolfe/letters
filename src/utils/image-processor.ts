/**
 * Image processing utilities for extracting and downloading embedded images
 */

import { logger } from './logger.js';

export interface EmbeddedImage {
  url: string;
  data: Buffer;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
}

/**
 * Extract all image URLs from HTML/Markdown content
 * Looks for <img> tags, Markdown images, and background-image CSS properties
 */
export function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();

  // Match Markdown images: ![alt](url)
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownImageRegex.exec(html)) !== null) {
    const url = match[2];
    if (isRemoteUrl(url)) {
      urls.add(url);
    }
  }

  // Match <img> tags with src attributes
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = imgTagRegex.exec(html)) !== null) {
    const url = match[1];
    if (isRemoteUrl(url)) {
      urls.add(url);
    }
  }

  // Match CSS background-image properties
  const bgImageRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgImageRegex.exec(html)) !== null) {
    const url = match[1];
    if (isRemoteUrl(url)) {
      urls.add(url);
    }
  }

  // Match CSS background properties with url()
  const bgRegex = /background:\s*[^;]*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    const url = match[1];
    if (isRemoteUrl(url)) {
      urls.add(url);
    }
  }

  return Array.from(urls);
}

/**
 * Check if a URL is a remote HTTP(S) URL
 */
function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Download an image from a URL
 */
export async function downloadImage(url: string): Promise<EmbeddedImage> {
  try {
    logger.debug(`Downloading image: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Validate it's actually an image
    if (!contentType.startsWith('image/')) {
      throw new Error(`Not an image: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    // Try to extract dimensions from the image data
    const dimensions = getImageDimensions(data, contentType);

    return {
      url,
      data,
      mimeType: contentType,
      fileSize: data.length,
      width: dimensions?.width,
      height: dimensions?.height,
    };
  } catch (error) {
    logger.error(`Failed to download image ${url}:`, error);
    throw error;
  }
}

/**
 * Basic image dimension extraction (for common formats)
 * This is a simple implementation that handles PNG, JPEG, and GIF
 */
function getImageDimensions(
  data: Buffer,
  mimeType: string
): { width: number; height: number } | undefined {
  try {
    if (mimeType === 'image/png') {
      // PNG: width and height are at bytes 16-23
      if (data.length < 24) return undefined;
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      return { width, height };
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      // JPEG: parse markers to find SOF (Start of Frame)
      let offset = 2; // Skip initial 0xFFD8
      while (offset < data.length - 9) {
        if (data[offset] !== 0xff) break;
        const marker = data[offset + 1];
        // SOF markers (0xC0-0xCF except 0xC4, 0xC8, 0xCC)
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc
        ) {
          const height = data.readUInt16BE(offset + 5);
          const width = data.readUInt16BE(offset + 7);
          return { width, height };
        }
        // Skip to next marker
        const segmentLength = data.readUInt16BE(offset + 2);
        offset += segmentLength + 2;
      }
    } else if (mimeType === 'image/gif') {
      // GIF: width and height are at bytes 6-9
      if (data.length < 10) return undefined;
      const width = data.readUInt16LE(6);
      const height = data.readUInt16LE(8);
      return { width, height };
    }
  } catch (error) {
    logger.debug(`Could not extract dimensions from ${mimeType}:`, error);
  }
  return undefined;
}

/**
 * Replace image URLs in HTML/Markdown with data URIs
 */
export function replaceImageUrls(
  html: string,
  imageMap: Map<string, string>
): string {
  let result = html;

  for (const [originalUrl, dataUri] of imageMap.entries()) {
    // Escape special regex characters in the URL
    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace in Markdown images: ![alt](url)
    result = result.replace(
      new RegExp(`(!\\[[^\\]]*\\]\\()${escapedUrl}(\\))`, 'gi'),
      `$1${dataUri}$2`
    );

    // Replace in img src attributes
    result = result.replace(
      new RegExp(`(<img[^>]+src=["'])${escapedUrl}(["'])`, 'gi'),
      `$1${dataUri}$2`
    );

    // Replace in CSS background-image
    result = result.replace(
      new RegExp(
        `(background-image:\\s*url\\(["']?)${escapedUrl}(["']?\\))`,
        'gi'
      ),
      `$1${dataUri}$2`
    );

    // Replace in CSS background shorthand
    result = result.replace(
      new RegExp(`(background:[^;]*url\\(["']?)${escapedUrl}(["']?\\))`, 'gi'),
      `$1${dataUri}$2`
    );
  }

  return result;
}

/**
 * Convert image data to a data URI
 */
export function imageToDataUri(data: Buffer, mimeType: string): string {
  const base64 = data.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Download all images from HTML and return a map of URL -> data URI
 */
export async function downloadAllImages(
  html: string,
  concurrency = 5
): Promise<Map<string, EmbeddedImage>> {
  const urls = extractImageUrls(html);

  if (urls.length === 0) {
    logger.debug('No images found in HTML');
    return new Map();
  }

  logger.info(`Found ${urls.length} images to download`);

  const results = new Map<string, EmbeddedImage>();
  const errors: string[] = [];

  // Download images with concurrency control
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const promises = batch.map(async (url) => {
      try {
        const image = await downloadImage(url);
        results.set(url, image);
        logger.debug(`✓ Downloaded: ${url} (${formatBytes(image.fileSize)})`);
      } catch (error) {
        errors.push(url);
        logger.warn(`✗ Failed: ${url} - ${error}`);
      }
    });

    await Promise.all(promises);
  }

  if (errors.length > 0) {
    logger.warn(`Failed to download ${errors.length}/${urls.length} images`);
  } else {
    logger.success(`Successfully downloaded all ${urls.length} images`);
  }

  return results;
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
