const CACHE_NAME = 'asisten-keuangan-cache-v2-gh-footer'; // Nama cache baru
const REPO_NAME = '/pengeluaran';

const urlsToCache = [
  `${REPO_NAME}/`, 
  `${REPO_NAME}/index.html`,
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  `${REPO_NAME}/icons/icon-48x48.png`,
  `${REPO_NAME}/icons/icon-72x72.png`,
  `${REPO_NAME}/icons/icon-96x96.png`,
  `${REPO_NAME}/icons/icon-128x128.png`,
  `${REPO_NAME}/icons/icon-144x144.png`,
  `${REPO_NAME}/icons/icon-152x152.png`,
  `${REPO_NAME}/icons/icon-192x192.png`,
  `${REPO_NAME}/icons/icon-384x384.png`,
  `${REPO_NAME}/icons/icon-512x512.png`
];

self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install event v2 (footer)');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Opened cache:', CACHE_NAME);
        const promises = urlsToCache.map(url => {
          const request = new Request(url, (url.startsWith('http') ? { mode: 'no-cors', cache: 'reload' } : {cache: 'reload'})); // cache: 'reload' to bypass browser http cache
          return fetch(request)
            .then(response => {
              if (response.status === 200 || response.type === 'opaque') {
                 return cache.put(url, response);
              }
              console.warn(`[ServiceWorker] Failed to fetch and cache (status ${response.status}): ${url}`);
              return Promise.resolve();
            })
            .catch(err => {
              console.warn(`[ServiceWorker] Failed to fetch and cache (network error): ${url}`, err);
              return Promise.resolve();
            });
        });
        return Promise.all(promises);
      })
      .then(() => {
        console.log('[ServiceWorker] All specified assets attempted to be cached.');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate event v2 (footer)');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategi: Network falling back to Cache untuk navigasi (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Jika berhasil dari network, cache responsnya (jika itu adalah halaman utama)
          if (response.ok && (event.request.url.endsWith(`${REPO_NAME}/`) || event.request.url.endsWith(`${REPO_NAME}/index.html`))) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Jika network gagal, coba dari cache untuk halaman utama
          return caches.match(event.request.url.endsWith(`${REPO_NAME}/`) ? `${REPO_NAME}/index.html` : event.request);
        })
    );
    return;
  }

  // Strategi: Cache first, falling back to Network untuk aset lain
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(
          networkResponse => {
            if (networkResponse && networkResponse.ok) {
              // Cache hanya jika URL ada di daftar urlsToCache
              if (urlsToCache.includes(event.request.url) || urlsToCache.includes(new URL(event.request.url).pathname)) {
                 const responseToCache = networkResponse.clone();
                 caches.open(CACHE_NAME)
                   .then(cache => {
                     cache.put(event.request, responseToCache);
                   });
              }
            }
            return networkResponse;
          }
        ).catch(error => {
          console.error('[ServiceWorker] Fetch failed for asset:', event.request.url, error);
          // Anda bisa menyediakan fallback offline generik untuk gambar/aset di sini jika perlu
        });
      })
  );
});