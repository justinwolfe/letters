/**
 * Markdown normalization utilities
 *
 * Converts HTML and markdown content to clean, normalized markdown format.
 * Removes HTML comments, excessive whitespace, and normalizes line breaks
 * while preserving essential formatting (links, images, headings, lists, etc).
 *
 * @example
 * ```typescript
 * import { normalizeToMarkdown } from './lib/utils/markdown-normalizer.js';
 *
 * const html = '<h1>Title</h1><p>Content with <strong>bold</strong> text</p>';
 * const markdown = normalizeToMarkdown(html);
 * console.log(markdown); // # Title\n\nContent with **bold** text
 * ```
 */

import TurndownService from 'turndown';
import { logger } from './logger.js';

/**
 * Create a configured Turndown service that only preserves basic formatting
 *
 * Configures the Turndown service to:
 * - Use ATX-style headings (#)
 * - Remove script tags, styles, and other non-content elements
 * - Preserve essential formatting (links, images, bold, italic, code)
 * - Handle block-level elements properly
 *
 * @returns Configured Turndown service instance
 */
function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx', // Use # style headings
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
  });

  // Remove rules for elements we don't want to preserve
  // Keep only: links, images, headings, lists, strong, em, code, pre
  turndownService.remove([
    'style',
    'script',
    'noscript',
    'iframe',
    'object',
    'embed',
    'video',
    'audio',
    'canvas',
    'svg',
    'math',
    'form',
    'input',
    'textarea',
    'button',
    'select',
    'option',
  ]);

  // Add custom rule to handle divs as block-level elements (paragraph breaks)
  // while stripping other container elements
  turndownService.addRule('handleDivs', {
    filter: 'div',
    replacement: (content, node) => {
      // If the div only contains a <br/> (or is empty/whitespace), treat it as a paragraph break
      const textContent = (node as any).textContent?.trim() || '';
      if (!textContent || textContent === '') {
        return '\n\n';
      }
      // Otherwise, treat the div as a paragraph with line breaks before and after
      return '\n\n' + content + '\n\n';
    },
  });

  // Strip out other container elements but keep their content
  turndownService.addRule('stripContainers', {
    filter: [
      'span',
      'section',
      'article',
      'header',
      'footer',
      'nav',
      'aside',
      'main',
      'figure',
      'figcaption',
    ],
    replacement: (content) => content,
  });

  // Add custom rule for tables - convert to simple text representation
  turndownService.addRule('simpleTables', {
    filter: 'table',
    replacement: (content) => {
      // Just extract the text content, don't try to preserve table structure
      return '\n' + content + '\n';
    },
  });

  // Strip out data attributes, style attributes, etc
  turndownService.addRule('cleanAttributes', {
    filter: (node: any) => {
      if (node.nodeType === 1) {
        // Element node
        const element = node as any;
        // Remove all attributes except href, src, alt, title
        const allowedAttrs = ['href', 'src', 'alt', 'title'];
        const attrs = Array.from(element.attributes);
        for (const attr of attrs as any[]) {
          if (!allowedAttrs.includes(attr.name)) {
            element.removeAttribute(attr.name);
          }
        }
      }
      return false; // Don't replace the node, just clean it
    },
    replacement: () => '',
  });

  return turndownService;
}

/**
 * Normalize HTML/Markdown content to clean markdown
 *
 * Converts HTML or markdown to normalized markdown format by:
 * - Converting HTML to markdown using Turndown
 * - Removing HTML comments
 * - Normalizing line breaks and whitespace
 * - Cleaning up formatting inconsistencies
 * - Preserving essential formatting (headings, links, images, lists, etc)
 *
 * @param content - HTML or markdown content to normalize
 * @returns Normalized markdown string
 *
 * @example
 * ```typescript
 * const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong>.</p>';
 * const markdown = normalizeToMarkdown(html);
 * // Result: "# Title\n\nParagraph with **bold**."
 * ```
 *
 * @example
 * ```typescript
 * // Also works with markdown input
 * const messyMarkdown = '#Title\n\n\n\nText   with   spaces';
 * const clean = normalizeToMarkdown(messyMarkdown);
 * // Result: "# Title\n\nText with spaces"
 * ```
 */
export function normalizeToMarkdown(content: string): string {
  try {
    // Check if this is plaintext content (marked by buttondown-editor-mode comment)
    const hasPlaintextMarker = content.includes(
      'buttondown-editor-mode: plaintext'
    );

    // Also check if the content actually contains HTML tags (beyond just comments)
    const contentWithoutComments = content.replace(/<!--[\s\S]*?-->/g, '');
    const actuallyIsPlaintext =
      hasPlaintextMarker && !isLikelyHtml(contentWithoutComments);

    let markdown: string;

    if (actuallyIsPlaintext) {
      // For true plaintext content (no HTML tags), just remove HTML comments and normalize line breaks
      // Don't use Turndown as it will collapse whitespace
      markdown = contentWithoutComments;

      // Normalize line endings (CRLF -> LF)
      markdown = markdown.replace(/\r\n/g, '\n');

      // Clean up multiple consecutive blank lines (keep max 2)
      markdown = markdown.replace(/\n{3,}/g, '\n\n');

      // Trim leading/trailing whitespace
      markdown = markdown.trim();
    } else {
      // For HTML content, use Turndown to convert to markdown
      const turndownService = createTurndownService();

      // Before converting, replace double line breaks with a placeholder
      // to preserve paragraph spacing in plaintext-like content
      const contentWithPlaceholders = content.replace(
        /\r?\n\r?\n/g,
        '___PARAGRAPH_BREAK___'
      );

      // Convert to markdown
      markdown = turndownService.turndown(contentWithPlaceholders);

      // Restore paragraph breaks
      markdown = markdown.replace(/___PARAGRAPH_BREAK___/g, '\n\n');

      // Clean up excessive whitespace
      markdown = cleanupWhitespace(markdown);

      // Remove any remaining HTML comments
      markdown = markdown.replace(/<!--[\s\S]*?-->/g, '');

      // Clean up multiple consecutive blank lines (keep max 2)
      markdown = markdown.replace(/\n{3,}/g, '\n\n');

      // Trim leading/trailing whitespace
      markdown = markdown.trim();
    }

    return markdown;
  } catch (error) {
    logger.warn('Failed to normalize markdown:', error);
    // Fallback: return the original content
    return content;
  }
}

/**
 * Clean up excessive whitespace in markdown
 */
function cleanupWhitespace(markdown: string): string {
  // Remove trailing whitespace from each line
  markdown = markdown.replace(/[ \t]+$/gm, '');

  // Normalize line endings
  markdown = markdown.replace(/\r\n/g, '\n');

  // Remove spaces before punctuation
  markdown = markdown.replace(/\s+([.,!?;:])/g, '$1');

  return markdown;
}

/**
 * Check if content is likely HTML or markdown
 *
 * Detects HTML by counting HTML tags in the content. Any presence
 * of HTML tags indicates the content needs normalization.
 *
 * @param content - The content to check
 * @returns True if content appears to be HTML, false otherwise
 *
 * @example
 * ```typescript
 * isLikelyHtml('<p>Hello</p>'); // true
 * isLikelyHtml('# Hello'); // false
 * ```
 */
export function isLikelyHtml(content: string): boolean {
  // Count HTML tags
  const htmlTagCount = (content.match(/<[^>]+>/g) || []).length;
  // If there are any HTML tags (even just 1), consider it HTML that needs normalization
  return htmlTagCount > 0;
}

/**
 * Preview the normalization result (useful for testing)
 *
 * Returns both the original and normalized content along with metadata
 * about the transformation.
 *
 * @param content - The content to normalize
 * @returns Object containing original, normalized content, and statistics
 *
 * @example
 * ```typescript
 * const preview = previewNormalization('<h1>Title</h1><p>Content</p>');
 * console.log(`Before: ${preview.lengthBefore} chars`);
 * console.log(`After: ${preview.lengthAfter} chars`);
 * console.log(`Normalized: ${preview.normalized}`);
 * ```
 */
export function previewNormalization(content: string): {
  original: string;
  normalized: string;
  isHtml: boolean;
  lengthBefore: number;
  lengthAfter: number;
} {
  const isHtml = isLikelyHtml(content);
  const normalized = normalizeToMarkdown(content);

  return {
    original: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
    normalized:
      normalized.substring(0, 500) + (normalized.length > 500 ? '...' : ''),
    isHtml,
    lengthBefore: content.length,
    lengthAfter: normalized.length,
  };
}
