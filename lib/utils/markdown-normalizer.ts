/**
 * Markdown normalization utilities
 * Converts HTML and markdown content to normalized markdown format
 */

import TurndownService from 'turndown';
import { logger } from './logger.js';

/**
 * Create a configured Turndown service that only preserves basic formatting
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
    filter: (node) => {
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
 * Normalize HTML or markdown content to clean markdown
 * Strips out all HTML except basic formatting that renders well in markdown
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
 */
export function isLikelyHtml(content: string): boolean {
  // Count HTML tags
  const htmlTagCount = (content.match(/<[^>]+>/g) || []).length;
  // If there are more than 5 HTML tags, consider it HTML
  return htmlTagCount > 5;
}

/**
 * Preview the normalization (for testing)
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
