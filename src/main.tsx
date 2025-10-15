import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('Service Worker registrado:', reg))
      .catch((err) => console.error('Error al registrar el SW:', err))
  })
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((registration) => {
      console.log('✅ Service Worker listo:', registration);
    })
    .catch((err) => {
      console.warn('Service Worker ready falló:', err);
    });

  navigator.serviceWorker.addEventListener?.('message', (event: MessageEvent) => {
    const data = event.data || {};
    console.log('Mensaje recibido desde SW:', data);
    if (data?.type === 'sync-complete') {
      const count = data.count ?? 0;
      console.log(`SW: sincronización completada (${count} item(s)).`);
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Sincronización completada', { body: `${count} registro(s) sincronizado(s).` });
        } catch (e) {
          console.warn('No se pudo mostrar la notificación:', e);
        }
      }
    }
  });

  window.addEventListener('online', async () => {
    console.log('Evento: online — intentando sincronizar outbox (si aplica).');

    try {
      const reg = await navigator.serviceWorker.ready;
      if ('sync' in (reg as ServiceWorkerRegistration)) {
        try {
          await (reg as ServiceWorkerRegistration & { sync?: any }).sync.register('sync-entries');
          console.log('Intento: SyncManager.register("sync-entries") realizado.');
        } catch (err) {
          console.warn('No se pudo registrar sync-entries via SyncManager:', err);
        }
      } else {
        console.log('SyncManager no disponible en este navegador (se usará fallback).');
      }
      try {
        reg.active?.postMessage({ type: 'try-sync' });
        console.log('Mensaje enviado al SW: try-sync (fallback).');
      } catch (err) {
        console.warn('No se pudo enviar postMessage al SW:', err);
      }
    } catch (err) {
      console.error('Error al obtener navigator.serviceWorker.ready:', err);
    }
  });
}
