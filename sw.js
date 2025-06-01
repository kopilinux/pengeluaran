const CACHE_NAME = 'asisten-keuangan-cache-v1'; // Ubah v1 jika ada pembaruan besar
const urlsToCache = [
  './', // Alias untuk index.html
  './index.html',
  // './style.css', // Jika Anda memisahkan CSS
  // './app.js', // Jika Anda memisahkan JavaScript utama
  'https://cdn.tailwindcss.com', // Cache Tailwind CSS
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', // Cache Font
  // Tambahkan path ke ikon Anda di sini, contoh:
  './icons/icon-48x48.png',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
  // Tidak perlu cache manifest.json secara eksplisit di sini
];

self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Opened cache:', CACHE_NAME);
        // Beberapa aset CDN mungkin gagal di-cache karena CORS, jadi kita tidak block install event
        // dengan cache.addAll([...]). Kita cache satu per satu dan tangani error.
        const promises = urlsToCache.map(url => {
          return fetch(new Request(url, { mode: 'no-cors' })) // no-cors untuk CDN jika perlu
            .then(response => {
              if (response.status === 200 || response.type === 'opaque') { // Opaque untuk no-cors
                 return cache.put(url, response);
              }
              console.warn(`[ServiceWorker] Failed to fetch and cache (status ${response.status}): ${url}`);
              return Promise.resolve(); // Jangan gagalkan semua jika satu gagal
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
        return self.skipWaiting(); // Aktifkan service worker baru segera
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate event');
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
    }).then(() => self.clients.claim()) // Ambil kontrol halaman yang terbuka segera
  );
});

self.addEventListener('fetch', event => {
  // Hanya tangani request GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategi: Coba cache dulu, lalu network.
  // Untuk request navigasi (HTML), coba network dulu untuk konten terbaru, fallback ke cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Jika berhasil dari network, cache responsnya
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Jika network gagal, coba dari cache
          return caches.match(event.request);
        })
    );
  } else {
    // Untuk aset lain (CSS, JS, gambar), cache first
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // console.log('[ServiceWorker] Serving from cache:', event.request.url);
            return response; // Ditemukan di cache
          }
          // console.log('[ServiceWorker] Fetching from network:', event.request.url);
          return fetch(event.request).then(
            networkResponse => {
              if (networkResponse && networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            }
          ).catch(error => {
            console.error('[ServiceWorker] Fetch failed for:', event.request.url, error);
            // Anda bisa menyediakan fallback offline di sini jika perlu
          });
        })
    );
  }
});
