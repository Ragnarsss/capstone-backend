import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno desde el .env del proyecto padre
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/tests/e2e/**',
            '**/*.e2e.spec.ts',
            '**/playwright.config.ts'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov', 'json-summary'],
            exclude: [
                'node_modules/',
                'dist/',
                'tests/e2e/**',
                '**/__tests__/**',
                '**/*.test.ts',
                '**/*.spec.ts'
            ],
            reportsDirectory: './coverage'
        },
        testTimeout: 10000
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
});
