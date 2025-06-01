const CACHE_NAME = 'asisten-keuangan-cache-v1-gh'; // Nama cache baru untuk GitHub Pages
const REPO_NAME = '/pengeluaran'; // Nama repositori Anda

const urlsToCache = [
  `${REPO_NAME}/`, 
  `${REPO_NAME}/index.html`,
  // Aset CDN tidak perlu diawali REPO_NAME
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  // Path ke ikon Anda, diawali REPO_NAME
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
  console.log('[ServiceWorker] Install event for GitHub Pages');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Opened cache:', CACHE_NAME);
        const promises = urlsToCache.map(url => {
          // Untuk aset lokal, request normal. Untuk CDN, bisa no-cors jika perlu.
          const request = new Request(url, (url.startsWith('http') ? { mode: 'no-cors' } : {}));
          return fetch(request)
            .then(response => {
              if (response.status === 200 || response.type === 'opaque') {
                 return cache.put(url, response); // Cache URL asli, bukan objek Request
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
  console.log('[ServiceWorker] Activate event for GitHub Pages');
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

  // Strategi: Cache first untuk semua aset, karena kita sudah cache index.html
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // console.log('[ServiceWorker] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // console.log('[ServiceWorker] Fetching from network:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            if (networkResponse && networkResponse.ok) {
              // Hanya cache jika URL ada di daftar urlsToCache atau merupakan navigasi utama
              // Ini untuk menghindari caching semua request API eksternal yang tidak perlu
              const shouldCache = urlsToCache.includes(event.request.url) || event.request.mode === 'navigate';
              if (shouldCache) {
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
          console.error('[ServiceWorker] Fetch failed for:', event.request.url, error);
          // Jika request adalah untuk index.html dan gagal (offline), coba sajikan dari cache
          if (event.request.mode === 'navigate' && event.request.url.endsWith('/pengeluaran/') || event.request.url.endsWith('/pengeluaran/index.html')) {
            return caches.match(`${REPO_NAME}/index.html`);
          }
        });
      })
  );
});