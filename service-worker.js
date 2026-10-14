// ============================================================
//  SERVICE WORKER — EPS-TOPIKU PWA
// ============================================================
const CACHE_VERSION = 'v1.0.0';
const CACHE_STATIC = 'epstopiku-static-' + CACHE_VERSION;
const CACHE_DYNAMIC = 'epstopiku-dynamic-' + CACHE_VERSION;

// File yang di-cache pas install (app shell)
const PRECACHE_URLS = [
  '/',
  '/login.html',
  '/dashboard.html',
  '/flashcard.html',
  '/leaderboard.html',
  '/notifikasi.html',
  '/profil.html',
  '/riwayat.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ============================================================
//  INSTALL — precache app shell
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Beberapa file gagal di-cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
//  ACTIVATE — hapus cache lama
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
            .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
//  FETCH — strategi berbeda per tipe request
// ============================================================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET
  if (req.method !== 'GET') return;

  // Skip request ke Apps Script (API) — selalu network
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({
          success: false,
          msg: 'Kamu sedang offline. Periksa koneksi internet.'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Skip request ke domain eksternal lain (Google, WhatsApp, dll)
  if (url.origin !== self.location.origin &&
      !url.hostname.includes('cdnjs.cloudflare.com') &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  // HTML pages — Network First (biar selalu update, tapi bisa offline)
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_DYNAMIC).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => {
          return caches.match(req).then((cached) => {
            return cached || caches.match('/dashboard.html');
          });
        })
    );
    return;
  }

  // Aset statis (CSS, JS, gambar, font) — Cache First
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cuma cache response yang valid
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_DYNAMIC).then((cache) => cache.put(req, clone));
        return res;
      }).catch(() => cached);
    })
  );
});

// ============================================================
//  MESSAGE — buat update paksa dari halaman
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
