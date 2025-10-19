import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';
import { offlineStorage, formatBytes } from './offlineStorage';

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

const API_BASE = import.meta.env.VITE_API_BASE || '';
const IS_STATIC_MODE = API_BASE.startsWith('/letters');

function App() {
  // Check for saved letter before initial render to avoid flash
  const hasLastViewed = localStorage.getItem('lastViewedLetter');

  const [allEmails, setAllEmails] = useState<Email[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [currentEmail, setCurrentEmail] = useState<Email | null>(null);
  const [navigation, setNavigation] = useState<NavigationLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'reader'>(
    hasLastViewed ? 'reader' : 'list'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isSearching, setIsSearching] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [hasLoadedLastViewed, setHasLoadedLastViewed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflinePanel, setShowOfflinePanel] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);
  const [offlineStats, setOfflineStats] = useState<{
    emailCount: number;
    imageCount: number;
    totalSize: number;
    lastSync: string | null;
  } | null>(null);

  // Initialize offline storage and online/offline listeners
  useEffect(() => {
    // Initialize IndexedDB
    offlineStorage.init().then(() => {
      console.log('Offline storage initialized');
      updateOfflineStats();
    });

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      fetchEmails(); // Refresh when coming back online
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch all emails on mount
  useEffect(() => {
    fetchEmails();
  }, []);

  // Load last viewed letter from localStorage on mount (only once)
  useEffect(() => {
    const lastViewedId = localStorage.getItem('lastViewedLetter');
    if (lastViewedId && !loading && !hasLoadedLastViewed) {
      setHasLoadedLastViewed(true);
      navigateToEmail(lastViewedId);
    }
  }, [loading, hasLoadedLastViewed]);

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
      const url = IS_STATIC_MODE
        ? `${API_BASE}/api/emails.json`
        : `${API_BASE}/api/emails`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch emails');
      const data = await response.json();
      setAllEmails(data);
      setEmails(sortEmails(data, sortBy));
      setLoading(false);
    } catch (err) {
      // If offline, try to load from IndexedDB
      if (!isOnline) {
        try {
          const cachedEmails = await offlineStorage.getAllEmails();
          if (cachedEmails.length > 0) {
            setAllEmails(cachedEmails);
            setEmails(sortEmails(cachedEmails, sortBy));
            setLoading(false);
            return;
          }
        } catch (cacheErr) {
          console.error('Failed to load cached emails:', cacheErr);
        }
      }
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

      if (IS_STATIC_MODE) {
        // Client-side search for static mode
        const lowerQuery = query.toLowerCase();
        const results = allEmails.filter(
          (email) =>
            email.subject.toLowerCase().includes(lowerQuery) ||
            email.description?.toLowerCase().includes(lowerQuery)
        );
        setEmails(sortEmails(results, sortBy));
      } else {
        // Server-side search for API mode
        const response = await fetch(
          `${API_BASE}/api/emails/search?q=${encodeURIComponent(query)}`
        );
        if (!response.ok) throw new Error('Failed to search emails');
        const data = await response.json();
        setEmails(sortEmails(data, sortBy));
      }
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
      if (IS_STATIC_MODE) {
        // Pick a random email from allEmails
        if (allEmails.length === 0) return;
        const randomIndex = Math.floor(Math.random() * allEmails.length);
        navigateToEmail(allEmails[randomIndex].id);
      } else {
        const response = await fetch(`${API_BASE}/api/emails/random`);
        if (!response.ok) throw new Error('Failed to fetch random email');
        const data = await response.json();
        navigateToEmail(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const fetchEmail = async (id: string) => {
    try {
      setLoading(true);

      if (IS_STATIC_MODE) {
        // Fetch email JSON and calculate navigation from allEmails
        const emailResponse = await fetch(`${API_BASE}/api/emails/${id}.json`);
        if (!emailResponse.ok) throw new Error('Failed to fetch email');
        const email = await emailResponse.json();

        // Calculate navigation from allEmails
        const sorted = sortEmails([...allEmails], 'date-desc');
        const currentIndex = sorted.findIndex((e) => e.id === id);
        const nav = {
          prev:
            currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null,
          next: currentIndex > 0 ? sorted[currentIndex - 1] : null,
        };

        setCurrentEmail(email);
        setNavigation(nav);
      } else {
        // API mode - fetch from server
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
      }

      setView('reader');
      setLoading(false);

      // Save to localStorage as the most recently viewed letter
      localStorage.setItem('lastViewedLetter', id);
    } catch (err) {
      // If offline, try to load from IndexedDB
      if (!isOnline) {
        try {
          const cachedEmail = await offlineStorage.getEmail(id);
          if (cachedEmail) {
            setCurrentEmail(cachedEmail);
            // Calculate navigation from cached emails
            const cachedEmails = await offlineStorage.getAllEmails();
            const sortedEmails = sortEmails(cachedEmails, 'date-desc');
            const currentIndex = sortedEmails.findIndex((e) => e.id === id);
            setNavigation({
              prev:
                currentIndex < sortedEmails.length - 1
                  ? sortedEmails[currentIndex + 1]
                  : null,
              next: currentIndex > 0 ? sortedEmails[currentIndex - 1] : null,
            });
            setView('reader');
            setLoading(false);
            return;
          }
        } catch (cacheErr) {
          console.error('Failed to load cached email:', cacheErr);
        }
      }
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

  // Offline functionality
  const updateOfflineStats = async () => {
    try {
      const stats = await offlineStorage.getStats();
      setOfflineStats(stats);
    } catch (err) {
      console.error('Failed to get offline stats:', err);
    }
  };

  const downloadForOffline = async () => {
    try {
      setDownloadProgress({
        current: 0,
        total: 100,
        message: 'Starting download...',
      });

      await offlineStorage.downloadAllContent((current, total, message) => {
        setDownloadProgress({ current, total, message });
      });

      await updateOfflineStats();
      setTimeout(() => setDownloadProgress(null), 2000);
    } catch (err) {
      setError('Failed to download content for offline use');
      setDownloadProgress(null);
    }
  };

  const clearOfflineData = async () => {
    if (!confirm('Are you sure you want to clear all offline data?')) return;

    try {
      await offlineStorage.clearAll();
      await updateOfflineStats();
      alert('Offline data cleared successfully');
    } catch (err) {
      setError('Failed to clear offline data');
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
      {!isOnline && (
        <div className="offline-banner">
          📡 You're offline -{' '}
          {offlineStats && offlineStats.emailCount > 0
            ? `${offlineStats.emailCount} letters available`
            : 'No offline content available'}
        </div>
      )}

      {downloadProgress && (
        <div className="download-progress">
          <div className="download-progress-bar">
            <div
              className="download-progress-fill"
              style={{ width: `${downloadProgress.current}%` }}
            />
          </div>
          <p>
            {downloadProgress.message} ({downloadProgress.current}%)
          </p>
        </div>
      )}

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

              <button
                className="btn btn-offline"
                onClick={() => setShowOfflinePanel(!showOfflinePanel)}
                title="Offline settings"
              >
                📥 Offline
              </button>
            </div>
          </div>

          {showOfflinePanel && (
            <div className="offline-panel">
              <h3>Offline Mode</h3>
              {offlineStats ? (
                <div className="offline-stats">
                  <p>📧 {offlineStats.emailCount} letters saved</p>
                  <p>🖼️ {offlineStats.imageCount} images cached</p>
                  <p>💾 {formatBytes(offlineStats.totalSize)} total</p>
                  {offlineStats.lastSync && (
                    <p>
                      🔄 Last sync:{' '}
                      {new Date(offlineStats.lastSync).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <p>No offline data available</p>
              )}

              <div className="offline-actions">
                <button
                  className="btn btn-primary"
                  onClick={downloadForOffline}
                  disabled={!!downloadProgress}
                >
                  {downloadProgress
                    ? 'Downloading...'
                    : '⬇️ Download All Content'}
                </button>

                {offlineStats && offlineStats.emailCount > 0 && (
                  <button className="btn btn-danger" onClick={clearOfflineData}>
                    🗑️ Clear Offline Data
                  </button>
                )}
              </div>

              <p className="offline-note">
                Download all letters and images for offline reading. This app
                works as a Progressive Web App (PWA) - you can install it on
                your device for a native app experience.
              </p>
            </div>
          )}

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
                  ← {navigation.prev.subject}
                </button>
              )}
              {navigation?.next && (
                <button
                  onClick={() => navigateToEmail(navigation.next!.id)}
                  className="btn btn-nav"
                >
                  {navigation.next.subject} →
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
