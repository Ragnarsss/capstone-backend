import { Page } from '@playwright/test';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Utilidades compartidas para tests E2E
 */

/**
 * Tomar screenshot con nombre descriptivo y guardarlo en carpeta de evidencias
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const screenshotPath = path.join(__dirname, '../../evidencias', `${name}.png`);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`✓ Screenshot guardado: ${name}.png`);
}

/**
 * Ejecutar query en base de datos y retornar resultados
 */
export async function queryDatabase(pool: Pool, sql: string, params: any[] = []): Promise<any[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Esperar a que un elemento sea visible con timeout personalizado
 */
export async function waitForElement(page: Page, selector: string, timeout: number = 5000): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Esperar a que una condición se cumpla (polling)
 */
export async function waitForCondition(
  conditionFn: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 10000, interval = 500 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout esperando condición después de ${timeout}ms`);
}

/**
 * Ejecutar login como usuario
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/dev-login.php');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle' });
}

/**
 * Limpiar sesión (logout)
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/logout.php');
}

/**
 * Capturar logs de consola del navegador
 */
export function captureConsoleLogs(page: Page): string[] {
  const logs: string[] = [];
  page.on('console', msg => logs.push(msg.text()));
  return logs;
}

/**
 * Capturar requests de red
 */
export function captureNetworkRequests(page: Page): any[] {
  const requests: any[] = [];
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData()
    });
  });
  return requests;
}

/**
 * Capturar responses de red
 */
export function captureNetworkResponses(page: Page): any[] {
  const responses: any[] = [];
  page.on('response', async response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      body: await response.text().catch(() => null)
    });
  });
  return responses;
}

/**
 * Generar datos de prueba aleatorios
 */
export function generateTestData() {
  const timestamp = Date.now();
  return {
    email: `test.${timestamp}@ucn.cl`,
    rut: `${Math.floor(Math.random() * 90000000) + 10000000}-${Math.floor(Math.random() * 10)}`,
    nombre: `Test Usuario ${timestamp}`,
    codigo: `TEST${timestamp}`
  };
}

/**
 * Formatear fecha para queries SQL
 */
export function formatDateForSQL(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Formatear fecha para formato legacy (YYYYMMDD)
 */
export function formatDateLegacy(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Validar estructura de JWT
 */
export function validateJWT(token: string): { header: any; payload: any; signature: string } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT inválido: debe tener 3 partes');
  }

  const header = JSON.parse(atob(parts[0]));
  const payload = JSON.parse(atob(parts[1]));
  const signature = parts[2];

  return { header, payload, signature };
}

/**
 * Guardar evidencia como JSON
 */
export async function saveEvidenceJSON(name: string, data: any): Promise<void> {
  const evidencePath = path.join(__dirname, '../../evidencias', `${name}.json`);
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, JSON.stringify(data, null, 2));
  console.log(`✓ Evidencia JSON guardada: ${name}.json`);
}

/**
 * Guardar evidencia como texto
 */
export async function saveEvidenceText(name: string, content: string): Promise<void> {
  const evidencePath = path.join(__dirname, '../../evidencias', `${name}.txt`);
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, content);
  console.log(`✓ Evidencia de texto guardada: ${name}.txt`);
}

/**
 * Medir tiempo de ejecución de una función
 */
export async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
  const startTime = Date.now();
  const result = await fn();
  const timeMs = Date.now() - startTime;
  return { result, timeMs };
}

/**
 * Verificar que un elemento contiene texto (case-insensitive)
 */
export async function elementContainsText(page: Page, selector: string, text: string): Promise<boolean> {
  const element = await page.locator(selector).first();
  const content = await element.textContent();
  return content?.toLowerCase().includes(text.toLowerCase()) ?? false;
}

/**
 * Esperar a que cargue un iframe específico
 */
export async function waitForIframe(page: Page, selector: string): Promise<any> {
  await page.waitForSelector(selector);
  const iframeElement = await page.locator(selector).elementHandle();
  const frame = await iframeElement!.contentFrame();
  if (!frame) {
    throw new Error(`No se pudo obtener contenido del iframe: ${selector}`);
  }
  return frame;
}

/**
 * Ejecutar código JavaScript en contexto del iframe
 */
export async function evaluateInIframe<T>(
  page: Page,
  iframeSelector: string,
  fn: () => T
): Promise<T> {
  const frame = await waitForIframe(page, iframeSelector);
  return await frame.evaluate(fn);
}

/**
 * Generar código de reserva de prueba (simular gen_cod_reserva)
 */
export function generateReservaCode(id: number): string {
  // Simplificación del algoritmo real de PHP
  const b = id.toString(2).padStart(26, '0');
  const s = b.split('').reverse().join('');
  let code = parseInt(s, 2).toString(26).padStart(6, '0').toUpperCase();
  
  // Aplicar sustituciones
  const replacements: { [key: string]: string } = {
    'P': 'Z', 'O': 'Y', 'N': 'X', 'M': 'W', 'L': 'V', 'K': 'U',
    'J': 'T', 'I': 'S', 'H': 'R', 'G': 'Q', 'F': 'P', 'E': 'O',
    'D': 'N', 'C': 'M', 'B': 'L', 'A': 'K', '9': 'J', '8': 'I',
    '7': 'H', '6': 'G', '5': 'F', '4': 'E', '3': 'D', '2': 'C',
    '1': 'B', '0': 'A'
  };
  
  for (const [from, to] of Object.entries(replacements)) {
    code = code.replace(new RegExp(from, 'g'), to);
  }
  
  return code;
}
