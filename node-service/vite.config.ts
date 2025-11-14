import { defineConfig } from 'vite';
import path from 'path';

/**
 * Vite Configuration
 * Responsabilidad: Configuración del bundler y dev server para frontend
 *
 * Nota: En esta arquitectura, Vite NO hace proxy a backend.
 * El flujo es: Apache -> Fastify (backend) -> Vite (frontend)
 * Las peticiones /ws y /api son manejadas por Fastify antes de llegar aquí.
 */
export default defineConfig({
  // Directorio raíz del frontend
  root: 'src/frontend',

  // Base path para assets (debe coincidir con Apache ProxyPass)
  base: '/asistencia/',

  // Configuración de build
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'src/frontend/index.html'),
        lector: path.resolve(__dirname, 'src/frontend/lector/index.html'),
      },
    },
  },

  appType: 'mpa',

  // Configuración del dev server
  server: {
    host: '0.0.0.0', // Escuchar en todas las interfaces (necesario para contenedores)
    port: 5173,
    // Sin proxy: Fastify maneja el routing a backend

    // HMR: Hot Module Replacement via WebSocket
    hmr: {
      clientPort: 9504, // Puerto accesible desde navegador (expuesto en compose.dev.yaml)
    },
  },

  // Resolución de módulos
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
