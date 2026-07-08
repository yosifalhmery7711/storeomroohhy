const CACHE_NAME = 'um-rouh-store-v4';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension or other non-http/https schemes
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // STRICT BYPASS: Completely skip intercepting Firebase database, authentication, long-polling, or dynamic API endpoints.
  // This prevents keeping persistent/pending fetches active inside the service worker context, which triggers Chrome's PWA background alerts.
  if (
    url.host.includes('firestore.googleapis.com') ||
    url.host.includes('identitytoolkit.googleapis.com') ||
    url.host.includes('securetoken.googleapis.com') ||
    url.host.includes('firebasestorage.googleapis.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/__/') || // Firebase SDK internals
    url.pathname.includes('/sockjs-node/') || // HMR/WebSocket
    url.host.includes('localhost') && url.port === '3000' && url.pathname.startsWith('/api')
  ) {
    return;
  }

  // Cache static assets dynamically (JS, CSS, images, fonts, icons)
  const isStaticAsset = 
    url.pathname.includes('/assets/') || 
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/) ||
    url.host.includes('icons8.com') ||
    url.host.includes('fonts.googleapis.com') ||
    url.host.includes('fonts.gstatic.com') ||
    url.host.includes('googleusercontent.com') ||
    url.host.includes('drive.google.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache, but fetch in background to update cache (stale-while-revalidate)
          // Make sure this background fetch doesn't keep the request hanging; catch any errors gracefully
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          return new Response('Asset not found', { status: 404 });
        });
      })
    );
  } else {
    // For HTML and other routes, use Network First, falling back to cache
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If it's a navigation request, return index.html from cache as SPA fallback
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const productData = event.notification.data || {};
  const productId = productData.productId || '';
  const productCode = productData.productCode || '';
  
  let targetUrl = '/';
  if (productCode) {
    targetUrl = `/?code=${encodeURIComponent(productCode)}`;
  } else if (productId) {
    targetUrl = `/?prod=${encodeURIComponent(productId)}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If there is an existing client window, focus it and navigate
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
          });
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
