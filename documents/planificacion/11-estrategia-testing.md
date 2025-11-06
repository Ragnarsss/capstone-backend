# Estrategia de Testing

## Propósito

Definir la estrategia de testing unitario para garantizar la calidad, seguridad y confiabilidad del Sistema de Asistencia Criptográfica.

**NOTA:** Este proyecto utiliza **ÚNICAMENTE testing unitario** con cobertura mínima del 60%. No se implementan tests de integración ni E2E debido a las restricciones de timeline del proyecto (4 semanas).

---

## Enfoque de Testing

### Cobertura por Módulo

| Módulo | Cobertura Unit (Objetivo) | Prioridad |
|--------|---------------------------|-----------|
| Enrolamiento FIDO2 | >60% | Crítica |
| Login ECDH | >60% | Crítica |
| Asistencia N Rondas | >60% | Crítica |
| WebSocket Protocol | >60% | Alta |

### Métricas de Calidad

```typescript
interface CoverageMetrics {
  statements: number;  // >60%
  branches: number;    // >50%
  functions: number;   // >60%
  lines: number;       // >60%
}
```

---

## Framework y Herramientas

### Node Service (TypeScript)

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "supertest": "^6.3.0",
    "@shelf/jest-mongodb": "^4.1.0",
    "ioredis-mock": "^8.9.0"
  }
}
```

### PHP Service

```json
{
  "require-dev": {
    "phpunit/phpunit": "^9.5",
    "mockery/mockery": "^1.5",
    "symfony/http-client": "^6.0"
  }
}
```

### Frontend (JavaScript)

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "jsdom": "^22.0.0",
    "@testing-library/dom": "^9.0.0"
  }
}
```

---

## 1. Unit Tests

### 1.1 Módulo Enrolamiento

#### FIDO2/WebAuthn

```typescript
// tests/enrollment/webauthn.test.ts
import { EnrollmentService } from '@/features/enrollment/enrollment.service';

describe('WebAuthn Enrollment', () => {
  let service: EnrollmentService;

  beforeEach(() => {
    service = new EnrollmentService();
  });

  it('debería generar challenge de 32 bytes', () => {
    const challenge = service.generateChallenge();
    expect(challenge).toHaveLength(32);
  });

  it('debería validar attestation object correcto', async () => {
    const attestation = createMockAttestation();
    const result = await service.validateAttestation(attestation);
    expect(result.valid).toBe(true);
  });

  it('debería rechazar attestation con challenge incorrecto', async () => {
    const attestation = createMockAttestation({ invalidChallenge: true });
    await expect(service.validateAttestation(attestation))
      .rejects.toThrow('Challenge inválido');
  });

  it('debería verificar AAGUID permitido', () => {
    const aaguid = 'adce0002-35bc-c60a-648b-0b25f1f05503'; // Chrome Touch ID
    expect(service.isAAGUIDAllowed(aaguid)).toBe(true);
  });

  it('debería rechazar AAGUID desconocido', () => {
    const aaguid = '00000000-0000-0000-0000-000000000000'; // Unknown
    expect(service.isAAGUIDAllowed(aaguid)).toBe(false);
  });
});
```

#### HKDF Derivation

```typescript
// tests/enrollment/hkdf.test.ts
import { deriveHandshakeSecret } from '@/shared/crypto/hkdf';

describe('HKDF Key Derivation', () => {
  it('debería derivar handshake_secret determinísticamente', () => {
    const credentialId = 'test-credential-id';
    const userId = 123;
    const masterSecret = 'test-master-secret';

    const secret1 = deriveHandshakeSecret(credentialId, userId, masterSecret);
    const secret2 = deriveHandshakeSecret(credentialId, userId, masterSecret);

    expect(secret1).toEqual(secret2);
    expect(secret1).toHaveLength(32);
  });

  it('debería derivar secrets diferentes para usuarios distintos', () => {
    const credentialId = 'test-credential-id';
    const masterSecret = 'test-master-secret';

    const secret1 = deriveHandshakeSecret(credentialId, 123, masterSecret);
    const secret2 = deriveHandshakeSecret(credentialId, 456, masterSecret);

    expect(secret1).not.toEqual(secret2);
  });

  it('debería derivar session_key de 32 bytes', () => {
    const sharedSecret = Buffer.from('shared-ecdh-secret');
    const sessionKey = deriveSessionKey(sharedSecret);

    expect(sessionKey).toHaveLength(32);
  });
});
```

#### ECDH Key Exchange

```typescript
// tests/enrollment/ecdh.test.ts
import { generateECDHPair, deriveSharedSecret } from '@/shared/crypto/ecdh';

describe('ECDH Key Exchange', () => {
  it('debería generar par ECDH con claves válidas', () => {
    const { privateKey, publicKey } = generateECDHPair();

    expect(privateKey).toBeDefined();
    expect(publicKey).toBeDefined();
    expect(publicKey).toHaveLength(65); // P-256 uncompressed
  });

  it('debería derivar mismo shared_secret en cliente y servidor', () => {
    // Cliente genera par
    const clientPair = generateECDHPair();

    // Servidor genera par
    const serverPair = generateECDHPair();

    // Cliente deriva con su privada + pública del servidor
    const clientShared = deriveSharedSecret(clientPair.privateKey, serverPair.publicKey);

    // Servidor deriva con su privada + pública del cliente
    const serverShared = deriveSharedSecret(serverPair.privateKey, clientPair.publicKey);

    expect(clientShared).toEqual(serverShared);
  });
});
```

---

### 1.2 Módulo Asistencia

#### TOTP Dual

```typescript
// tests/attendance/totp.test.ts
import { generateTOTPu, generateTOTPs, validateTOTP } from '@/shared/crypto/totp';

describe('TOTP Generation', () => {
  it('debería generar TOTPu de 6 dígitos', () => {
    const handshakeSecret = 'test-handshake-secret';
    const totpu = generateTOTPu(handshakeSecret);

    expect(totpu).toMatch(/^\d{6}$/);
  });

  it('debería generar TOTPs de 6 dígitos', () => {
    const sessionId = 'abc123';
    const userId = 123;
    const ronda = 1;

    const totps = generateTOTPs(sessionId, userId, ronda);

    expect(totps).toMatch(/^\d{6}$/);
  });

  it('debería validar TOTP en ventana de 3 períodos', () => {
    const secret = 'test-secret';
    const totp = generateTOTPu(secret);

    // Actual
    expect(validateTOTP(totp, secret, 0)).toBe(true);

    // Período anterior
    const prevTotp = generateTOTPu(secret, Date.now() - 30000);
    expect(validateTOTP(prevTotp, secret, -1)).toBe(true);

    // Período siguiente
    const nextTotp = generateTOTPu(secret, Date.now() + 30000);
    expect(validateTOTP(nextTotp, secret, 1)).toBe(true);
  });

  it('debería rechazar TOTP fuera de ventana', () => {
    const secret = 'test-secret';
    const oldTotp = generateTOTPu(secret, Date.now() - 120000); // -4 períodos

    expect(validateTOTP(oldTotp, secret, 0)).toBe(false);
  });
});
```

#### AES-256-GCM Encryption

```typescript
// tests/attendance/aes-gcm.test.ts
import { encryptPayload, decryptPayload } from '@/shared/crypto/aes-gcm';

describe('AES-256-GCM Encryption', () => {
  it('debería encriptar y desencriptar payload correctamente', () => {
    const sessionKey = Buffer.from('a'.repeat(32));
    const payload = {
      userId: 123,
      ronda: 1,
      TOTPs: '485926'
    };

    const encrypted = encryptPayload(payload, sessionKey);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toHaveLength(12);
    expect(encrypted.tag).toHaveLength(16);

    const decrypted = decryptPayload(encrypted, sessionKey);
    expect(decrypted).toEqual(payload);
  });

  it('debería fallar desencriptación con clave incorrecta', () => {
    const correctKey = Buffer.from('a'.repeat(32));
    const wrongKey = Buffer.from('b'.repeat(32));

    const payload = { userId: 123 };
    const encrypted = encryptPayload(payload, correctKey);

    expect(() => decryptPayload(encrypted, wrongKey))
      .toThrow('Desencriptación fallida');
  });

  it('debería detectar payload adulterado (tag inválido)', () => {
    const sessionKey = Buffer.from('a'.repeat(32));
    const payload = { userId: 123 };

    const encrypted = encryptPayload(payload, sessionKey);
    encrypted.tag = Buffer.from('tampered-tag'); // Adulterado

    expect(() => decryptPayload(encrypted, sessionKey))
      .toThrow('Tag inválido');
  });
});
```

#### Validación de Rondas

```typescript
// tests/attendance/validation.test.ts
import { validateRound } from '@/features/attendance/attendance.service';

describe('Round Validation', () => {
  it('debería validar ronda con RT correcto', async () => {
    const metadata = {
      timestamp_envio: Date.now() - 1200, // 1200ms atrás
      intentos_fallidos: 0,
      valido: true
    };

    const response = {
      timestamp_enviado: Date.now(),
      TOTPu: '192837',
      TOTPs: '485926'
    };

    const result = await validateRound(metadata, response);
    expect(result.valid).toBe(true);
    expect(result.RT).toBeGreaterThan(500);
    expect(result.RT).toBeLessThan(15000);
  });

  it('debería rechazar RT muy bajo (< 500ms)', async () => {
    const metadata = {
      timestamp_envio: Date.now() - 100, // 100ms atrás
      intentos_fallidos: 0,
      valido: true
    };

    const response = {
      timestamp_enviado: Date.now(),
      TOTPu: '192837',
      TOTPs: '485926'
    };

    const result = await validateRound(metadata, response);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('RT_TOO_LOW');
  });

  it('debería rechazar RT muy alto (> 15s)', async () => {
    const metadata = {
      timestamp_envio: Date.now() - 20000, // 20s atrás
      intentos_fallidos: 0,
      valido: true
    };

    const response = {
      timestamp_enviado: Date.now(),
      TOTPu: '192837',
      TOTPs: '485926'
    };

    const result = await validateRound(metadata, response);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('RT_TOO_HIGH');
  });
});
```

---

### 1.3 Validación Estadística

```typescript
// tests/attendance/statistics.test.ts
import { calculateCertainty } from '@/features/attendance/statistics';

describe('Certainty Threshold Calculation', () => {
  it('debería calcular 95% de certeza para tiempos humanos típicos', () => {
    const roundTimes = [1200, 1300, 1100, 1250, 1150]; // avg: 1200, std_dev: ~74
    const result = calculateCertainty(roundTimes);

    expect(result.certainty).toBeGreaterThanOrEqual(95);
    expect(result.status).toBe('PRESENTE');
  });

  it('debería detectar bot con std_dev muy bajo', () => {
    const roundTimes = [1000, 1005, 998, 1002, 1001]; // avg: 1001, std_dev: ~2
    const result = calculateCertainty(roundTimes);

    expect(result.certainty).toBeLessThan(50);
    expect(result.status).toBe('AUSENTE');
    expect(result.anomaly).toBe('BOT_DETECTED');
  });

  it('debería detectar transmisión diferida con RT muy altos', () => {
    const roundTimes = [8000, 9000, 7500, 8500, 9200]; // Muy altos
    const result = calculateCertainty(roundTimes);

    expect(result.certainty).toBeLessThan(70);
    expect(result.status).toBe('DUDOSO');
  });

  it('debería calcular estadísticas correctamente', () => {
    const roundTimes = [1000, 1500, 2000];
    const result = calculateCertainty(roundTimes);

    expect(result.avg).toBe(1500);
    expect(result.min).toBe(1000);
    expect(result.max).toBe(2000);
    expect(result.std_dev).toBeCloseTo(408.25, 2);
  });
});
```

---

## 2. Integration Tests

### 2.1 Flujo Completo de Enrolamiento

```typescript
// tests/integration/enrollment.test.ts
import request from 'supertest';
import { app } from '@/app';

describe('Enrollment Flow Integration', () => {
  it('debería enrolar dispositivo completamente', async () => {
    // Paso 1: Iniciar enrolamiento
    const startRes = await request(app)
      .post('/api/enrollment/start')
      .send({
        userId: 123,
        username: 'test.user'
      })
      .expect(200);

    expect(startRes.body.challenge).toBeDefined();
    const { challenge, options } = startRes.body;

    // Paso 2: Simular creación de credential (mock WebAuthn)
    const credential = createMockCredential(challenge);

    // Paso 3: Finalizar enrolamiento
    const finishRes = await request(app)
      .post('/api/enrollment/finish')
      .send({
        userId: 123,
        credential
      })
      .expect(200);

    expect(finishRes.body.success).toBe(true);
    expect(finishRes.body.deviceId).toBeDefined();

    // Verificar que se guardó en BD
    const device = await db.query(
      'SELECT * FROM enrollment.devices WHERE user_id = $1',
      [123]
    );

    expect(device.rows).toHaveLength(1);
    expect(device.rows[0].credential_id).toBe(credential.id);
  });
});
```

### 2.2 Flujo ECDH Login

```typescript
// tests/integration/ecdh-login.test.ts
describe('ECDH Login Integration', () => {
  it('debería establecer session_key sin transmitirla', async () => {
    // Pre-requisito: dispositivo enrolado
    await enrollDevice(123);

    // Cliente genera par ECDH
    const clientPair = generateECDHPair();

    // Cliente hace assertion WebAuthn
    const assertion = createMockAssertion();

    // Request a servidor
    const res = await request(app)
      .post('/api/enrollment/login')
      .send({
        userId: 123,
        publicKey: clientPair.publicKey.toString('base64'),
        assertion
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.serverPublicKey).toBeDefined();
    expect(res.body.TOTPu).toMatch(/^\d{6}$/);

    // Cliente deriva session_key
    const serverPublicKey = Buffer.from(res.body.serverPublicKey, 'base64');
    const clientShared = deriveSharedSecret(clientPair.privateKey, serverPublicKey);
    const clientSessionKey = deriveSessionKey(clientShared);

    // Verificar que servidor tiene mismo session_key en Valkey
    const serverSessionKey = await valkey.getSessionKey(123);
    expect(clientSessionKey).toEqual(serverSessionKey);
  });
});
```

### 2.3 Flujo N Rondas Completo

```typescript
// tests/integration/n-rounds.test.ts
describe('N Rounds Attendance Integration', () => {
  const N = 3;

  it('debería validar N rondas y determinar PRESENTE', async () => {
    const userId = 123;
    const sessionId = 'test-session';

    // Enrolar y login
    await enrollDevice(userId);
    const { sessionKey, TOTPu } = await performECDHLogin(userId);

    // Registrarse en sesión
    const registerRes = await request(app)
      .post('/api/attendance/register')
      .send({ userId, sessionId })
      .expect(200);

    expect(registerRes.body.success).toBe(true);

    // Simular N rondas
    for (let ronda = 1; ronda <= N; ronda++) {
      // Obtener QR de cola de proyección
      const qrPayload = await valkey.getProjectionQueue(sessionId);
      expect(qrPayload).toHaveLength(1);

      // Desencriptar payload
      const decrypted = decryptPayload(
        JSON.parse(qrPayload[0]),
        sessionKey
      );

      expect(decrypted.userId).toBe(userId);
      expect(decrypted.ronda).toBe(ronda);

      // Crear respuesta
      const response = {
        ...decrypted,
        timestamp_enviado: Date.now(),
        TOTPu,
        metadatos: {}
      };

      const encryptedResponse = encryptPayload(response, sessionKey);

      // Enviar validación
      const validateRes = await request(app)
        .post('/api/attendance/validate')
        .send({
          userId,
          response: encryptedResponse
        })
        .expect(200);

      if (ronda < N) {
        expect(validateRes.body.success).toBe(true);
        expect(validateRes.body.ronda).toBe(ronda + 1);
      } else {
        // Última ronda
        expect(validateRes.body.success).toBe(true);
        expect(validateRes.body.status).toBe('PRESENTE');
        expect(validateRes.body.certainty).toBeGreaterThanOrEqual(70);
      }
    }

    // Verificar registro en BD
    const record = await db.query(
      'SELECT * FROM attendance.records WHERE user_id = $1 AND session_id = $2',
      [userId, sessionId]
    );

    expect(record.rows).toHaveLength(1);
    expect(record.rows[0].status).toBe('PRESENTE');
  });
});
```

---

## 3. End-to-End Tests

### 3.1 Configuración Playwright

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:9500',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
```

### 3.2 Test de Enrolamiento

```typescript
// tests/e2e/enrollment.spec.ts
import { test, expect } from '@playwright/test';

test('Usuario puede enrolar dispositivo', async ({ page }) => {
  // Login tradicional
  await page.goto('/login.php');
  await page.fill('#username', 'test.user');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');

  // Ir a enrolamiento
  await page.goto('/alumno/enrolamiento.php');
  await page.click('#btn-enrolar');

  // Simular WebAuthn (requiere mock en browser)
  await page.evaluate(() => {
    // Mock navigator.credentials.create()
    // Esto requiere configuración especial en Playwright
  });

  // Verificar éxito
  await expect(page.locator('.success-message')).toContainText('Dispositivo enrolado');
});
```

---

## 4. Performance Tests

### 4.1 Load Testing (Artillery)

```yaml
# tests/load/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 usuarios/seg
      name: "Warm up"
    - duration: 120
      arrivalRate: 50  # 50 usuarios/seg
      name: "Load test"
    - duration: 60
      arrivalRate: 200  # 200 usuarios/seg
      name: "Stress test"

scenarios:
  - name: "Registro y N rondas"
    flow:
      - post:
          url: "/api/attendance/register"
          json:
            userId: "{{ $randomNumber(1, 1000) }}"
            sessionId: "load-test-session"
      - loop:
          - post:
              url: "/api/attendance/validate"
              json:
                userId: "{{ userId }}"
                response: "{{ encryptedResponse }}"
          count: 3  # N rondas
```

**Comando:**

```bash
artillery run tests/load/load-test.yml
```

### 4.2 Stress Testing

```typescript
// tests/stress/concurrent-validations.test.ts
describe('Concurrent Validations Stress', () => {
  it('debería manejar 200 validaciones concurrentes', async () => {
    const promises = [];

    for (let i = 1; i <= 200; i++) {
      const promise = request(app)
        .post('/api/attendance/validate')
        .send({
          userId: i,
          response: createMockResponse()
        });

      promises.push(promise);
    }

    const results = await Promise.all(promises);

    // Verificar que todas respondieron
    expect(results).toHaveLength(200);

    // Verificar que >95% fueron exitosas
    const successful = results.filter(r => r.status === 200);
    expect(successful.length).toBeGreaterThan(190);
  });
});
```

---

## 5. Security Tests

### 5.1 SQL Injection

```typescript
describe('SQL Injection Prevention', () => {
  it('debería prevenir SQL injection en userId', async () => {
    const maliciousUserId = "123; DROP TABLE enrollment.devices; --";

    const res = await request(app)
      .post('/api/attendance/register')
      .send({
        userId: maliciousUserId,
        sessionId: 'test'
      })
      .expect(400);

    expect(res.body.error).toBe('INVALID_INPUT');

    // Verificar que tabla no fue eliminada
    const result = await db.query('SELECT COUNT(*) FROM enrollment.devices');
    expect(result.rows[0].count).toBeGreaterThan(0);
  });
});
```

### 5.2 Replay Attack

```typescript
describe('Replay Attack Prevention', () => {
  it('debería rechazar payload QR usado previamente', async () => {
    const { sessionKey, response } = await captureValidQR();

    // Primera validación: éxito
    const firstRes = await request(app)
      .post('/api/attendance/validate')
      .send({ userId: 123, response })
      .expect(200);

    expect(firstRes.body.success).toBe(true);

    // Segunda validación (replay): fallo
    const secondRes = await request(app)
      .post('/api/attendance/validate')
      .send({ userId: 123, response })
      .expect(400);

    expect(secondRes.body.error).toBe('QR_ALREADY_USED');
  });
});
```

---

## 6. CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

      valkey:
        image: valkey/valkey:7-alpine
        options: >-
          --health-cmd "valkey-cli ping"
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          VALKEY_HOST: localhost
          VALKEY_PORT: 6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## 7. Test Helpers y Mocks

### Mock WebAuthn

```typescript
// tests/helpers/webauthn-mock.ts
export function createMockCredential(challenge: Buffer) {
  return {
    id: 'mock-credential-id',
    rawId: Buffer.from('mock-raw-id'),
    response: {
      attestationObject: createMockAttestationObject(challenge),
      clientDataJSON: Buffer.from(JSON.stringify({
        type: 'webauthn.create',
        challenge: challenge.toString('base64'),
        origin: 'http://localhost:9500'
      }))
    },
    type: 'public-key'
  };
}
```

### Mock Database

```typescript
// tests/helpers/db-mock.ts
import { Pool } from 'pg';

export async function setupTestDB() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'asistencia_test',
    user: 'test',
    password: 'test'
  });

  // Crear schemas y tablas
  await pool.query('CREATE SCHEMA IF NOT EXISTS enrollment');
  await pool.query('CREATE SCHEMA IF NOT EXISTS attendance');

  // Insertar datos de prueba
  await seedTestData(pool);

  return pool;
}
```

---

## 8. Reporting

### Coverage Report

```bash
npm run test:coverage
```

**Output esperado:**

```text
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   82.45 |    78.32 |   85.67 |   81.23 |
 enrollment/        |   85.23 |    82.14 |   88.45 |   84.12 |
 attendance/        |   79.67 |    74.50 |   82.89 |   78.34 |
 shared/crypto/     |   91.34 |    88.76 |   94.12 |   90.23 |
--------------------|---------|----------|---------|---------|
```

---

## Próximos Pasos

1. Configurar Jest para Node service
2. Escribir tests unitarios de FIDO2
3. Implementar mocks de WebAuthn
4. Configurar CI/CD pipeline
5. Alcanzar 80% de cobertura en Fase 1

---

**Versión:** 1.0
**Fecha:** 2025-11-02
**Estado:** Especificación Técnica
