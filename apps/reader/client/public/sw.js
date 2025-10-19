/**
 * Service Worker for Thank You Notes PWA
 *
 * Provides offline functionality and caching strategies for the newsletter reader.
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Base path for GitHub Pages deployment
const BASE_PATH = '/letters';

// Assets to cache on install
const STATIC_ASSETS = [
  `${BASE_PATH}/app/`,
  `${BASE_PATH}/app/index.html`,
  `${BASE_PATH}/manifest.json`,
  // Don't cache icons that don't exist yet
  // They will be cached on first request
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName.startsWith('static-') ||
                cacheName.startsWith('data-') ||
                cacheName.startsWith('images-')
              );
            })
            .filter((cacheName) => {
              return (
                cacheName !== STATIC_CACHE &&
                cacheName !== DATA_CACHE &&
                cacheName !== IMAGE_CACHE
              );
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle requests with appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - Cache First for static JSON, Network First for dynamic API
  if (
    url.pathname.startsWith(`${BASE_PATH}/api/`) ||
    url.pathname.startsWith('/api/')
  ) {
    // For static JSON files (GitHub Pages), use Cache First
    if (url.pathname.endsWith('.json')) {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version and update in background
            fetch(request)
              .then((response) => {
                if (response.ok) {
                  caches.open(DATA_CACHE).then((cache) => {
                    cache.put(request, response.clone());
                  });
                }
              })
              .catch(() => {
                // Ignore fetch errors when offline
              });
            return cachedResponse;
          }

          // No cache, fetch from network
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(DATA_CACHE).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            })
            .catch(() => {
              return new Response(
                JSON.stringify({
                  error: 'Offline and no cached data available',
                }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            });
        })
      );
      return;
    }

    // For dynamic API endpoints (local dev), use Network First
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseClone = response.clone();

          // Cache successful responses
          if (response.ok) {
            caches.open(DATA_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }

          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Serving cached API response:', url.pathname);
              return cachedResponse;
            }

            // No cache available
            return new Response(
              JSON.stringify({ error: 'Offline and no cached data available' }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        })
    );
    return;
  }

  // Image requests - Cache First
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // Clone and cache the image
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }

          return response;
        });
      })
    );
    return;
  }

  // Static assets (HTML, CSS, JS) - Cache First, update in background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          // Update cache in background
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, return nothing if no cache
          return cachedResponse || new Response('Offline', { status: 503 });
        });

      // Return cached version immediately if available
      return cachedResponse || fetchPromise;
    })
  );
});

/**
 * Message handler for cache management from the app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_EMAILS') {
    // Pre-cache email data for offline use
    const emails = event.data.emails;

    caches.open(DATA_CACHE).then((cache) => {
      emails.forEach((email) => {
        const request = new Request(`/api/emails/${email.id}`);
        cache.add(request).catch((err) => {
          console.log('[SW] Failed to cache email:', email.id, err);
        });
      });
    });
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    getCacheSize().then((size) => {
      event.ports[0].postMessage({ size });
    });
  }
});

/**
 * Calculate total cache size
 */
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-read-status') {
    event.waitUntil(syncReadStatus());
  }
});

async function syncReadStatus() {
  // Sync read status when back online
  // This would sync with a backend if we had user accounts
  console.log('[SW] Syncing read status...');
}
