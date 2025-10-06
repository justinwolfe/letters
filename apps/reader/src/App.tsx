import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

interface Email {
  id: string;
  subject: string;
  description: string;
  publish_date: string;
  body?: string;
  image_url?: string;
  slug?: string;
  secondary_id?: number;
  searchSnippet?: string;
}

interface NavigationLinks {
  prev: { id: string; subject: string; publish_date: string } | null;
  next: { id: string; subject: string; publish_date: string } | null;
}

type SortOption = 'date-desc' | 'date-asc' | 'subject-asc' | 'subject-desc';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

function App() {
  const [allEmails, setAllEmails] = useState<Email[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [currentEmail, setCurrentEmail] = useState<Email | null>(null);
  const [navigation, setNavigation] = useState<NavigationLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'reader'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isSearching, setIsSearching] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Fetch all emails on mount
  useEffect(() => {
    fetchEmails();
  }, []);

  // Sort and filter emails whenever search query, sort option, or allEmails change
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      const sorted = sortEmails([...allEmails], sortBy);
      setEmails(sorted);
    }
  }, [searchQuery, sortBy, allEmails]);

  const fetchEmails = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/emails`);
      if (!response.ok) throw new Error('Failed to fetch emails');
      const data = await response.json();
      setAllEmails(data);
      setEmails(sortEmails(data, sortBy));
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setEmails(sortEmails([...allEmails], sortBy));
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch(
        `${API_BASE}/api/emails/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error('Failed to search emails');
      const data = await response.json();
      setEmails(sortEmails(data, sortBy));
      setIsSearching(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSearching(false);
    }
  };

  const sortEmails = (emailList: Email[], sort: SortOption): Email[] => {
    const sorted = [...emailList];
    switch (sort) {
      case 'date-desc':
        return sorted.sort(
          (a, b) =>
            new Date(b.publish_date).getTime() -
            new Date(a.publish_date).getTime()
        );
      case 'date-asc':
        return sorted.sort(
          (a, b) =>
            new Date(a.publish_date).getTime() -
            new Date(b.publish_date).getTime()
        );
      case 'subject-asc':
        return sorted.sort((a, b) => a.subject.localeCompare(b.subject));
      case 'subject-desc':
        return sorted.sort((a, b) => b.subject.localeCompare(a.subject));
      default:
        return sorted;
    }
  };

  const fetchRandomEmail = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/emails/random`);
      if (!response.ok) throw new Error('Failed to fetch random email');
      const data = await response.json();
      navigateToEmail(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const fetchEmail = async (id: string) => {
    try {
      setLoading(true);
      const [emailResponse, navResponse] = await Promise.all([
        fetch(`${API_BASE}/api/emails/${id}`),
        fetch(`${API_BASE}/api/emails/${id}/navigation`),
      ]);

      if (!emailResponse.ok) throw new Error('Failed to fetch email');
      if (!navResponse.ok) throw new Error('Failed to fetch navigation');

      const email = await emailResponse.json();
      const nav = await navResponse.json();

      setCurrentEmail(email);
      setNavigation(nav);
      setView('reader');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const navigateToEmail = (id: string) => {
    fetchEmail(id);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    setView('list');
    setCurrentEmail(null);
    setNavigation(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderSearchSnippet = (snippet: string) => {
    // Parse the snippet and render with bold matches
    const parts = snippet.split(/<<MATCH>>|<<?\/MATCH>>/);
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text
        elements.push(parts[i]);
      } else {
        // Matched text - make it bold
        elements.push(
          <strong key={i} className="search-highlight">
            {parts[i]}
          </strong>
        );
      }
    }

    return <>{elements}</>;
  };

  // Swipe gesture handlers for mobile navigation
  const minSwipeDistance = 50; // Minimum distance in pixels to trigger a swipe

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && navigation?.next) {
      // Swipe left -> go to next
      navigateToEmail(navigation.next.id);
    } else if (isRightSwipe && navigation?.prev) {
      // Swipe right -> go to previous
      navigateToEmail(navigation.prev.id);
    }
  };

  if (loading && !currentEmail) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      {view === 'list' ? (
        <div className="email-list">
          <header className="header">
            <h1>thank you notes</h1>
            <p className="subtitle">
              {searchQuery
                ? `${emails.length} result${emails.length !== 1 ? 's' : ''}`
                : `${emails.length} published issue${
                    emails.length !== 1 ? 's' : ''
                  }`}
            </p>
          </header>

          <div className="controls">
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search newsletters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="control-row">
              <div className="sort-container">
                <label htmlFor="sort-select">Sort by:</label>
                <select
                  id="sort-select"
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="subject-asc">Subject (A-Z)</option>
                  <option value="subject-desc">Subject (Z-A)</option>
                </select>
              </div>

              {searchQuery && (
                <div className="result-count">
                  {emails.length} result{emails.length !== 1 ? 's' : ''}
                </div>
              )}

              <button
                className="btn btn-random"
                onClick={fetchRandomEmail}
                title="Go to random letter"
              >
                🎲 Random Letter
              </button>
            </div>
          </div>

          {isSearching ? (
            <div className="searching">Searching...</div>
          ) : emails.length === 0 ? (
            <div className="no-results">
              {searchQuery
                ? 'No newsletters found matching your search.'
                : 'No newsletters available.'}
            </div>
          ) : (
            <div className="list">
              {emails.map((email) => (
                <article
                  key={email.id}
                  className="email-card"
                  onClick={() => navigateToEmail(email.id)}
                >
                  <div className="email-card-content">
                    <h2>{email.subject}</h2>
                    {email.searchSnippet ? (
                      <p className="email-search-snippet">
                        {renderSearchSnippet(email.searchSnippet)}
                      </p>
                    ) : (
                      email.description && (
                        <p className="email-description">{email.description}</p>
                      )
                    )}
                    <time className="email-date">
                      {formatDate(email.publish_date)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="email-reader"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {currentEmail && (
            <article className="email-content">
              <header className="email-header">
                <h1>{currentEmail.subject}</h1>
                <time className="email-date">
                  {formatDate(currentEmail.publish_date)}
                </time>
              </header>

              <div className="email-body">
                <ReactMarkdown>{currentEmail.body || ''}</ReactMarkdown>
              </div>
            </article>
          )}

          <nav className="reader-nav reader-nav-bottom">
            <button
              onClick={goBack}
              className="btn-back-arrow"
              title="Back to List"
            >
              home
            </button>
            <div className="nav-buttons">
              {navigation?.prev && (
                <button
                  onClick={() => navigateToEmail(navigation.prev!.id)}
                  className="btn btn-nav"
                >
                  ← Previous: {navigation.prev.subject}
                </button>
              )}
              {navigation?.next && (
                <button
                  onClick={() => navigateToEmail(navigation.next!.id)}
                  className="btn btn-nav"
                >
                  Next: {navigation.next.subject} →
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

export default App;
