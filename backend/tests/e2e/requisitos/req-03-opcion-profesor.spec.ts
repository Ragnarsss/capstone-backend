import { test, expect, type Page } from '@playwright/test';
import { TestDatabase } from '../setup/test-db';
import { TestUsers } from '../setup/test-users';
import { takeScreenshot, queryDatabase } from '../setup/helpers';

/**
 * Requisito 3: Capacidad de profesores para "abrir" sesión de asistencia
 * 
 * Validaciones:
 * - Botón "Nuevo Sistema de Asistencia" visible en main_curso.php
 * - Función can_tomar_asistencia() valida permisos correctamente
 * - Modal se abre en < 500ms
 * - JWT se genera y transmite correctamente vía postMessage
 * - Iframe carga el frontend de profesor (qr-host)
 * - QR dinámico se genera y cambia cada 10 segundos
 * - WebSocket se conecta correctamente
 * 
 * Componentes involucrados:
 * - main_curso.php (L619-657)
 * - api_get_asistencia_token.php
 * - /asistencia/features/qr-host/index.html
 * - Backend Node.js (WebSocket + QR generation)
 */

test.describe('Requisito 3: Opción Profesor - Abrir Sesión de Asistencia', () => {
  let page: Page;
  let db: TestDatabase;
  let profesorAutorizado: any;
  let profesorNoAutorizado: any;
  let cursoTest: any;

  test.beforeAll(async () => {
    // Inicializar base de datos de prueba
    db = new TestDatabase();
    await db.connect();
    await db.loadFixtures();

    // Obtener datos de prueba
    profesorAutorizado = TestUsers.getProfesorAutorizado();
    profesorNoAutorizado = TestUsers.getProfesorNoAutorizado();
    cursoTest = await db.getCursoTest();
  });

  test.afterAll(async () => {
    await db.cleanup();
    await db.disconnect();
  });

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Configurar interceptores de red para capturar requests
    await page.route('**/api_get_asistencia_token.php', async route => {
      // Permitir request pero capturar para validación
      await route.continue();
    });
  });

  test('REQ-03-001: Botón visible para profesor autorizado', async () => {
    // Arrange: Login como profesor autorizado
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorAutorizado.email);
    await page.fill('input[name="password"]', profesorAutorizado.password);
    await page.click('button[type="submit"]');
    
    // Navegar a main_curso.php
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    
    // Act & Assert: Verificar botón visible
    const button = page.locator('#main_curso_nuevo_sistema_asistencia');
    await expect(button).toBeVisible({ timeout: 5000 });
    
    // Verificar texto del botón
    await expect(button).toHaveText(/Nuevo Sistema de Asistencia/i);
    
    // Verificar ícono
    const icon = button.locator('i.fa-check-square-o');
    await expect(icon).toBeVisible();
    
    // Capturar screenshot para evidencia
    await takeScreenshot(page, 'req-03-001-boton-visible-profesor-autorizado');
  });

  test('REQ-03-002: Botón NO visible para profesor no autorizado', async () => {
    // Arrange: Login como profesor NO autorizado
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorNoAutorizado.email);
    await page.fill('input[name="password"]', profesorNoAutorizado.password);
    await page.click('button[type="submit"]');
    
    // Navegar a main_curso.php de un curso donde NO es profesor
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    
    // Act & Assert: Verificar botón NO visible
    const button = page.locator('#main_curso_nuevo_sistema_asistencia');
    await expect(button).not.toBeVisible();
    
    // Capturar screenshot para evidencia
    await takeScreenshot(page, 'req-03-002-boton-no-visible-profesor-no-autorizado');
  });

  test('REQ-03-003: Modal se abre en < 500ms con iframe', async () => {
    // Arrange: Login y navegar a curso
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorAutorizado.email);
    await page.fill('input[name="password"]', profesorAutorizado.password);
    await page.click('button[type="submit"]');
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    
    // Act: Hacer clic en botón y medir tiempo
    const startTime = Date.now();
    await page.click('#main_curso_nuevo_sistema_asistencia');
    
    // Assert: Modal visible en < 500ms
    const modal = page.locator('.ui-dialog').filter({ hasText: /Nuevo Sistema de Asistencia/i });
    await expect(modal).toBeVisible({ timeout: 1000 });
    const elapsedTime = Date.now() - startTime;
    expect(elapsedTime).toBeLessThan(500);
    
    // Verificar iframe dentro del modal
    const iframe = modal.locator('iframe');
    await expect(iframe).toBeVisible();
    
    // Verificar src del iframe
    const iframeSrc = await iframe.getAttribute('src');
    expect(iframeSrc).toContain('asistencia/features/qr-host');
    
    // Capturar screenshot para evidencia
    await takeScreenshot(page, 'req-03-003-modal-abierto-con-iframe');
  });

  test('REQ-03-004: JWT generado correctamente y enviado al iframe', async () => {
    // Arrange: Setup para capturar request y postMessage
    let jwtToken: string | null = null;
    let postMessageData: any = null;

    // Interceptar request de JWT
    await page.route('**/api_get_asistencia_token.php', async route => {
      const response = await route.fetch();
      const json = await response.json();
      jwtToken = json.token;
      await route.fulfill({ response });
    });

    // Interceptar postMessage (usando page.evaluate en contexto de página)
    await page.addInitScript(() => {
      const originalPostMessage = window.postMessage;
      (window as any).__capturedPostMessages = [];
      window.postMessage = function(message: any, targetOrigin: string) {
        (window as any).__capturedPostMessages.push({ message, targetOrigin });
        return originalPostMessage.call(this, message, targetOrigin);
      };
    });

    // Login y navegar
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorAutorizado.email);
    await page.fill('input[name="password"]', profesorAutorizado.password);
    await page.click('button[type="submit"]');
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    
    // Act: Hacer clic en botón
    await page.click('#main_curso_nuevo_sistema_asistencia');
    
    // Esperar a que el modal esté abierto
    await page.waitForSelector('.ui-dialog iframe', { timeout: 5000 });
    
    // Assert: JWT recibido
    expect(jwtToken).not.toBeNull();
    expect(jwtToken).toBeTruthy();
    
    // Validar estructura JWT (header.payload.signature)
    const jwtParts = jwtToken!.split('.');
    expect(jwtParts).toHaveLength(3);
    
    // Decodificar y validar claims
    const payload = JSON.parse(atob(jwtParts[1]));
    expect(payload).toHaveProperty('userId');
    expect(payload).toHaveProperty('email');
    expect(payload).toHaveProperty('role');
    expect(payload.email).toBe(profesorAutorizado.email);
    
    // Esperar a que postMessage se envíe
    await page.waitForTimeout(1000);
    
    // Obtener postMessages capturados
    const capturedMessages = await page.evaluate(() => (window as any).__capturedPostMessages);
    
    // Validar que se envió el token
    const tokenMessage = capturedMessages.find((msg: any) => msg.message.token);
    expect(tokenMessage).toBeTruthy();
    expect(tokenMessage.message.token).toBe(jwtToken);
    
    // Capturar screenshot para evidencia
    await takeScreenshot(page, 'req-03-004-jwt-generado-y-enviado');
  });

  test('REQ-03-005: QR dinámico visible y cambia cada 10 segundos', async () => {
    // Arrange: Login y abrir modal
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorAutorizado.email);
    await page.fill('input[name="password"]', profesorAutorizado.password);
    await page.click('button[type="submit"]');
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    await page.click('#main_curso_nuevo_sistema_asistencia');
    
    // Esperar a que el iframe cargue
    const modal = page.locator('.ui-dialog').filter({ hasText: /Nuevo Sistema de Asistencia/i });
    const iframe = modal.locator('iframe');
    await expect(iframe).toBeVisible();
    
    // Obtener contexto del iframe
    const iframeElement = await iframe.elementHandle();
    const frame = await iframeElement!.contentFrame();
    expect(frame).not.toBeNull();
    
    // Act & Assert: Verificar QR visible
    const qrElement = frame!.locator('#qr-code, canvas, svg').first();
    await expect(qrElement).toBeVisible({ timeout: 10000 });
    
    // Capturar primer estado del QR
    const qrDataAttr = await qrElement.getAttribute('data-qr-value') || 
                       await frame!.evaluate(() => (window as any).__currentQRValue);
    
    // Esperar 11 segundos (10 + 1 de margen)
    await page.waitForTimeout(11000);
    
    // Capturar segundo estado del QR
    const qrDataAttr2 = await qrElement.getAttribute('data-qr-value') || 
                        await frame!.evaluate(() => (window as any).__currentQRValue);
    
    // Assert: QR cambió
    expect(qrDataAttr2).not.toBe(qrDataAttr);
    
    // Capturar screenshots para evidencia
    await takeScreenshot(page, 'req-03-005-qr-estado-1');
    await page.waitForTimeout(10000);
    await takeScreenshot(page, 'req-03-005-qr-estado-2');
  });

  test('REQ-03-006: WebSocket se conecta correctamente', async () => {
    // Arrange: Capturar logs de consola
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    // Login y abrir modal
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorAutorizado.email);
    await page.fill('input[name="password"]', profesorAutorizado.password);
    await page.click('button[type="submit"]');
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    await page.click('#main_curso_nuevo_sistema_asistencia');
    
    // Esperar a que el iframe cargue
    const modal = page.locator('.ui-dialog').filter({ hasText: /Nuevo Sistema de Asistencia/i });
    const iframe = modal.locator('iframe');
    await expect(iframe).toBeVisible();
    
    // Esperar a que WebSocket se conecte (máximo 5 segundos)
    await page.waitForTimeout(5000);
    
    // Assert: Verificar que se conectó
    const wsConnectedLog = consoleLogs.find(log => 
      log.includes('WebSocket connected') || log.includes('ws:') || log.includes('websocket')
    );
    expect(wsConnectedLog).toBeTruthy();
    
    // Verificar en el iframe también
    const iframeElement = await iframe.elementHandle();
    const frame = await iframeElement!.contentFrame();
    
    const wsState = await frame!.evaluate(() => {
      return (window as any).__wsConnection?.readyState;
    });
    
    // readyState = 1 significa OPEN
    expect(wsState).toBe(1);
    
    // Capturar screenshot para evidencia
    await takeScreenshot(page, 'req-03-006-websocket-conectado');
  });

  test('REQ-03-007: Sesión de asistencia se registra en BD', async () => {
    // Arrange: Login y abrir modal
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorAutorizado.email);
    await page.fill('input[name="password"]', profesorAutorizado.password);
    await page.click('button[type="submit"]');
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    await page.click('#main_curso_nuevo_sistema_asistencia');
    
    // Esperar a que se genere el QR (esto debería crear la sesión)
    await page.waitForTimeout(3000);
    
    // Act: Consultar base de datos
    const sessions = await queryDatabase(db.pool, `
      SELECT * FROM asistencia_curso 
      WHERE curso = $1 
      AND semestre = $2 
      AND fecha = CURRENT_DATE
      ORDER BY id DESC 
      LIMIT 1
    `, [cursoTest.id, cursoTest.semestre]);
    
    // Assert: Sesión registrada
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    expect(session.codigo).toBeTruthy();
    expect(session.usuario).toBe(profesorAutorizado.email);
    expect(session.fechahora_inicio).toBeTruthy();
    expect(session.fechahora_termino).toBeTruthy();
    
    // Validar TTL (debe ser 5 minutos)
    const ttlMinutes = (new Date(session.fechahora_termino) - new Date(session.fechahora_inicio)) / 60000;
    expect(ttlMinutes).toBeCloseTo(5, 0);
    
    // Guardar evidencia en archivo
    await db.saveQueryResult('req-03-007-sesion-registrada', sessions);
  });

  test('REQ-03-008: Modal se cierra correctamente y desconecta WebSocket', async () => {
    // Arrange: Capturar logs de consola
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    // Login y abrir modal
    await page.goto('/dev-login.php');
    await page.fill('input[name="email"]', profesorAutorizado.email);
    await page.fill('input[name="password"]', profesorAutorizado.password);
    await page.click('button[type="submit"]');
    await page.goto(`/main_curso.php?s=${cursoTest.semestre}&c=${cursoTest.id}`);
    await page.click('#main_curso_nuevo_sistema_asistencia');
    
    // Esperar a que el iframe cargue y WebSocket conecte
    const modal = page.locator('.ui-dialog').filter({ hasText: /Nuevo Sistema de Asistencia/i });
    await expect(modal).toBeVisible();
    await page.waitForTimeout(3000);
    
    // Act: Cerrar modal
    const closeButton = modal.locator('button.ui-dialog-titlebar-close');
    await closeButton.click();
    
    // Assert: Modal cerrado
    await expect(modal).not.toBeVisible({ timeout: 2000 });
    
    // Esperar a que se procese la desconexión
    await page.waitForTimeout(1000);
    
    // Verificar logs de desconexión
    const wsDisconnectedLog = consoleLogs.find(log => 
      log.includes('WebSocket disconnected') || log.includes('closed')
    );
    expect(wsDisconnectedLog).toBeTruthy();
    
    // Capturar screenshot para evidencia
    await takeScreenshot(page, 'req-03-008-modal-cerrado');
  });
});
