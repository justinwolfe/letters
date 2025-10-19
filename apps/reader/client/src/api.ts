/**
 * API abstraction layer that works in both API mode (local dev) and static mode (GitHub Pages)
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Detect if we're running in static mode (GitHub Pages)
// In static mode, there's no API server, so we use static JSON files
const isStaticMode = () => {
  // If running on GitHub Pages or if API_BASE points to static files
  return (
    window.location.hostname === 'justinwolfe.github.io' ||
    window.location.hostname.includes('github.io')
  );
};

export interface Email {
  id: string;
  subject: string;
  description: string;
  publish_date: string;
  body?: string;
  normalized_markdown?: string;
  image_url?: string;
  slug?: string;
  secondary_id?: number;
  searchSnippet?: string;
}

export interface NavigationLinks {
  prev: { id: string; subject: string; publish_date: string } | null;
  next: { id: string; subject: string; publish_date: string } | null;
}

/**
 * Fetch all emails
 */
export async function fetchAllEmails(): Promise<Email[]> {
  if (isStaticMode()) {
    // In static mode, fetch from static JSON file
    const response = await fetch('/letters/api/emails.json');
    if (!response.ok) throw new Error('Failed to fetch emails');
    return response.json();
  } else {
    // In API mode, use the API endpoint
    const response = await fetch(`${API_BASE}/api/emails`);
    if (!response.ok) throw new Error('Failed to fetch emails');
    return response.json();
  }
}

/**
 * Fetch a single email by ID
 */
export async function fetchEmailById(id: string): Promise<Email> {
  if (isStaticMode()) {
    // In static mode, fetch from static JSON file
    const response = await fetch(`/letters/api/emails/${id}.json`);
    if (!response.ok) throw new Error('Failed to fetch email');
    return response.json();
  } else {
    // In API mode, use the API endpoint
    const response = await fetch(`${API_BASE}/api/emails/${id}`);
    if (!response.ok) throw new Error('Failed to fetch email');
    return response.json();
  }
}

/**
 * Fetch navigation links for an email
 */
export async function fetchEmailNavigation(
  id: string,
  allEmails?: Email[]
): Promise<NavigationLinks> {
  if (isStaticMode()) {
    // In static mode, calculate navigation from all emails
    if (!allEmails) {
      allEmails = await fetchAllEmails();
    }

    // Sort by publish date descending
    const sorted = [...allEmails].sort(
      (a, b) =>
        new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime()
    );

    const currentIndex = sorted.findIndex((e) => e.id === id);

    return {
      prev: currentIndex > 0 ? sorted[currentIndex - 1] : null,
      next: currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null,
    };
  } else {
    // In API mode, use the API endpoint
    const response = await fetch(`${API_BASE}/api/emails/${id}/navigation`);
    if (!response.ok) throw new Error('Failed to fetch navigation');
    return response.json();
  }
}

/**
 * Fetch a random email
 */
export async function fetchRandomEmail(allEmails?: Email[]): Promise<Email> {
  if (isStaticMode()) {
    // In static mode, pick a random email from the list
    if (!allEmails) {
      allEmails = await fetchAllEmails();
    }
    const randomIndex = Math.floor(Math.random() * allEmails.length);
    return allEmails[randomIndex];
  } else {
    // In API mode, use the API endpoint
    const response = await fetch(`${API_BASE}/api/emails/random`);
    if (!response.ok) throw new Error('Failed to fetch random email');
    return response.json();
  }
}

/**
 * Search emails
 */
export async function searchEmails(
  query: string,
  allEmails?: Email[]
): Promise<Email[]> {
  if (isStaticMode()) {
    // In static mode, do client-side search
    if (!allEmails) {
      allEmails = await fetchAllEmails();
    }

    const lowerQuery = query.toLowerCase();
    return allEmails.filter(
      (email) =>
        email.subject.toLowerCase().includes(lowerQuery) ||
        email.description?.toLowerCase().includes(lowerQuery)
    );
  } else {
    // In API mode, use the API endpoint
    const response = await fetch(
      `${API_BASE}/api/emails/search?q=${encodeURIComponent(query)}`
    );
    if (!response.ok) throw new Error('Failed to search emails');
    return response.json();
  }
}
