import { useState, useEffect } from 'react'; // 👈 1. Importa los hooks necesarios
import './App.css';

// 👈 2. Definimos el tipo para el evento de instalación para que TypeScript no de errores
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function App() {

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
  
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); 
      console.log('✅ Evento beforeinstallprompt capturado');
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsInstallable(true); 
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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

  return (
    <div className="app-container">
      <header className="app-header">
  <img src="/icons/icon-192x192.png" alt="Logo de la Aplicación" className="logo-image" />
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
                <span>➕</span>
                Instalar App
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-icon">⚡️</div>
            <h3>Servicio Offline Listo</h3>
            <p>Funciona sin conexión gracias al Service Worker.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
