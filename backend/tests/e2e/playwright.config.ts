import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para tests E2E del Sistema de Asistencia
 * 
 * Este archivo configura:
 * - Ambientes de prueba (staging, local)
 * - Navegadores (Chrome, Firefox, Safari)
 * - Timeouts y retries
 * - Reportes y artefactos
 */
export default defineConfig({
  testDir: './requisitos',
  
  // Timeout por test (5 minutos para flujos completos)
  timeout: 5 * 60 * 1000,
  
  // Expect timeout (10 segundos para aserciones)
  expect: {
    timeout: 10000
  },
  
  // Configuración de ejecución
  fullyParallel: true, // Ejecutar tests en paralelo
  forbidOnly: !!process.env.CI, // Prohibir .only en CI
  retries: process.env.CI ? 2 : 0, // Reintentos en CI
  workers: process.env.CI ? 1 : undefined, // Workers en CI
  
  // Reportes
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  
  // Configuración de uso compartido
  use: {
    // URL base (se puede sobrescribir con env)
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    
    // Trace en caso de falla
    trace: 'retain-on-failure',
    
    // Screenshot en caso de falla
    screenshot: 'only-on-failure',
    
    // Video en caso de falla
    video: 'retain-on-failure',
    
    // Timeout de navegación
    navigationTimeout: 30000,
    
    // Headers comunes
    extraHTTPHeaders: {
      'Accept-Language': 'es-CL,es;q=0.9'
    }
  },

  // Proyectos (navegadores y configuraciones)
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    // Navegador principal: Chromium
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Simular estudiante con cámara
        permissions: ['camera']
      },
      dependencies: ['setup']
    },

    // Firefox (opcional, para validación cross-browser)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup']
    },

    // Mobile (opcional, para validación mobile)
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        permissions: ['camera']
      },
      dependencies: ['setup']
    }
  ],

  // Servidor de desarrollo (si se ejecuta localmente)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
