const CACHE_NAME = "pwa-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(
      (response) => response || fetch(event.request)
    )
  );
});

const OUTBOX_STORE = 'outbox';
const SENT_STORE = 'sentEntries';
const DB_NAME = 'pwa-offline-db';
const DB_VERSION = 1;

const OFFLINE_URL = '/offline.html';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add(OFFLINE_URL).catch(() => {
        console.warn('No se pudo cachear offline.html (posiblemente no exista en public).');
      }))
  );
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(SENT_STORE)) {
        db.createObjectStore(SENT_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllOutbox() {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const store = tx.objectStore(OUTBOX_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function deleteOutboxItem(id) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(OUTBOX_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function addToSent(entry) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SENT_STORE, 'readwrite');
    const store = tx.objectStore(SENT_STORE);
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-entries') {
    console.log('[SW] sync event recibido:', event.tag);
    event.waitUntil(syncOutbox());
  }
});

async function syncOutbox() {
  try {
    const outbox = await getAllOutbox();
    if (!outbox || outbox.length === 0) {
      console.log('[SW] Outbox vacío. Nada que sincronizar.');
      return;
    }

    let successCount = 0;
    for (const item of outbox) {
      try {
        await addToSent({ ...item, sentAt: Date.now() });
        await deleteOutboxItem(item.id);
        successCount++;
      } catch (err) {
        console.error('[SW] Error procesando item outbox:', err);
      }
    }
    const allClients = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
    for (const c of allClients) {
      c.postMessage({ type: 'sync-complete', count: successCount });
    }
    try {
      self.registration.showNotification('Sincronización completada', { body: `${successCount} registro(s) sincronizado(s).` });
    } catch (e) {
    }

    console.log(`[SW] syncOutbox: ${successCount} item(s) sincronizado(s).`);
  } catch (err) {
    console.error('[SW] syncOutbox fallo:', err);
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'simulate-push') {
    const title = data.title || 'Notificación simulada';
    const body = data.body || '';
    self.registration.showNotification(title, { body, tag: 'simulated-push' });
    return;
  }

  if (data && data.type === 'try-sync') {
    
    event.waitUntil(syncOutbox());
    return;
  }
  console.log('[SW] mensaje recibido:', data);
});

self.addEventListener('push', (event) => {
  console.log('[SW] push recibido:', event);
  let payload = { title: 'Nuevo mensaje', body: 'Tienes notificaciones.' };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    try {
      const text = event.data && event.data.text ? event.data.text() : null;
      if (text) payload.body = text;
    } catch (err) { }
  }

  const options = {
    body: payload.body,
    tag: payload.tag || 'push-tag',
    data: payload.data || {}
  };
  

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
  
  self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'simulate-push') {
    const title = data.title || '🔔 Notificación PWA';
    const body = data.body || 'Esta es una notificación simulada de tu PWA.';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        tag: 'simulated-push',
      })
    );
  }
});
  
});

