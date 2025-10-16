# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
## 🧩 Arquitectura de la PWA

### App Shell
El App Shell contiene la estructura básica de la interfaz (`index.html`, `manifest.json`, `icons/`) y se almacena en caché para garantizar una carga instantánea y soporte offline.

### Service Worker
Ubicado en la raíz del proyecto, administra el ciclo de vida de la PWA:

- **`install`** → Precachea los archivos esenciales.  
- **`activate`** → Limpia versiones antiguas del caché.  
- **`fetch`** → Intercepta las peticiones para aplicar las estrategias de caché.

---

## 🧠 Estrategias de caché adoptadas

| Tipo de recurso | Estrategia | Descripción |
|------------------|-------------|--------------|
| App Shell (`index.html`, `manifest.json`, íconos) | **Cache First** | Carga instantánea y modo offline. |
| Estilos y scripts (`.css`, `.js`) | **Cache with Network Fallback** | Usa caché si está disponible; actualiza desde la red si hay una nueva versión. |
| Datos dinámicos (API REST) | **Network First** | Prioriza información actualizada y recurre a caché/IndexedDB en modo offline. |
| Íconos e imágenes | **Cache First con versionado** | Menor uso de red y carga rápida. |

**Justificación:**  
Estas estrategias se seleccionaron para equilibrar **rendimiento, disponibilidad y frescura de los datos**, garantizando una experiencia estable incluso sin conexión.

---

## 🧾 Estructura básica del Service Worker

```js
const CACHE_NAME = "pwa-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
})

