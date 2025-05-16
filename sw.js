const CACHE_NAME = 'wildlife-sighting-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icons/lwec-logo.png',
  './icons/icon-192x192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.3/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.3/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install service worker and cache the static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Serve cached content when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // Return a custom offline page or handle as needed
        if (event.request.url.indexOf('.html') > -1) {
          return caches.match('./index.html');
        }
      })
  );
});

// Update the cache when a new service worker is activated
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // If this cache name isn't in the whitelist, delete it
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle offline data submission 
self.addEventListener('sync', event => {
  if (event.tag === 'sync-sightings') {
    event.waitUntil(syncSightings());
  }
});

// Function to sync stored offline data
function syncSightings() {
  const pendingSightings = JSON.parse(localStorage.getItem('pendingSightings') || '[]');
  
  if (pendingSightings.length === 0) {
    return Promise.resolve();
  }
  
  return self.clients.matchAll()
    .then(clients => {
      clients.forEach(client => {
        // Inform the client that we're syncing
        client.postMessage({
          message: 'sync-started',
          tag: 'sync-sightings'
        });
      });
      
      // In a real application, you would send this data to a server
      // For now, we'll just move it to the regular storage
      const savedSightings = JSON.parse(localStorage.getItem('wildlifeSightings') || '[]');
      const mergedSightings = [...savedSightings, ...pendingSightings];
      
      localStorage.setItem('wildlifeSightings', JSON.stringify(mergedSightings));
      localStorage.removeItem('pendingSightings');
      
      return clients.forEach(client => {
        // Inform the client that the sync is complete
        client.postMessage({
          message: 'sync-complete',
          tag: 'sync-sightings'
        });
      });
    });
}
