/**
 * Utility to extract author information from email subject lines
 *
 * Identifies guest contributors by parsing parentheses in subjects
 */

/**
 * Extract author identifier from email subject line
 *
 * Looks for patterns like "(L)", "(Scarlett)", "(Dr)L", etc.
 * Returns null if no author marker found or if primary author.
 *
 * @param subject - Email subject line
 * @returns Author identifier or null for primary author
 *
 * @example
 * ```typescript
 * extractAuthor("thank you notes (L)") // "L"
 * extractAuthor("tyn ((Dr)L)(4)") // "L"
 * extractAuthor("thank you notes (Scarlett)(2)") // "Scarlett"
 * extractAuthor("4/2") // null
 * extractAuthor("something (butt stuff)") // null (descriptive)
 * ```
 */
export function extractAuthor(subject: string): string | null {
  if (!subject) {
    return null;
  }

  // Pattern to match author in parentheses
  // Looks for (Name), (L), ((Dr)L), etc.
  const patterns = [
    // Match (Dr)L or ((Dr)L) patterns - normalize to just "L"
    /\(\(Dr\)\s*L\)/i,
    /\(Dr\)\s*L/i,

    // Match single letter or name in parentheses, optionally followed by numbers
    /\(([A-Z][a-z]*(?:\s+[A-Z][a-z]*)*)\)(?:\(\d+\))?/,

    // Match initials like (fsa), (kflo), etc.
    /\(([a-z]{2,})\)(?:\(\d+\))?/,

    // Match single uppercase letters like (L), (R), (J)
    /\(([A-Z])\)(?:\(\d+\))?/,

    // Match lowercase single letters
    /\(([a-z])\)(?:\(\d+\))?/,
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      // Special case for Dr. L variants
      if (pattern.source.includes('Dr')) {
        return 'L';
      }

      // Extract the author name/initial
      const author = match[1] ? match[1].trim() : null;

      // Filter out common descriptive parentheses
      if (author && !isDescriptive(author)) {
        // Normalize case for consistency
        return normalizeAuthor(author);
      }
    }
  }

  return null;
}

/**
 * Check if a parenthetical is descriptive rather than an author marker
 */
function isDescriptive(text: string): boolean {
  const descriptivePatterns = [
    /^butt/i,
    /^stuff/i,
    /^content/i,
    /^warning/i,
    /^nsfw/i,
    /^explicit/i,
    /^updated/i,
    /^repost/i,
    /^remix/i,
    /^etc$/i,
  ];

  return descriptivePatterns.some((pattern) => pattern.test(text));
}

/**
 * Normalize author names for consistency
 */
function normalizeAuthor(author: string): string {
  // Keep most names as-is, but handle special cases

  // Normalize "Dr. L" variants to "L"
  if (author.match(/^dr\.?\s*l$/i)) {
    return 'L';
  }

  // Normalize case for single initials - keep uppercase
  if (author.length === 1) {
    return author.toUpperCase();
  }

  // For multi-letter initials (fsa, kflo), keep lowercase
  if (author.match(/^[a-z]+$/) && author.length <= 4) {
    return author.toLowerCase();
  }

  // For names, keep original case (Scarlett, Esmé, etc.)
  return author;
}

/**
 * Batch extract authors from multiple subjects
 *
 * @param subjects - Array of subject lines
 * @returns Map of subject to author identifier
 *
 * @example
 * ```typescript
 * const subjects = ["notes (L)", "4/2", "letter (moe)"];
 * const authors = extractAuthors(subjects);
 * // Map: { "notes (L)" => "L", "4/2" => null, "letter (moe)" => "moe" }
 * ```
 */
export function extractAuthors(subjects: string[]): Map<string, string | null> {
  const result = new Map<string, string | null>();

  for (const subject of subjects) {
    result.set(subject, extractAuthor(subject));
  }

  return result;
}
