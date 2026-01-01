import { defineConfig } from 'vite';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno desde el .env del proyecto padre
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
    // Directorio raíz del frontend
    root: 'src',

    // Base path para assets
    base: '/asistencia/',

    // Configuración de esbuild
    esbuild: {
        drop: isProduction ? ['console', 'debugger'] : [],
    },

    // Configuración de build
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                'qr-host': path.resolve(__dirname, 'src/features/qr-host/index.html'),
                'qr-reader': path.resolve(__dirname, 'src/features/qr-reader/index.html'),
                'enrollment': path.resolve(__dirname, 'src/features/enrollment/index.html'),
            },
        },
    },

    appType: 'mpa',

    // Configuración del dev server
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
    },

    // Resolver alias
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
