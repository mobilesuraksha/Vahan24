// service-worker.js - PWA Service Worker
// ============================================

const CACHE_VERSION = 'v1';
const CACHE_NAME = `vahan-sahayata-${CACHE_VERSION}`;

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/mechanic.html',
    '/admin.html',
    '/offline.html',
    '/style.css',
    '/app.js',
    '/mechanic.js',
    '/admin.js',
    '/firebase.js',
    '/manifest.json'
];

// ============================================
// INSTALL EVENT - Cache static assets
// ============================================

self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install event');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================
// ACTIVATE EVENT - Clean up old caches
// ============================================

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate event');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================
// FETCH EVENT - Serve from cache, fallback to network
// ============================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Firebase URLs (let them go to network)
    if (url.hostname.includes('firebasestorage') || 
        url.hostname.includes('firebaseapp') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic')) {
        event.respondWith(fetch(request));
        return;
    }

    // Network first for API calls
    if (url.pathname.startsWith('/api')) {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(request))
        );
        return;
    }

    // Cache first, fallback to network
    event.respondWith(
        caches.match(request)
            .then((response) => {
                if (response) {
                    return response;
                }

                return fetch(request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Cache successful responses
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });

                        return response;
                    })
                    .catch(() => {
                        // Return offline page if available
                        if (request.destination === 'document') {
                            return caches.match('/offline.html');
                        }

                        // Return a placeholder for other requests
                        return new Response('Offline - Resource not available', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// ============================================
// MESSAGE EVENT - Handle messages from clients
// ============================================

self.addEventListener('message', (event) => {
    console.log('[ServiceWorker] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Handle cache update
    if (event.data && event.data.type === 'UPDATE_CACHE') {
        const { url } = event.data;
        caches.open(CACHE_NAME).then((cache) => {
            fetch(url).then((response) => {
                cache.put(url, response);
            });
        });
    }

    // Handle cache clear
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});

// ============================================
// SYNC EVENT - Background sync
// ============================================

self.addEventListener('sync', (event) => {
    console.log('[ServiceWorker] Sync event:', event.tag);

    if (event.tag === 'sync-bookings') {
        event.waitUntil(syncBookings());
    }
});

async function syncBookings() {
    try {
        // Open IndexedDB if available for offline data
        console.log('[ServiceWorker] Syncing bookings...');
        // Implementation would depend on IndexedDB setup
    } catch (error) {
        console.error('[ServiceWorker] Sync error:', error);
        throw error;
    }
}

// ============================================
// PUSH EVENT - Handle push notifications
// ============================================

self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push event received');

    let notificationData = {
        title: 'Vahan Sahayata',
        body: 'You have a new notification',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23DC143C" width="192" height="192"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="100" font-weight="bold" fill="white">🚗</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="%23DC143C"/></svg>',
        tag: 'vahan-notification',
        requireInteraction: true
    };

    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = { ...notificationData, ...data };
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction,
            actions: [
                {
                    action: 'open',
                    title: 'Open'
                },
                {
                    action: 'close',
                    title: 'Close'
                }
            ]
        })
    );
});

// ============================================
// NOTIFICATION CLICK EVENT
// ============================================

self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification click:', event.action);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if app window is already open
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If not open, open new window
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// ============================================
// PERIODIC BACKGROUND SYNC
// ============================================

self.addEventListener('periodicsync', (event) => {
    console.log('[ServiceWorker] Periodic sync:', event.tag);

    if (event.tag === 'update-requests') {
        event.waitUntil(updateRequests());
    }
});

async function updateRequests() {
    try {
        console.log('[ServiceWorker] Updating requests...');
        // Implementation would check for new requests
    } catch (error) {
        console.error('[ServiceWorker] Update error:', error);
        throw error;
    }
}

console.log('[ServiceWorker] Service Worker loaded');
