// Service Worker for offline check-in functionality
// This SW caches the check-in page and related assets for offline use

const CACHE_NAME = 'bileto-checkin-v1'
const CHECKIN_URL_PATTERN = /\/organizer\/events\/[^/]+\/checkin/

// Assets to cache for check-in page
const CHECKIN_ASSETS = [
  '/organizer/events/checkin', // This will be dynamic, but we cache the pattern
  // The service worker will cache runtime assets during navigation
]

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  self.skipWaiting() // Activate immediately
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim() // Take control immediately
})

// Fetch event - serve from cache when offline, especially for check-in pages
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // For API requests during check-in
  if (url.pathname.startsWith('/api/')) {
    // For check-in validation requests, try network first
    // If offline, return a cached response or offline error
    if (url.pathname.includes('/checkin') || url.pathname.includes('/tickets')) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            // Cache successful API responses
            if (response.ok) {
              const clonedResponse = response.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clonedResponse)
              })
            }
            return response
          })
          .catch(() => {
            // If offline, try to serve from cache
            return caches.match(request).then((cached) => {
              if (cached) {
                return cached
              }
              // Return offline error response
              return new Response(
                JSON.stringify({ error: 'Offline - no cached data available' }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
                }
              )
            })
          })
      )
      return
    }
    // For other API requests, just pass through
    return
  }

  // For check-in page navigation requests
  if (CHECKIN_URL_PATTERN.test(url.pathname) || url.pathname.includes('/checkin')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Serve from cache, also update in background
          fetch(request).then((response) => {
            const clonedResponse = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse)
            })
          })
          return cached
        }

        // Not in cache, fetch from network
        return fetch(request).then((response) => {
          // Cache the response for future use
          if (response.ok) {
            const clonedResponse = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse)
            })
          }
          return response
        }).catch(() => {
          // Network failed, try to serve a fallback
          return caches.match('/offline') || new Response(
            '<h1>Offline</h1><p>Check-in page não disponível offline.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        })
      })
    )
    return
  }

  // For static assets (JS, CSS, images)
  if (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse)
            })
          }
          return response
        })
      })
    )
    return
  }
})

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true })
      })
    )
  }
})
