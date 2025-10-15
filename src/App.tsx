import React, { useEffect, useState } from 'react';
import './App.css';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type Entry = {
  id?: number; 
  title: string;
  description: string;
  createdAt: number;
  sentAt?: number;
};

const DB_NAME = 'pwa-offline-db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const SENT_STORE = 'sentEntries';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
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

async function addToStore(storeName: string, value: any): Promise<number | undefined> {
  const db = await openDatabase();
  return new Promise<number | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(value);
    req.onsuccess = () => {
      resolve(req.result as number);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function App() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      console.log('✅ Evento beforeinstallprompt capturado');
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const onSWMessage = (ev: MessageEvent) => {
      const data = ev.data || {};
      if (data?.type === 'sync-complete') {
        const count = data.count ?? 0;
        loadEntries();
        alert(`Sincronización completada: ${count} ítem(s) sincronizado(s).`);
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', onSWMessage);
    loadEntries();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener?.('message', onSWMessage);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      console.log('Instalación no está disponible');
      return;
    }
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`El usuario ha ${outcome === 'accepted' ? 'aceptado' : 'rechazado'} la instalación`);
    setInstallPrompt(null);
    setIsInstallable(false);
  };

  async function loadEntries() {
    try {
      const outbox = await getAllFromStore<Entry>(OUTBOX_STORE);
      const sent = await getAllFromStore<Entry>(SENT_STORE);
      const combined = [
        ...sent.map(e => ({ ...e, /* status 'sent' */ })),
        ...outbox.map(e => ({ ...e /* pending */ }))
      ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setEntries(combined);
    } catch (err) {
      console.error('Error cargando entries:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const entry: Entry = { title: title.trim(), description: description.trim(), createdAt: Date.now() };

    if (navigator.onLine) {
      try {
        await addToStore(SENT_STORE, { ...entry, sentAt: Date.now() });
        setTitle('');
        setDescription('');
        await loadEntries();
        alert('Enviado (simulado) y guardado en sentEntries.');
      } catch (err) {
        console.error('Error guardando sent:', err);
      }
      return;
    }
    try {
      await addToStore(OUTBOX_STORE, entry);
      setTitle('');
      setDescription('');
      await loadEntries();

      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await (reg as ServiceWorkerRegistration & { sync?: any }).sync.register('sync-entries');
        } catch (err) {
          console.warn('No se pudo registrar sync:', err);
        }
      } else {
        console.log('SyncManager no disponible; quedará en outbox hasta reconectar.');
      }
      alert('Guardado localmente (offline). Se sincronizará cuando vuelvas a estar en línea.');
    } catch (err) {
      console.error('Error guardando outbox:', err);
    }
  }

  async function handleClearDb() {
    if (!confirm('¿Limpiar IndexedDB? Esto eliminará outbox y sentEntries.')) return;
    try {
      await clearStore(OUTBOX_STORE);
      await clearStore(SENT_STORE);
      await loadEntries();
      alert('IndexedDB limpiada.');
    } catch (err) {
      console.error('Error limpiando DB:', err);
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <img src="/icons/icon-192.png" alt="Logo de la Aplicación" className="logo-image" />
      </header>

      <main className="main-content">
        <section className="welcome-section">
          <h2>¡Bienvenido a una PWA!</h2>
          <p>Esta es una App Web Progresiva construida con React, TypeScript y Vite.</p>
        </section>

        <section className="features-grid">
          <div className="card">
            <div className="card-icon">📱</div>
            <h3>Instalable</h3>
            <p>Instala esta aplicación en tu dispositivo para una experiencia nativa.</p>
            {isInstallable && (
              <button className="install-button" onClick={handleInstallClick}>
                <span>➕</span> Instalar App
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-icon">⚡️</div>
            <h3>Servicio Offline Listo</h3>
            <p>Funciona sin conexión gracias al Service Worker.</p>
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Formulario - Reporte / Tareas</h2>
            <div style={{
              padding: '6px 10px',
              borderRadius: 8,
              color: '#fff',
              background: online ? '#2ecc71' : '#ff6b6b'
            }}>
              {online ? 'Online' : 'Offline'}
            </div>
          </header>

          <form onSubmit={handleSubmit} style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <label>
              Título
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ width: '100%', padding: 8, fontSize: 16 }}
              />
            </label>

            <label>
              Descripción
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                style={{ width: '100%', padding: 8, fontSize: 16 }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ padding: '8px 12px' }}>
                Guardar / Enviar
              </button>
              <button type="button" onClick={handleClearDb} style={{ padding: '8px 12px' }}>
                Limpiar DB
              </button>
            </div>
          </form>

          <h3 style={{ marginTop: 20 }}>Registros</h3>
          <div id="listContainer" style={{ marginTop: 8 }}>
            {entries.length === 0 && <div>No hay registros</div>}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {entries.map((e) => (
                <li key={e.id ?? `${e.createdAt}`} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <strong>{e.title}</strong>
                  <p style={{ margin: '6px 0' }}>{e.description}</p>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Creado: {new Date(e.createdAt).toLocaleString()}
                    {e.sentAt ? ` — Enviado: ${new Date(e.sentAt).toLocaleString()}` : ' — Pendiente'}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
