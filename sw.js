const CACHE_NAME = 'wildlife-sighting-v3';
const urlsToCache = [
  './',
  './index.html',
  './index.htm',
  './WildlifePhotoTutorLWEC.html',
  './LWECFieldLogbook.html',
  './manifest.json',
  './icons/lwec-logo.png',
  './icons/icon-192x192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.3/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.3/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'
];

// Hosts the service worker must never intercept: Firebase auth and Firestore
// sync traffic manage their own offline behaviour.
function isLiveBackend(url) {
  return url.hostname.endsWith('googleapis.com')
      || url.hostname.endsWith('firebaseapp.com')
      || url.hostname.endsWith('firebasestorage.app')
      || url.hostname === 'tile.openstreetmap.org';
}

// Install: pre-cache best-effort — one unreachable CDN file must not break install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(urlsToCache.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.map(n => n === CACHE_NAME ? null : caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isLiveBackend(url)) return; // let Firebase and map tiles talk directly

  const isPage = request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('.htm')
    || url.pathname.endsWith('/');

  if (url.origin === location.origin && isPage) {
    // Network-first for our pages: students get updates immediately when
    // online, and the cached copy when offline.
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(hit => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // Everything else (libraries, images): cache-first with background fill.
  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request).then(response => {
        if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
