import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vite Configuration
 * Responsabilidad: Configuración del bundler y dev server para frontend
 *
 * Flujo (desarrollo y producción):
 * - Apache proxy: /asistencia/* -> Fastify :3000/*
 * - Fastify proxy (dev): /* -> Vite :5173/*
 * - Vite sirve con base: '/asistencia/' para que los assets tengan el prefijo correcto
 * - Los HTMLs usan rutas relativas desde /asistencia/ (ej: /asistencia/shared/styles/base.css)
 */

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  // Directorio raíz del frontend
  root: 'src/frontend',

  // Base path para assets - Debe ser '/asistencia/' en todos los entornos
  // porque Apache siempre hace proxy desde /asistencia/*
  base: '/asistencia/',

  // Configuración de esbuild - eliminar console.* en producción
  esbuild: {
    drop: isProduction ? ['console', 'debugger'] : [],
  },

  // Configuración de build
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'qr-host': path.resolve(__dirname, 'src/frontend/features/qr-host/index.html'),
        'qr-reader': path.resolve(__dirname, 'src/frontend/features/qr-reader/index.html'),
      },
    },
  },

  appType: 'mpa',

  // Configuración del dev server
  server: {
    host: '0.0.0.0',
    port: 5173,

    // HMR: Hot Module Replacement via WebSocket
    // En desarrollo con proxy HTTPS, deshabilitamos HMR para evitar errores SSL
    // El usuario puede recargar manualmente o usar HTTP directo
    hmr: {
      // Usar el mismo protocolo que la página (ws o wss)
      protocol: 'ws',
      host: 'localhost',
      clientPort: 9504,
    },
  },

  // Resolución de módulos
  resolve: {
    extensions: ['.ts', '.js'],
  },

  // Configuración de Vitest (unit tests para backend)
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/frontend'],
    alias: {
      '@backend': path.resolve(__dirname, 'src/backend'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'dist', 'src/frontend', '**/*.test.ts'],
    },
  },
});
