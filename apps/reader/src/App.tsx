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
}

interface NavigationLinks {
  prev: { id: string; subject: string; publish_date: string } | null;
  next: { id: string; subject: string; publish_date: string } | null;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [currentEmail, setCurrentEmail] = useState<Email | null>(null);
  const [navigation, setNavigation] = useState<NavigationLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'reader'>('list');

  // Fetch all emails on mount
  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/emails`);
      if (!response.ok) throw new Error('Failed to fetch emails');
      const data = await response.json();
      setEmails(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
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
            <h1>Newsletter Archive</h1>
            <p className="subtitle">{emails.length} published issues</p>
          </header>

          <div className="list">
            {emails.map((email) => (
              <article
                key={email.id}
                className="email-card"
                onClick={() => navigateToEmail(email.id)}
              >
                {email.image_url && (
                  <div className="email-card-image">
                    <img src={email.image_url} alt={email.subject} />
                  </div>
                )}
                <div className="email-card-content">
                  <h2>{email.subject}</h2>
                  {email.description && (
                    <p className="email-description">{email.description}</p>
                  )}
                  <time className="email-date">
                    {formatDate(email.publish_date)}
                  </time>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="email-reader">
          <nav className="reader-nav">
            <button onClick={goBack} className="btn btn-secondary">
              ← Back to List
            </button>
            <div className="nav-buttons">
              {navigation?.prev && (
                <button
                  onClick={() => navigateToEmail(navigation.prev!.id)}
                  className="btn btn-nav"
                  title={navigation.prev.subject}
                >
                  ← Previous
                </button>
              )}
              {navigation?.next && (
                <button
                  onClick={() => navigateToEmail(navigation.next!.id)}
                  className="btn btn-nav"
                  title={navigation.next.subject}
                >
                  Next →
                </button>
              )}
            </div>
          </nav>

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
            <button onClick={goBack} className="btn btn-secondary">
              ← Back to List
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
