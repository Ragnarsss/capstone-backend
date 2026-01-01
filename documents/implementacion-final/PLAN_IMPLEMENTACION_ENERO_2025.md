# Plan de Implementación y Validación del Sistema de Asistencia

**Proyecto:** Migración y Despliegue del Nuevo Sistema de Asistencia Hawaii  
**Período:** 1-12 de enero de 2025  
**Modalidad:** Tiempo completo (9:00-17:00)  
**Metodología:** Dos sprints de 5 días hábiles

---

## 1. CONTEXTO Y ALCANCE

### 1.1 Objetivo General

Completar la integración y despliegue del nuevo sistema de asistencia basado en códigos QR criptográficos, validando su correcto funcionamiento en un entorno aislado del sistema legacy Hawaii, cumpliendo con siete requisitos funcionales críticos.

### 1.2 Requisitos Funcionales a Validar

1. Sistema Hawaii operando en versión aislada propia
2. Disponibilidad de opción "marcar asistencia" para estudiantes
3. Capacidad de profesores para "abrir" sesión de asistencia
4. Registro exitoso de asistencia por parte de estudiantes mediante nuevo proceso
5. Preservación del flujo de encuestas post-asistencia
6. Registro correcto en pantalla general de asistencia (día y bloque)
7. Validación de duración configurable del código de reserva

### 1.3 Matriz de Trazabilidad Requisitos → Implementación → Validación

| Req   | Descripción         | Componentes Clave                        | Tests Unitarios   | Tests Integración  | Tests E2E             | Validación Manual | Evidencia Requerida                |
| ----- | ------------------- | ---------------------------------------- | ----------------- | ------------------ | --------------------- | ----------------- | ---------------------------------- |
| **1** | Sistema aislado     | Apache config, compose.yaml, rutas       | N/A               | Config tests       | Health checks         | Checklist día 6   | Screenshots + logs sin errores 500 |
| **2** | Opción estudiante   | horario.php línea ~950                   | PHP session tests | Modal opening      | E2E reader flow       | Checklist día 6   | Screenshot botón + modal           |
| **3** | Opción profesor     | main_curso.php, can_tomar_asistencia()   | PHP auth tests    | Modal opening      | E2E host flow         | Checklist día 6   | Screenshot botón + QR proyectado   |
| **4** | Registro asistencia | AttendanceService, TOTP validation       | 20+ backend tests | DB insertion tests | E2E scan + register   | Checklist día 6   | Query SQL mostrando registro       |
| **5** | Encuestas           | Redirect a asist0.php, comentarios_clase | PHP form tests    | Redirect tests     | E2E complete flow     | Checklist día 7   | Query SQL en comentarios_clase     |
| **6** | Pantalla general    | asist_lista.php, alumno_asistencia       | Query tests       | Display tests      | Manual verification   | Checklist día 7   | Screenshot pantalla + query        |
| **7** | Duración QR         | TTL validation, fechahora_termino        | TOTP expiry tests | Expiry integration | Automated expiry test | Checklist día 7   | Test automatizado + logs           |

**Totales:** 115 tests PHP + 206 tests Node + 3 tests E2E + 7 validaciones manuales

### 1.4 Stack Tecnológico

**Backend:**

- Node.js (Fastify) - Servicio principal de asistencia
- PHP 7.4+ - Sistema legacy Hawaii y módulo de integración
- PostgreSQL - Base de datos relacional
- Valkey/Redis - Cache y gestión de sesiones

**Frontend:**

- Vite + TypeScript - Interfaz moderna de asistencia
- WebSocket - Comunicación tiempo real para proyección QR

**Infraestructura:**

- Podman/Docker - Contenedores
- Apache 2.4 - Servidor web y proxy reverso
- Cloudflare Tunnel - Acceso HTTPS externo

**CI/CD:**

- GitHub Actions - Automatización
- Vitest - Framework de testing
- PHPUnit - Testing PHP (a implementar)

### 1.5 Plan de Validación por Requisito

#### Requisito 1: Sistema Aislado

**Criterios de Aceptación SMART:**

- [ ] Hawaii legacy en `/` responde HTTP 200 en < 2 segundos
- [ ] Módulo asistencia en `/asistencia/` responde HTTP 200 en < 1 segundo
- [ ] PHP integration en `/asistencia-node-integration/api/token` retorna JWT válido
- [ ] 0 errores 500 en logs de Apache durante 1 hora de pruebas
- [ ] 0 conflictos de esquema en PostgreSQL (constraints verificados)

**Casos de Prueba:**

1. Acceder a `http://localhost/` → Mostrar Hawaii legacy
2. Acceder a `http://localhost/asistencia/health` → `{"status":"ok"}`
3. Consultar tabla `curso` desde Node.js → Retornar datos
4. Insertar en `alumno_asistencia` desde Node.js → Sin errores FK
5. Logs de Apache: `grep "500" /var/log/httpd/error_log` → Sin resultados

**Evidencias:**

- Screenshot de Hawaii legacy funcionando
- Screenshot de health check del módulo
- Query SQL exitosa desde Node.js
- Archivo de logs sin errores 500

#### Requisito 2: Opción Estudiante

**Criterios de Aceptación SMART:**

- [ ] Botón visible para usuarios con `$_SESSION['id'] == -1`
- [ ] Botón NO visible para profesores (`$_SESSION['id'] != -1`)
- [ ] Clic abre modal en < 500ms
- [ ] URL del iframe contiene `token=` con JWT válido (3 partes separadas por `.`)
- [ ] Modal tiene título "Tomar Asistencia"

**Casos de Prueba:**

1. Login como alumno (RUT 186875052) → Verificar botón visible
2. Login como profesor → Verificar botón NO visible
3. Clic en botón → Modal abierto en < 500ms
4. Inspeccionar URL iframe → `token=eyJhbGc...` (JWT válido)
5. Verificar título modal → "Tomar Asistencia"

**Evidencias:**

- Screenshot de horario.php con botón visible (alumno)
- Screenshot de horario.php sin botón (profesor)
- Screenshot de modal abierto con URL visible
- Video de interacción completa

#### Requisito 3: Opción Profesor

**Criterios de Aceptación SMART:**

- [ ] Botón visible en main_curso.php para profesores autorizados
- [ ] Función `can_tomar_asistencia($idCurso, $idSemestre)` retorna true
- [ ] Clic abre modal en < 500ms
- [ ] QR dinámico visible y cambia cada 10 segundos (±1 seg)
- [ ] WebSocket conectado (inspeccionar console: "WebSocket connected")

**Casos de Prueba:**

1. Login como profesor asignado al curso → Botón visible
2. Login como profesor NO asignado → Botón NO visible
3. Clic en botón → Modal abierto con QR
4. Esperar 10 segundos → QR cambia (payload diferente)
5. Inspeccionar console → WebSocket activo sin errores
6. Cerrar modal → WebSocket desconectado

**Evidencias:**

- Screenshot de main_curso.php con botón
- Video de QR cambiando cada 10 segundos
- Screenshot de console mostrando WebSocket activo
- Registro de sesión en `asistencia_curso` con código correcto

#### Requisito 4: Registro Exitoso

**Criterios de Aceptación SMART:**

- [ ] Escaneo de QR válido registra asistencia en < 2 segundos
- [ ] Registro en `alumno_asistencia` con estado = 1 (presente)
- [ ] Timestamp de `hora_marca` dentro de ±5 segundos de hora actual
- [ ] Validación TOTP exitosa (código no expirado, no reutilizado)
- [ ] Restricción IP validada correctamente (si aplica)
- [ ] Respuesta HTTP 201 con mensaje de éxito

**Casos de Prueba:**

1. Profesor abre QR → Alumno escanea dentro de 5 min → Registro exitoso
2. Alumno intenta escanear QR expirado (>5 min) → Error 410
3. Alumno intenta escanear mismo QR 2 veces → Error "Ya registrado"
4. Alumno fuera de red UCN (si requerido) → Error 403
5. Verificar en BD: `SELECT * FROM alumno_asistencia WHERE rut='186875052'`

**Evidencias:**

- Query SQL mostrando registro:
  ```sql
  SELECT aa.*, ac.fecha, ac.bloque, ac.codigo
  FROM alumno_asistencia aa
  JOIN asistencia_curso ac ON aa.curso = ac.curso
  WHERE aa.rut = '186875052'
  AND aa.fecha = 20250108
  ORDER BY aa.hora_marca DESC
  LIMIT 1;
  ```
- Screenshot de mensaje de éxito en UI
- Logs de backend mostrando validación TOTP

#### Requisito 5: Encuestas

**Criterios de Aceptación SMART:**

- [ ] Tras registro exitoso, redirect a `asist0.php?c=<codigo>` en < 1 segundo
- [ ] Formulario de encuesta correcto según tipo (2-7)
- [ ] Estudiante puede completar sin re-autenticarse
- [ ] Submit guarda en `comentarios_clase` en < 2 segundos
- [ ] Campos obligatorios validados antes de guardar

**Casos de Prueba:**

1. Tipo 2: Verificar campos (nota, objetivos, puntualidad, comentario)
2. Tipo 3: Verificar solo nota y comentario
3. Tipo 4: One minute paper básico
4. Tipo 5: One minute paper con positivo/negativo
5. Completar encuesta → Guardar → Verificar en BD

**Evidencias:**

- Screenshot de cada tipo de encuesta
- Query SQL mostrando guardado:
  ```sql
  SELECT * FROM comentarios_clase
  WHERE reserva_id = (SELECT id FROM asistencia_curso WHERE codigo = 'CVYAFO')
  ORDER BY timestamp DESC
  LIMIT 1;
  ```
- Video de flujo completo: escaneo → registro → encuesta → guardado

#### Requisito 6: Pantalla General

**Criterios de Aceptación SMART:**

- [ ] Asistencia aparece en `asist_lista.php` en < 5 segundos tras registro
- [ ] Fecha correcta (formato 20250108)
- [ ] Bloque correcto (1-8 según tabla `bloque`)
- [ ] Estado = "Presente" (valor 1 en BD)
- [ ] Sin duplicados para mismo alumno/fecha/bloque
- [ ] Relación correcta con `asistencia_curso` via código

**Casos de Prueba:**

1. Acceder a `asist_lista.php?c=429&s=5`
2. Filtrar por fecha 2025-01-08
3. Buscar RUT 186875052
4. Verificar aparece en bloque correcto
5. Verificar estado "Presente"
6. Refrescar página → Sigue apareciendo (persistencia)

**Evidencias:**

- Screenshot de asist_lista.php mostrando registro
- Query SQL verificando relación:
  ```sql
  SELECT a.nombre, aa.rut, aa.fecha, aa.bloque, aa.estado, ac.codigo
  FROM alumno_asistencia aa
  JOIN alumno a ON aa.rut = a.rut
  JOIN asistencia_curso ac ON aa.curso = ac.curso AND aa.fecha = ac.fecha AND aa.bloque = ac.bloque
  WHERE aa.rut = '186875052' AND aa.fecha = 20250108;
  ```
- Verificación de no duplicados:
  ```sql
  SELECT rut, fecha, bloque, COUNT(*)
  FROM alumno_asistencia
  GROUP BY rut, fecha, bloque
  HAVING COUNT(*) > 1;
  -- Debe retornar 0 filas
  ```

#### Requisito 7: Duración Configurable

**Criterios de Aceptación SMART:**

- [ ] TTL por defecto = 5 minutos (300 segundos)
- [ ] TTL configurable via BD (`fechahora_termino`)
- [ ] Validación backend: `NOW() < fechahora_termino`
- [ ] Intento post-expiración retorna HTTP 410
- [ ] Mensaje de error: "Sesión de asistencia expirada"
- [ ] Test automatizado valida expiración

**Casos de Prueba:**

1. Crear reserva con TTL 5 min → Marcar dentro de 5 min → Éxito
2. Crear reserva con TTL 5 min → Esperar 6 min → Error 410
3. Crear reserva con TTL 10 min → Marcar a los 8 min → Éxito
4. Verificar cálculo: `fechahora_termino - fechahora_inicio = 5 minutes`
5. Test automatizado con TTL 2 segundos

**Test Automatizado:**

```typescript
test("Reserva expira según TTL configurado", async () => {
  const session = await createSession({ ttl: 2 });
  await sleep(1000);
  const result1 = await markAttendance(session.code);
  expect(result1.status).toBe(201);

  await sleep(2000);
  const result2 = await markAttendance(session.code);
  expect(result2.status).toBe(410);
  expect(result2.data.error).toContain("expirada");
});
```

**Evidencias:**

- Test automatizado pasando
- Query SQL mostrando TTL:
  ```sql
  SELECT
    id, codigo, fechahora_inicio, fechahora_termino,
    EXTRACT(EPOCH FROM (fechahora_termino - fechahora_inicio)) as ttl_seconds
  FROM asistencia_curso WHERE id = 12345;
  ```
- Logs de backend mostrando rechazo por expiración
- Screenshot de mensaje de error en UI

### 1.6 Documentación de Evidencias

**Estructura de Carpeta:**

```
evidencias/
├── req-01-sistema-aislado/
│   ├── screenshot-hawaii-legacy.png
│   ├── screenshot-health-check.png
│   ├── logs-apache-sin-errores.txt
│   └── query-sql-esquema.sql
├── req-02-opcion-estudiante/
│   ├── screenshot-boton-visible-alumno.png
│   ├── screenshot-boton-invisible-profesor.png
│   ├── screenshot-modal-abierto.png
│   └── video-interaccion-completa.mp4
├── req-03-opcion-profesor/
│   ├── screenshot-boton-profesor.png
│   ├── video-qr-dinamico.mp4
│   ├── screenshot-console-websocket.png
│   └── query-sql-sesion-creada.sql
├── req-04-registro-exitoso/
│   ├── query-sql-registro.sql
│   ├── screenshot-mensaje-exito.png
│   └── logs-validacion-totp.txt
├── req-05-encuestas/
│   ├── screenshot-encuesta-tipo2.png
│   ├── screenshot-encuesta-tipo3.png
│   ├── query-sql-comentarios.sql
│   └── video-flujo-completo.mp4
├── req-06-pantalla-general/
│   ├── screenshot-asist-lista.png
│   ├── query-sql-relacion.sql
│   └── query-sql-sin-duplicados.sql
├── req-07-duracion-qr/
│   ├── test-automatizado-resultado.txt
│   ├── query-sql-ttl.sql
│   ├── logs-rechazo-expiracion.txt
│   └── screenshot-error-expirado.png
└── resumen-validacion.md
```

**resumen-validacion.md:**

```markdown
# Resumen de Validación de Requisitos

Fecha: [FECHA]
Ambiente: Staging (mantochrisal.cl)
Validador: [NOMBRE]

## Estado General

| Requisito            | Estado  | Tests Pasados | Evidencias | Observaciones      |
| -------------------- | ------- | ------------- | ---------- | ------------------ |
| 1. Sistema Aislado   | ✅ PASS | 5/5           | 4 archivos | Sin errores 500    |
| 2. Opción Estudiante | ✅ PASS | 5/5           | 4 archivos | Modal < 500ms      |
| 3. Opción Profesor   | ✅ PASS | 6/6           | 4 archivos | QR cambia c/10s    |
| 4. Registro Exitoso  | ✅ PASS | 5/5           | 3 archivos | Registro < 2s      |
| 5. Encuestas         | ✅ PASS | 5/5           | 4 archivos | Todos los tipos OK |
| 6. Pantalla General  | ✅ PASS | 6/6           | 3 archivos | Sin duplicados     |
| 7. Duración QR       | ✅ PASS | 5/5           | 4 archivos | Test automatizado  |

**TOTAL: 7/7 requisitos APROBADOS**
```

---

## 2. DIAGNÓSTICO TÉCNICO

### 2.1 Estado Actual del Sistema

#### Componentes Implementados

**Frontend:**

- Interfaz de lector QR (alumno): `/asistencia/features/qr-reader/index.html`
- Interfaz de host QR (profesor): `/asistencia/features/qr-host/index.html`
- Sistema de autenticación vía postMessage y JWT
- Integración mediante iframes en horario.php

**Backend Node.js:**

- Arquitectura modular DDD completa (6 módulos)
- Sistema de autenticación JWT bidireccional
- Generación de QR con TOTP criptográfico
- WebSocket para proyección en tiempo real
- 206+ tests unitarios e integración implementados

**Backend PHP:**

- Módulo `asistencia-node-integration` completo
  - AuthenticationService con generación JWT
  - Biblioteca JWT sin dependencias
  - Adaptadores para sesiones legacy
  - API REST para consulta de datos
  - Vistas de modal integradas

**Endpoint Legacy:**

- `api_get_asistencia_token.php` - Genera JWT manualmente (a deprecar)

#### Estado de Testing

| Componente        | Tests | Estado          | Cobertura |
| ----------------- | ----- | --------------- | --------- |
| Auth (Node)       | 58    | Aprobados       | 95%       |
| Attendance (Node) | 7     | Aprobados       | 60%       |
| Session (Node)    | 15    | Aprobados       | 70%       |
| Enrollment (Node) | 106   | Aprobados       | 85%       |
| Access (Node)     | 9     | Aprobados       | 80%       |
| Shared (Node)     | 11    | Aprobados       | -         |
| **PHP Service**   | 0     | Sin implementar | 0%        |

**Total Node.js:** 206 tests aprobados

### 2.2 Gaps Identificados

#### Críticos (Bloquean requisitos funcionales)

1. **Arquitectura Incorrecta: Backend en Proyecto Vite**

   - Estado: Backend Node.js y Frontend mezclados en mismo proyecto
   - Impacto:
     - Vite no está diseñado para bundlear backend
     - Confusión entre concerns de frontend y backend
     - Dificulta despliegue independiente
     - Complejidad innecesaria en build process
   - Requisito afectado: 1 (sistema aislado), mantenibilidad general
   - **Solución:** Separar en dos proyectos independientes

2. **Endpoint de Token no Migrado**

   - Estado: `api_get_asistencia_token.php` aún en uso
   - Impacto: No se utiliza el módulo PHP de integración
   - Requisito afectado: Todos (base de autenticación)

3. **Sin Testing PHP**

   - Estado: 0 tests para el módulo de integración
   - Impacto: No hay validación de generación JWT en PHP
   - Requisito afectado: 3, 4 (autenticación de profesor y alumno)

4. **Configuración de Despliegue Incompleta**

   - Estado: Variables de entorno no documentadas para producción
   - Impacto: Despliegue manual propenso a errores
   - Requisito afectado: 1 (sistema aislado)

5. **Sin Validación End-to-End**
   - Estado: No hay tests que validen flujo completo profesor→alumno
   - Impacto: No se garantiza funcionamiento integrado
   - Requisito afectado: 3, 4, 5, 6, 7

#### Importantes (Mejoran calidad y mantenibilidad)

6. **CI/CD Inexistente**

   - Estado: No hay pipeline automatizado
   - Impacto: Verificación manual en cada cambio
   - Requisito afectado: Ninguno directamente

7. **Documentación de Despliegue Fragmentada**

   - Estado: Información dispersa en múltiples archivos
   - Impacto: Complejidad en replicar entorno
   - Requisito afectado: 1

8. **Monitoreo de Reservas**
   - Estado: No hay validación automática de duración de QR
   - Impacto: Requisito 7 no verificable sistemáticamente
   - Requisito afectado: 7

### 2.3 Solución: Separación de Proyectos Backend/Frontend

#### Problema Actual

El proyecto `node-service` actual mezcla backend (Fastify + WebSocket) y frontend (Vite + TypeScript) en un mismo repositorio con configuración compartida:

```
node-service/
├── src/
│   ├── backend/        # Backend Fastify
│   ├── frontend/       # Frontend Vite
│   └── shared/         # Compartido (¿backend o frontend?)
├── vite.config.ts      # Configuración Vite (solo frontend)
├── tsconfig.json       # TypeScript (backend + frontend)
└── package.json        # Dependencias mezcladas
```

**Problemas:**

- Vite bundlea frontend pero el backend se compila con `tsc`
- Scripts confusos: `npm run dev` ejecuta ambos con `concurrently`
- Dependencias mezcladas (Fastify + Vite en mismo `package.json`)
- Testing ambiguo (Vitest para ambos)
- Despliegue complejo (dos artefactos en un build)

#### Estructura Propuesta

**Separar en dos proyectos independientes:**

```
asistencia/
├── backend/                    # Proyecto Node.js/Fastify puro
│   ├── src/
│   │   ├── modules/           # Módulos DDD (auth, attendance, etc)
│   │   ├── shared/            # Infraestructura (DB, cache)
│   │   ├── middleware/        # Middlewares Fastify
│   │   ├── app.ts             # Composición Fastify
│   │   └── index.ts           # Entry point
│   ├── tests/                 # Tests unitarios e integración
│   ├── tsconfig.json          # TypeScript backend
│   ├── package.json           # Solo deps backend
│   └── Containerfile          # Imagen backend
│
├── frontend/                   # Proyecto Vite puro
│   ├── src/
│   │   ├── features/          # QR reader, QR host
│   │   ├── shared/            # Auth, WebSocket, utils
│   │   └── types/             # TypeScript types
│   ├── public/                # Assets estáticos
│   ├── index.html             # Entry points
│   ├── vite.config.ts         # Configuración Vite
│   ├── tsconfig.json          # TypeScript frontend
│   ├── package.json           # Solo deps frontend
│   └── Containerfile          # Imagen frontend (nginx)
│
├── php-service/               # Servicio PHP (sin cambios)
└── compose.yaml               # Orquestación de 3 servicios
```

#### Beneficios de la Separación

1. **Claridad de Responsabilidades:**

   - Backend: API REST + WebSocket + lógica de negocio
   - Frontend: UI + interacción usuario + escaneo QR

2. **Build Independiente:**

   - Backend: `tsc` compila a `dist/` → imagen Node.js
   - Frontend: `vite build` compila a `dist/` → imagen Nginx

3. **Deploy Independiente:**

   - Escalar backend y frontend por separado
   - Actualizar uno sin afectar al otro
   - CDN para frontend (assets estáticos)

4. **Testing Simplificado:**

   - Backend: Vitest para lógica de negocio
   - Frontend: Vitest + Playwright para UI
   - Sin confusión de contextos

5. **Desarrollo Paralelo:**
   - Equipos frontend/backend pueden trabajar independientemente
   - Contratos de API claros (OpenAPI/Swagger)

#### Plan de Migración

**Día 0.5 (Agregado al inicio del Sprint 1):**

1. **Crear estructura de directorios** (1 hora)

   ```bash
   mkdir -p asistencia-backend asistencia-frontend
   ```

2. **Mover código backend** (1.5 horas)

   - Copiar `src/backend/` → `asistencia-backend/src/modules/`
   - Copiar `src/shared/infrastructure/` → `asistencia-backend/src/shared/`
   - Copiar `src/middleware/` → `asistencia-backend/src/middleware/`
   - Copiar `src/app.ts` y `src/index.ts`
   - Extraer deps backend de `package.json`
   - Crear `tsconfig.json` específico backend

3. **Mover código frontend** (1.5 horas)

   - Copiar `src/frontend/` → `asistencia-frontend/src/`
   - Copiar `vite.config.ts`
   - Extraer deps frontend de `package.json`
   - Crear `tsconfig.json` específico frontend
   - Actualizar paths de imports

4. **Actualizar configuración** (1 hora)

   - Crear `Containerfile` para backend (Node.js base)
   - Crear `Containerfile` para frontend (nginx base)
   - Actualizar `compose.yaml` con 3 servicios:
     - `backend`: puerto 3000
     - `frontend`: puerto 80 (nginx)
     - `php-service`: puerto 9500
   - Configurar proxy en nginx para servir frontend

5. **Actualizar scripts CI/CD** (1 hora)

   - Separar workflows: `.github/workflows/backend.yml` y `frontend.yml`
   - Tests backend y frontend independientes
   - Builds separados

6. **Validar funcionamiento** (1 hora)

   ```bash
   # Backend
   cd asistencia-backend
   npm install
   npm run dev
   curl http://localhost:3000/asistencia/health

   # Frontend
   cd asistencia-frontend
   npm install
   npm run dev
   # Abrir http://localhost:5173

   # Integración
   podman-compose up -d
   curl http://localhost/asistencia/features/qr-reader/
   ```

**Total tiempo:** 7 horas (agregadas al día 1)

#### Configuración Post-Separación

**Backend `package.json`:**

```json
{
  "name": "asistencia-backend",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "4.28.1",
    "@fastify/websocket": "10.0.1",
    "ioredis": "5.4.1",
    "pg": "^8.13.1",
    "jsonwebtoken": "^9.0.2",
    "otplib": "^12.0.1",
    "qrcode": "^1.5.3"
  }
}
```

**Frontend `package.json`:**

```json
{
  "name": "asistencia-frontend",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@zxing/browser": "^0.1.5",
    "@zxing/library": "^0.21.0"
  },
  "devDependencies": {
    "vite": "^6.0.1",
    "@playwright/test": "^1.40.0"
  }
}
```

**Frontend Containerfile (nginx):**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 2.4 Estado Deseado

#### Arquitectura Objetivo

```
┌─────────────────────────────────────────────────────────────┐
│                      SISTEMA HAWAII LEGACY                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ horario.php                                            │ │
│  │  - Botón "Tomar Asistencia" (estudiante)              │ │
│  │  - Botón "Abrir Asistencia" (profesor)                │ │
│  │  - Botón "Nuevo Sistema de Asistencia" (profesor)     │ │
│  └──────────────┬─────────────────────────────────────────┘ │
│                 │ Solicita JWT                               │
│                 ▼                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PHP Integration Service                                │ │
│  │  /asistencia-node-integration/api/token                │ │
│  │  - AuthenticationService.generateToken()               │ │
│  │  - JWT.encode() con secret compartido                  │ │
│  │  - LegacySessionAdapter (sesiones PHP)                 │ │
│  └──────────────┬─────────────────────────────────────────┘ │
└─────────────────┼─────────────────────────────────────────────┘
                  │ Retorna JWT
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND ASISTENCIA (Vite + TS)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Iframe en Hawaii                                        │ │
│  │  - qr-reader (alumno): Escanea QR + envía asistencia  │ │
│  │  - qr-host (profesor): Proyecta QR dinámico            │ │
│  │  - Autenticación via postMessage + JWT                 │ │
│  └──────────────┬─────────────────────────────────────────┘ │
└─────────────────┼─────────────────────────────────────────────┘
                  │ HTTP + WebSocket
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND NODE.JS (Fastify)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Módulos DDD                                             │ │
│  │  - auth: Verifica JWT, extrae userId                   │ │
│  │  - qr-projection: Genera QR TOTP + WebSocket           │ │
│  │  - attendance: Valida y registra asistencia            │ │
│  │  - session: Gestiona sesiones de asistencia            │ │
│  │  - enrollment: FIDO2 (futuro)                           │ │
│  └─────────┬──────────────────────────────────────────────┘ │
│            │                                                  │
│            ├──► PostgreSQL (asistencia_curso, alumno_*)      │
│            └──► Valkey (sesiones activas, pools QR)          │
└─────────────────────────────────────────────────────────────┘
```

#### Flujos Funcionales Validados

**Flujo Profesor (Requisitos 1, 3, 6, 7):**

1. Profesor accede a `horario.php` autenticado
2. Clic en "Nuevo Sistema de Asistencia"
3. Sistema legacy solicita JWT a `/asistencia-node-integration/api/token`
4. Se abre iframe con `qr-host` + JWT en URL
5. Frontend valida JWT y establece WebSocket
6. Backend genera sesión de asistencia en PostgreSQL
7. QR dinámico se proyecta via WebSocket cada 10 segundos
8. Reserva expira automáticamente según configuración (5 min default)
9. Asistencia visible en pantalla general con día/bloque correctos

**Flujo Estudiante (Requisitos 2, 4, 5):**

1. Estudiante accede a `horario.php` autenticado
2. Clic en "Tomar Asistencia"
3. Sistema legacy solicita JWT a `/asistencia-node-integration/api/token`
4. Se abre iframe con `qr-reader` + JWT en URL
5. Frontend escanea QR proyectado por profesor
6. Backend valida TOTP, sesión activa, restricciones IP
7. Asistencia registrada en `alumno_asistencia`
8. Estudiante redirigido a encuesta según tipo de asistencia
9. Respuestas guardadas en `comentarios_clase`

#### Criterios de Aceptación Técnicos

1. **Sistema Aislado:**

   - Hawaii legacy funciona sin modificaciones en rutas críticas
   - Módulo de asistencia accesible via subdirectorio `/asistencia`
   - Base de datos compartida con esquema independiente

2. **Autenticación:**

   - JWT válido por 5 minutos
   - Secret compartido idéntico en PHP y Node.js
   - userId consistente entre servicios

3. **Registro de Asistencia:**

   - Inserción en `alumno_asistencia` con estado correcto (1=presente)
   - Relación con `asistencia_curso` mediante código de reserva
   - Timestamp exacto de marca

4. **Encuestas:**

   - Redirección a `asist0.php` con parámetros correctos
   - Preservación de tipo de encuesta (tipos 2-7)
   - Persistencia en `comentarios_clase`

5. **Duración de Reserva:**

   - TTL configurable en base de datos (`fechahora_termino`)
   - Validación en backend antes de aceptar asistencia
   - Limpieza automática de reservas expiradas

6. **Testing:**

   - 100% de tests unitarios PHP del módulo de integración
   - Tests de integración para flujos críticos
   - Cobertura mínima 80% en componentes nuevos

7. **CI/CD:**
   - Pipeline que ejecuta tests en cada push
   - Validación de build exitoso antes de merge
   - Reporte de cobertura automático

---

## 3. PLAN DE TRABAJO

### 3.1 Estructura de Sprints

**Sprint 1:** Fundamentos y Testing (1-7 enero)  
**Sprint 2:** Integración y Despliegue (8-12 enero)

### 3.2 Metodología de Trabajo

**Horario:** 9:00-17:00 (8 horas efectivas)

- 9:00-9:30: Planificación diaria y revisión de blockers
- 9:30-13:00: Sesión de desarrollo matutina
- 13:00-14:00: Pausa almuerzo
- 14:00-17:00: Sesión de desarrollo vespertina
- 16:45-17:00: Retrospectiva diaria y commit de avances

**Principios:**

- Commits atómicos al finalizar cada tarea
- Tests antes de implementación (TDD cuando sea posible)
- Documentación inline y actualización de README
- Code review automático via CI/CD

### 3.3 Sprint 1: Fundamentos y Testing (1-7 enero)

**Objetivo:** Establecer bases sólidas de testing, migrar endpoint crítico, implementar CI/CD básico.

#### Día 1 (Miércoles): Separación Arquitectónica y Testing PHP Base

**Horas:** 15h (día extendido por refactoring crítico)

| Hora        | Actividad                                       | Entregable                  |
| ----------- | ----------------------------------------------- | --------------------------- |
| 9:00-9:30   | Kick-off sprint, revisión de entorno            | Checklist de prerequisitos  |
| 9:30-10:30  | Crear estructura backend/frontend separados     | Directorios creados         |
| 10:30-12:00 | Migrar código backend a proyecto independiente  | Backend separado funcional  |
| 12:00-13:00 | Migrar código frontend a proyecto independiente | Frontend separado funcional |
| 14:00-15:00 | Actualizar Containerfiles y compose.yaml        | 3 servicios orquestados     |
| 15:00-16:00 | Validar funcionamiento post-separación          | Health checks ok            |
| 16:00-16:30 | Instalación PHPUnit en php-service              | Configuración `phpunit.xml` |
| 16:30-17:00 | Tests unitarios `JWT.php` (inicio)              | Setup de testing            |

**Nota:** Los tests PHP se completan en días subsiguientes. La separación arquitectónica es crítica y tiene prioridad.

**Tareas Detalladas:**

1. **Separar Backend del Proyecto Vite (CRÍTICO - 7 horas):**

   a. **Crear estructura de directorios:**

   ```bash
   cd /var/www/html/hawaii/asistencia
   mkdir -p backend/src/{modules,shared,middleware}
   mkdir -p frontend/src/{features,shared,types}
   ```

   b. **Migrar backend:**

   ```bash
   # Copiar módulos de dominio
   cp -r node-service/src/backend/* backend/src/modules/
   cp -r node-service/src/shared/infrastructure backend/src/shared/
   cp -r node-service/src/middleware backend/src/middleware/
   cp node-service/src/{app.ts,index.ts} backend/src/

   # Extraer dependencias backend
   cd backend
   npm init -y
   npm install fastify @fastify/websocket ioredis pg jsonwebtoken otplib qrcode
   npm install -D typescript tsx @types/node @types/pg @types/jsonwebtoken
   npm install -D vitest @vitest/coverage-v8

   # Crear vitest.config.ts para backend
   cat > vitest.config.ts << 'EOF'
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
       coverage: {
         provider: 'v8',
         reporter: ['text', 'html', 'lcov'],
         exclude: ['node_modules/', 'dist/', '**/*.test.ts']
       }
     }
   });
   EOF

   # Crear tsconfig.json backend
   cat > tsconfig.json << 'EOF'
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "Node16",
       "moduleResolution": "Node16",
       "outDir": "dist",
       "rootDir": "src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   EOF
   ```

   c. **Migrar frontend:**

   ```bash
   cd /var/www/html/hawaii/asistencia
   cp -r node-service/src/frontend/* frontend/src/
   cp node-service/vite.config.ts frontend/

   cd frontend
   npm init -y
   npm install @zxing/browser @zxing/library
   npm install -D vite typescript @playwright/test

   # Actualizar vite.config.ts con paths corregidos
   ```

   d. **Actualizar compose.yaml:**

   ```yaml
   services:
     backend:
       build: ./backend
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - DB_HOST=postgres
         - VALKEY_HOST=valkey

     frontend:
       build: ./frontend
       ports:
         - "80:80"

     php-service:
       build: ./php-service
       ports:
         - "9500:9500"
   ```

   e. **Validar:**

   ```bash
   # Backend
   cd backend && npm run dev
   curl http://localhost:3000/asistencia/health

   # Frontend
   cd frontend && npm run dev
   # Verificar http://localhost:5173
   ```

2. **Configurar PHPUnit:**

   ```bash
   cd /var/www/html/hawaii/asistencia/php-service
   composer require --dev phpunit/phpunit
   ```

   Crear `phpunit.xml` con configuración de directorios y coverage.

3. **Tests JWT.php (completar desde día 1):**

   - Validar `encode()` con payload simple
   - Validar `decode()` con token válido
   - Verificar expiración de tokens
   - Verificar firma inválida rechazada
   - Verificar formato de token (estructura header.payload.signature)
   - **Meta:** 15 tests completos

4. **Tests AuthenticationService:**

   - Generación exitosa con sesión profesor
   - Generación exitosa con sesión alumno
   - Validación de userId consistente (CRC32 para alumnos)
   - Manejo de sesión inexistente
   - Validación de TTL (300 segundos)
   - Verificación de campos JWT (iss, aud, exp, iat)

5. **Tests LegacySessionAdapter:**
   - Lectura de `$_SESSION['id']` y `$_SESSION['user']`
   - Distinción profesor vs alumno (`id == -1`)
   - Método `isProfesor()` retorna correctamente
   - Método `isAlumno()` retorna correctamente
   - Generación de `userId` con CRC32

#### Día 2 (Jueves): Testing PHP Avanzado y Mocks

**Horas:** 8h

| Hora        | Actividad                           | Entregable                           |
| ----------- | ----------------------------------- | ------------------------------------ |
| 9:00-9:30   | Stand-up, revisión tests día 1      | -                                    |
| 9:30-11:30  | Tests `NodeServiceClient` con mocks | 15+ tests de comunicación HTTP       |
| 11:30-13:00 | Tests controladores API             | 10+ tests por controlador (30 total) |
| 14:00-16:00 | Tests de integración Router         | 10+ tests de routing                 |
| 16:00-16:45 | Reporte de cobertura PHP            | HTML coverage report >80%            |
| 16:45-17:00 | Retrospectiva, commit               | 70+ tests adicionales                |

**Tareas Detalladas:**

1. **Tests NodeServiceClient:**

   - Mock de cURL para evitar llamadas reales
   - Validación de headers (Authorization, Content-Type)
   - Manejo de respuestas exitosas (200)
   - Manejo de errores HTTP (401, 500)
   - Timeout de conexión

2. **Tests Controladores:**

   - `UserDataController`: Mock de sesión, validación de respuesta JSON
   - `CourseDataController`: Mock de `get_def_curso()`, validación de campos
   - `EnrollmentDataController`: Mock de estudiantes inscritos

3. **Tests Router:**

   - Mapeo correcto de rutas a handlers
   - Respuesta 404 para rutas no existentes
   - Headers CORS configurados
   - Manejo de métodos HTTP (GET, POST, OPTIONS)

4. **Cobertura:**
   ```bash
   phpunit --coverage-html coverage/
   ```
   Verificar >80% de cobertura en archivos críticos.

#### Día 3 (Viernes): Migración de Endpoint y CI/CD Base

**Horas:** 8h

| Hora        | Actividad                                         | Entregable                      |
| ----------- | ------------------------------------------------- | ------------------------------- |
| 9:00-9:30   | Stand-up                                          | -                               |
| 9:30-11:30  | Migrar `api_get_asistencia_token.php` al módulo   | Endpoint `/api/token` funcional |
| 11:30-13:00 | Actualizar `horario.php` para usar nuevo endpoint | Integración completa            |
| 14:00-15:30 | Configurar GitHub Actions workflow                | `.github/workflows/test.yml`    |
| 15:30-16:45 | Configurar checks automáticos (linting, tests)    | Pipeline ejecutándose           |
| 16:45-17:00 | Retrospectiva, commit                             | Endpoint migrado + CI/CD básico |

**Tareas Detalladas:**

1. **Migración de Endpoint:**

   - Modificar `horario.php` líneas ~890-910:

     ```javascript
     // ANTES:
     $.get('api_get_asistencia_token.php', function(response) { ... });

     // DESPUÉS:
     $.get('asistencia-node-integration/api/token', function(response) { ... });
     ```

   - Verificar mismas propiedades en respuesta: `success`, `token`, `expiresIn`, `userId`, `username`
   - Agregar comentario de deprecación en `api_get_asistencia_token.php`

2. **GitHub Actions Workflow:**

   ```yaml
   name: Test Suite
   on: [push, pull_request]
   jobs:
     test-php:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: shivammathur/setup-php@v2
           with:
             php-version: "7.4"
         - run: cd php-service && composer install
         - run: cd php-service && vendor/bin/phpunit

     test-node:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: "20"
         - run: cd node-service && npm ci
         - run: cd node-service && npm test
   ```

3. **Linting:**
   - PHP CS Fixer para estándares PSR-12
   - ESLint para código TypeScript

#### Día 4 (Sábado): Tests End-to-End Manuales

**Horas:** 8h

| Hora        | Actividad                       | Entregable                     |
| ----------- | ------------------------------- | ------------------------------ |
| 9:00-9:30   | Stand-up                        | -                              |
| 9:30-11:00  | Levantar entorno completo local | Contenedores corriendo         |
| 11:00-13:00 | Test manual flujo profesor      | Checklist funcional profesor   |
| 14:00-16:00 | Test manual flujo estudiante    | Checklist funcional estudiante |
| 16:00-16:45 | Documentar casos de prueba      | Documento test-cases.md        |
| 16:45-17:00 | Retrospectiva, commit           | Casos de prueba documentados   |

**Tareas Detalladas:**

1. **Entorno Local:**

   ```bash
   cd /var/www/html/hawaii/asistencia
   podman-compose -f compose.yaml -f compose.dev.yaml up -d
   ```

   Verificar servicios:

   - PHP service: puerto 9500
   - Node service: puerto 3000 (interno)
   - PostgreSQL: puerto 5432
   - Valkey: puerto 6379

2. **Checklist Flujo Profesor:**

   - [ ] Login exitoso en Hawaii
   - [ ] Acceso a horario.php
   - [ ] Clic en "Nuevo Sistema de Asistencia"
   - [ ] Modal se abre con iframe
   - [ ] JWT presente en URL del iframe
   - [ ] QR dinámico visible (cambia cada 10 seg)
   - [ ] Registro en `asistencia_curso` con código correcto
   - [ ] WebSocket activo (inspeccionar console)
   - [ ] Al cerrar modal, sesión finaliza

3. **Checklist Flujo Estudiante:**

   - [ ] Login exitoso en Hawaii (alumno)
   - [ ] Acceso a horario.php
   - [ ] Clic en "Tomar Asistencia"
   - [ ] Modal se abre con lector QR
   - [ ] Escaneo de QR proyectado por profesor
   - [ ] Validación TOTP exitosa
   - [ ] Registro en `alumno_asistencia`
   - [ ] Redirección a encuesta (asist0.php)
   - [ ] Envío de encuesta guarda en `comentarios_clase`

4. **Documentación:**
   Crear `test-cases.md` con cada paso, screenshots esperados, y queries SQL de verificación.

#### Día 5 (Domingo): Tests Automatizados E2E con Playwright

**Horas:** 8h

| Hora        | Actividad                        | Entregable               |
| ----------- | -------------------------------- | ------------------------ |
| 9:00-9:30   | Stand-up                         | -                        |
| 9:30-11:30  | Configurar Playwright            | `playwright.config.ts`   |
| 11:30-13:00 | Test E2E: Generación de JWT      | Test automatizado        |
| 14:00-15:30 | Test E2E: Proyección QR profesor | Test automatizado        |
| 15:30-16:45 | Test E2E: Escaneo QR alumno      | Test automatizado        |
| 16:45-17:00 | Retrospectiva sprint 1, commit   | 3+ tests E2E funcionando |

**Tareas Detalladas:**

1. **Configuración Playwright:**

   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

   Configurar `playwright.config.ts` con:

   - Base URL: `http://localhost:9500`
   - Timeout: 30 segundos
   - Viewport: 1280x720
   - Screenshots en fallo

2. **Test E2E JWT:**

   ```typescript
   test("Profesor obtiene JWT válido", async ({ page }) => {
     await page.goto("/horario.php");
     await page.fill("#auth-user", "profesor@ucn.cl");
     await page.fill("#auth-passwd", "password123");
     await page.click("#auth-go");

     await page.click("#main_curso_nuevo_sistema_asistencia");

     const iframe = await page.frameLocator("#asistencia-iframe");
     const url = await iframe.page().url();

     expect(url).toContain("token=");
     const token = new URLSearchParams(url.split("?")[1]).get("token");
     expect(token).toBeTruthy();

     // Verificar estructura JWT
     const parts = token.split(".");
     expect(parts).toHaveLength(3);
   });
   ```

3. **Test E2E Proyección QR:**

   - Abrir modal profesor
   - Esperar conexión WebSocket
   - Verificar aparición de QR en canvas
   - Esperar 10 segundos y verificar cambio de QR
   - Validar payload TOTP

4. **Test E2E Escaneo:**
   - Abrir dos contextos de navegador (profesor y alumno)
   - Profesor proyecta QR
   - Alumno escanea QR (simular captura)
   - Verificar llamada HTTP POST a `/attendance/mark`
   - Verificar redirección a encuesta

#### Retrospectiva Sprint 1

**Logros Esperados:**

- 115+ tests PHP implementados (>80% cobertura)
- Endpoint `api_get_asistencia_token.php` migrado completamente
- CI/CD básico con GitHub Actions
- 3+ tests E2E automatizados con Playwright
- Documentación de casos de prueba

**Métricas:**

- Tests PHP: 115 aprobados
- Tests Node.js: 206 aprobados (preexistentes)
- Tests E2E: 3 aprobados
- Cobertura PHP: >80%
- Cobertura Node.js: >85%

---

### 3.4 Sprint 2: Integración y Despliegue (8-12 enero)

**Objetivo:** Validar requisitos funcionales completos, desplegar en staging, documentar procedimientos.

#### Día 6 (Miércoles): Validación de Requisitos 1-4

**Horas:** 8h

| Hora        | Actividad                                 | Entregable              |
| ----------- | ----------------------------------------- | ----------------------- |
| 9:00-9:30   | Kick-off sprint 2                         | -                       |
| 9:30-11:00  | Validar requisito 1 (sistema aislado)     | Checklist aprobado      |
| 11:00-12:30 | Validar requisito 2 (opción estudiante)   | Checklist aprobado      |
| 12:30-13:00 | Validar requisito 3 (opción profesor)     | Checklist aprobado      |
| 14:00-16:45 | Validar requisito 4 (registro asistencia) | Checklist + queries SQL |
| 16:45-17:00 | Retrospectiva, commit                     | 4 requisitos validados  |

**Tareas Detalladas:**

1. **Requisito 1: Sistema Aislado**

   - [ ] Hawaii legacy responde en `/` sin modificaciones críticas
   - [ ] Módulo asistencia accesible en `/asistencia`
   - [ ] PHP integration en `/asistencia-node-integration`
   - [ ] Base de datos compartida sin conflictos de esquema
   - [ ] Consulta a tablas legacy (`curso`, `semestre`) funciona desde Node
   - [ ] Logs de Apache no muestran errores 500

2. **Requisito 2: Opción Estudiante**

   - [ ] Botón "Tomar Asistencia" visible en horario.php
   - [ ] Visible solo para usuarios con `$_SESSION['id'] == -1`
   - [ ] Clic abre modal con iframe
   - [ ] URL del iframe: `/asistencia/features/qr-reader/index.html?token=...`
   - [ ] Modal tiene título "Tomar Asistencia"

3. **Requisito 3: Opción Profesor**

   - [ ] Botón "Nuevo Sistema de Asistencia" visible en main_curso.php
   - [ ] Visible solo para profesores con `can_tomar_asistencia()`
   - [ ] Clic abre modal con iframe
   - [ ] URL del iframe: `/asistencia/features/qr-host/index.html?token=...`
   - [ ] Modal tiene título "Proyección de Asistencia"

4. **Requisito 4: Registro Exitoso**
   - [ ] Estudiante escanea QR del profesor
   - [ ] Frontend envía POST a `/asistencia/api/attendance/mark`
   - [ ] Backend valida TOTP (token no expirado)
   - [ ] Validación de restricción IP (si aplicable)
   - [ ] Inserción en `alumno_asistencia`:
     ```sql
     INSERT INTO alumno_asistencia
       (rut, curso, semestre, fecha, bloque, estado, hora_marca)
     VALUES
       ('186875052', 429, 5, 20250108, 1, 1, '2025-01-08 08:03:45');
     ```
   - [ ] Estado = 1 (presente)
   - [ ] Timestamp correcto (hora actual)
   - [ ] Relación con `asistencia_curso` via código de reserva
   - [ ] Respuesta HTTP 201 al frontend
   - [ ] Mensaje de éxito en UI

#### Día 7 (Jueves): Validación de Requisitos 5-7 y Ajustes

**Horas:** 8h

| Hora        | Actividad                              | Entregable                  |
| ----------- | -------------------------------------- | --------------------------- |
| 9:00-9:30   | Stand-up                               | -                           |
| 9:30-11:30  | Validar requisito 5 (encuestas)        | Checklist + verificación DB |
| 11:30-13:00 | Validar requisito 6 (pantalla general) | Screenshots + queries       |
| 14:00-15:30 | Validar requisito 7 (duración QR)      | Tests automatizados         |
| 15:30-16:45 | Ajustes y correcciones identificadas   | Commits de fixes            |
| 16:45-17:00 | Retrospectiva, commit                  | 7 requisitos validados      |

**Tareas Detalladas:**

1. **Requisito 5: Preservación de Encuestas**

   - [ ] Tras marcar asistencia, frontend redirige a `asist0.php?c=<codigo>`
   - [ ] Parámetro `c` es el código de reserva
   - [ ] `asist0.php` muestra formulario según `tipo` de asistencia
   - [ ] Tipos soportados: 2, 3, 4, 5, 6, 7
   - [ ] Estudiante puede completar encuesta sin re-autenticarse
   - [ ] Submit guarda en `comentarios_clase`:
     ```sql
     INSERT INTO comentarios_clase
       (reserva_id, rut, tipo, nota, comentario, timestamp)
     VALUES
       (12345, '186875052', 2, 5, 'Clase excelente', now());
     ```
   - [ ] Mensaje de confirmación al estudiante

2. **Requisito 6: Pantalla General de Asistencia**

   - [ ] Acceso a `asist_lista.php?c=<idCurso>&s=<idSemestre>`
   - [ ] Tabla muestra todas las fechas de asistencia
   - [ ] Columnas: RUT, Nombre, Fecha, Bloque, Estado
   - [ ] Filtrar por fecha específica (2025-01-08)
   - [ ] Verificar asistencia recién marcada aparece
   - [ ] Bloque correcto (según `asistencia_curso.bloque`)
   - [ ] Estado = "Presente" (valor 1)
   - [ ] Sin duplicados para mismo alumno/fecha/bloque

3. **Requisito 7: Duración de Reserva**

   - Configurar reserva con 5 minutos:
     ```sql
     UPDATE asistencia_curso
     SET fechahora_termino = fechahora_inicio + interval '5 minutes'
     WHERE id = 12345;
     ```
   - [ ] Intentar marcar asistencia dentro de 5 minutos: éxito
   - [ ] Intentar marcar asistencia después de 5 minutos: error 410
   - [ ] Mensaje de error: "Sesión de asistencia expirada"
   - [ ] Backend valida `NOW() < fechahora_termino`
   - Test automatizado:
     ```typescript
     test("Reserva expira tras TTL configurado", async () => {
       // Crear reserva con TTL 2 segundos
       // Esperar 3 segundos
       // Intentar marcar asistencia
       // Expect HTTP 410
     });
     ```

4. **Ajustes Identificados:**
   - Corregir timezone en PostgreSQL (UTC vs local)
   - Agregar índices en `alumno_asistencia(rut, fecha, bloque)`
   - Mejorar mensajes de error en frontend
   - Agregar logging de eventos críticos

#### Día 8 (Viernes): Preparación de Despliegue y Documentación

**Horas:** 8h

| Hora        | Actividad                              | Entregable                |
| ----------- | -------------------------------------- | ------------------------- |
| 9:00-9:30   | Stand-up                               | -                         |
| 9:30-11:30  | Documentar procedimiento de despliegue | `DEPLOYMENT.md`           |
| 11:30-13:00 | Crear scripts de configuración         | `deploy.sh`, `.env.prod`  |
| 14:00-15:30 | Preparar checklist pre-despliegue      | `PRE_DEPLOY_CHECKLIST.md` |
| 15:30-16:45 | Validar secrets y configuraciones      | Archivo `.env` verificado |
| 16:45-17:00 | Retrospectiva, commit                  | Documentación completa    |

**Tareas Detalladas:**

1. **DEPLOYMENT.md:**

   ```markdown
   # Procedimiento de Despliegue - Sistema de Asistencia

   ## Pre-requisitos

   - Servidor con Apache 2.4, PHP 7.4+, PostgreSQL 12+
   - Acceso SSH con sudo
   - Cloudflare Tunnel configurado
   - Dominio: mantochrisal.cl apuntando al tunnel

   ## Pasos

   ### 1. Clonar repositorio

   git clone <repo> /var/www/html/hawaii/asistencia
   cd /var/www/html/hawaii/asistencia

   ### 2. Configurar variables de entorno

   cp .env.example .env

   # Editar .env con valores de producción

   ### 3. Generar secrets

   openssl rand -base64 32 > jwt_secret.txt

   # Copiar valor a .env JWT_SECRET

   # Copiar mismo valor a sistema legacy

   ### 4. Levantar servicios

   podman-compose -f compose.yaml -f compose.prod.yaml up -d

   ### 5. Verificar salud

   curl http://localhost:3000/asistencia/health

   # Expect: {"status":"ok"}

   ### 6. Configurar Apache

   # Copiar asistencia.conf a /etc/httpd/conf.d/

   systemctl restart httpd

   ### 7. Configurar Cloudflare Tunnel

   # Editar config.yml con ingress rules

   systemctl restart cloudflared

   ### 8. Verificar acceso externo

   curl https://mantochrisal.cl/asistencia/health
   ```

2. **Scripts de Configuración:**

   - `deploy.sh`: Script automatizado para pasos 1-6
   - `rollback.sh`: Script para revertir a versión anterior
   - `backup.sh`: Script para backup de base de datos

3. **Checklist Pre-Despliegue:**

   - [ ] Backup de base de datos creado
   - [ ] JWT_SECRET coincide entre PHP y Node.js
   - [ ] Variables de entorno validadas
   - [ ] Tests aprobados (CI/CD verde)
   - [ ] Documentación actualizada
   - [ ] Cloudflare Tunnel activo
   - [ ] Apache configurado con proxy reverso
   - [ ] Firewall permite tráfico en puertos 80, 443
   - [ ] PostgreSQL acepta conexiones desde contenedores
   - [ ] Valkey accesible desde Node.js

4. **Validación de Secrets:**

   ```bash
   # En servidor
   grep JWT_SECRET /var/www/html/hawaii/asistencia/.env
   grep jwtSecret /var/www/html/hawaii/api_get_asistencia_token.php

   # DEBEN SER IDÉNTICOS
   ```

#### Día 9 (Sábado): Despliegue en Staging

**Horas:** 8h

| Hora        | Actividad                   | Entregable          |
| ----------- | --------------------------- | ------------------- |
| 9:00-9:30   | Stand-up                    | -                   |
| 9:30-10:30  | Backup de producción        | Dump SQL + archivos |
| 10:30-12:00 | Ejecutar despliegue staging | Servicios corriendo |
| 12:00-13:00 | Validar salud de servicios  | Health checks ok    |
| 14:00-15:30 | Tests manuales en staging   | Checklist completo  |
| 15:30-16:45 | Correcciones de staging     | Fixes aplicados     |
| 16:45-17:00 | Retrospectiva, commit       | Staging funcional   |

**Tareas Detalladas:**

1. **Backup:**

   ```bash
   pg_dump asistencia > backup_$(date +%Y%m%d_%H%M%S).sql
   tar -czf hawaii_backup_$(date +%Y%m%d).tar.gz /var/www/html/hawaii
   ```

2. **Despliegue:**

   ```bash
   cd /var/www/html/hawaii/asistencia
   git pull origin main
   ./deploy.sh
   ```

3. **Health Checks:**

   ```bash
   # Node.js
   curl http://localhost:3000/asistencia/health

   # PHP
   curl http://localhost:9500/asistencia-node-integration/api/validate-session

   # PostgreSQL
   psql -U asistencia_user -d asistencia -c "SELECT 1;"

   # Valkey
   redis-cli PING
   ```

4. **Tests Manuales Staging:**
   - Repetir checklist de día 4 (flujo profesor y estudiante)
   - Validar desde dispositivos móviles
   - Verificar desde red externa (fuera de UCN)
   - Probar con múltiples usuarios concurrentes
   - Validar logs de Apache y Node.js sin errores

#### Día 10 (Domingo): Optimización y Monitoreo

**Horas:** 8h

| Hora        | Actividad                        | Entregable         |
| ----------- | -------------------------------- | ------------------ |
| 9:00-9:30   | Stand-up                         | -                  |
| 9:30-11:30  | Implementar logging estructurado | Logger configurado |
| 11:30-13:00 | Configurar métricas básicas      | Dashboard Valkey   |
| 14:00-15:30 | Optimización de queries SQL      | Índices agregados  |
| 15:30-16:45 | Documentar runbook operacional   | `RUNBOOK.md`       |
| 16:45-17:00 | Retrospectiva sprint 2, commit   | Sistema optimizado |

**Tareas Detalladas:**

1. **Logging Estructurado:**

   - Configurar Winston en Node.js con niveles: error, warn, info, debug
   - Formato JSON para parsing automatizado
   - Rotación diaria de logs
   - Agregar context en cada log (userId, sessionId, timestamp)

2. **Métricas Básicas:**

   - Contador de asistencias registradas por hora
   - Tiempo de respuesta promedio de endpoints
   - Uso de memoria Valkey
   - Conexiones activas PostgreSQL
   - Dashboard simple con Grafana (opcional)

3. **Optimización SQL:**

   ```sql
   -- Índices para consultas frecuentes
   CREATE INDEX idx_alumno_asistencia_fecha
     ON alumno_asistencia(fecha, bloque);

   CREATE INDEX idx_asistencia_curso_codigo
     ON asistencia_curso(codigo);

   CREATE INDEX idx_comentarios_clase_reserva
     ON comentarios_clase(reserva_id);

   -- Analizar plan de ejecución
   EXPLAIN ANALYZE
   SELECT * FROM alumno_asistencia
   WHERE fecha = 20250110 AND bloque = 1;
   ```

4. **RUNBOOK.md:**

   ```markdown
   # Runbook Operacional - Sistema de Asistencia

   ## Incidentes Comunes

   ### Error: "JWT Signature Invalid"

   Causa: Secreto desincronizado entre PHP y Node.js
   Solución:

   1. Verificar JWT_SECRET en .env
   2. Verificar jwtSecret en api_get_asistencia_token.php
   3. Reiniciar contenedores

   ### Error: "Session Expired" (410)

   Causa: Reserva expiró antes de marca
   Solución:

   1. Verificar fechahora_termino en asistencia_curso
   2. Considerar aumentar TTL a 10 minutos

   ### Error: Asistencia no aparece en pantalla general

   Causa: Problema de sincronización DB
   Solución:

   1. Verificar registro en alumno_asistencia
   2. Validar relación con asistencia_curso via código
   3. Refrescar caché de página
   ```

#### Retrospectiva Sprint 2

**Logros Esperados:**

- 7 requisitos funcionales validados
- Sistema desplegado en staging (mantochrisal.cl)
- Documentación completa de despliegue y operaciones
- Logging y métricas básicas implementadas
- Optimizaciones de performance aplicadas

**Métricas:**

- Requisitos aprobados: 7/7
- Tests E2E en staging: 3 aprobados
- Tiempo de respuesta promedio: <200ms
- Uptime staging (48h): >99%

### 3.5 Escenarios de Error y Manejo de Excepciones

**Por Requisito:**

#### Requisito 1: Sistema Aislado

**Escenarios de Fallo:**

1. **Conflicto de rutas:** `/asistencia` capturado por legacy

   - **Detección:** Health check retorna 404
   - **Solución:** Verificar orden de reglas en Apache config
   - **Rollback:** Comentar proxy de asistencia, reiniciar Apache

2. **Conflicto de esquema BD:** Foreign keys fallan

   - **Detección:** Error en inserción `alumno_asistencia`
   - **Solución:** Verificar nombres de tablas y constraints
   - **Rollback:** Restaurar backup de esquema

3. **Puerto en uso:** Backend no puede iniciar
   - **Detección:** `EADDRINUSE` en logs
   - **Solución:** Verificar `podman ps`, matar proceso
   - **Rollback:** Cambiar puerto en `.env`

#### Requisito 2 y 3: Opciones UI

**Escenarios de Fallo:**

1. **Botón no aparece:** Sesión PHP no válida

   - **Detección:** `$_SESSION['id']` undefined
   - **Solución:** Verificar `session_start()` en legacy
   - **Rollback:** Revertir cambios en horario.php

2. **JWT inválido:** Token no se genera

   - **Detección:** Response sin campo `token`
   - **Solución:** Verificar JWT_SECRET sincronizado
   - **Rollback:** Usar endpoint legacy

3. **Modal no abre:** Iframe bloqueado
   - **Detección:** Error CORS en console
   - **Solución:** Agregar headers en backend
   - **Rollback:** Abrir en ventana nueva en lugar de iframe

#### Requisito 4: Registro Asistencia

**Escenarios de Fallo:**

1. **TOTP inválido:** Código expirado o incorrecto

   - **Detección:** HTTP 401 "Invalid TOTP"
   - **Solución:** Verificar sincronización de tiempo (NTP)
   - **Rollback:** Aumentar ventana de tolerancia TOTP

2. **Duplicado:** Alumno ya registrado

   - **Detección:** HTTP 409 "Already registered"
   - **Solución:** Verificar constraint UNIQUE en BD
   - **Rollback:** Permitir múltiples registros (quitar constraint)

3. **IP restringida:** Alumno fuera de red UCN

   - **Detección:** HTTP 403 "Network not allowed"
   - **Solución:** Verificar IP del alumno
   - **Rollback:** Cambiar `acepta_origen_ip` a "ALL"

4. **Timeout BD:** PostgreSQL no responde
   - **Detección:** HTTP 500, logs "Connection timeout"
   - **Solución:** Reiniciar PostgreSQL, verificar pool
   - **Rollback:** Usar BD de respaldo

#### Requisito 5: Encuestas

**Escenarios de Fallo:**

1. **Redirect falla:** No se abre asist0.php

   - **Detección:** Alumno queda en pantalla de éxito
   - **Solución:** Verificar URL de redirect
   - **Rollback:** Mostrar link manual a encuesta

2. **Tipo de encuesta incorrecto:** Formulario no coincide

   - **Detección:** Campos faltantes o incorrectos
   - **Solución:** Verificar `tipo` en `asistencia_curso`
   - **Rollback:** Permitir cualquier tipo de encuesta

3. **Guardado falla:** Error en `comentarios_clase`
   - **Detección:** Submit sin confirmación
   - **Solución:** Verificar constraints de tabla
   - **Rollback:** Hacer campos opcionales

#### Requisito 6: Pantalla General

**Escenarios de Fallo:**

1. **Asistencia no aparece:** Retraso de sincronización

   - **Detección:** Query retorna vacío
   - **Solución:** Verificar transaction commit
   - **Rollback:** Refrescar caché, VACUUM BD

2. **Fecha incorrecta:** Timezone mal configurado

   - **Detección:** Asistencia en fecha diferente
   - **Solución:** Configurar timezone en PostgreSQL
   - **Rollback:** Ajustar manualmente fechas

3. **Duplicados:** Mismo alumno aparece 2 veces
   - **Detección:** COUNT > 1 en query de verificación
   - **Solución:** Agregar constraint UNIQUE, limpiar duplicados
   - **Rollback:** Mostrar todos, marcar duplicados

#### Requisito 7: Duración QR

**Escenarios de Fallo:**

1. **Expiración no funciona:** Acepta códigos viejos

   - **Detección:** Test automatizado falla
   - **Solución:** Verificar comparación de timestamps
   - **Rollback:** Aumentar TTL a 60 minutos

2. **Expira demasiado rápido:** Alumnos no alcanzan

   - **Detección:** Múltiples errores 410
   - **Solución:** Aumentar TTL en BD
   - **Rollback:** Configurar TTL 10 minutos

3. **Timezone causa expiración prematura:** Servidor en UTC
   - **Detección:** Expira inmediatamente
   - **Solución:** Sincronizar timezone PHP/Node/PostgreSQL
   - **Rollback:** Usar UTC en todos los servicios

### 3.6 Plan de Rollback por Componente

**Estrategia General:**

1. Cada cambio en branch separado
2. Backup antes de despliegue
3. Scripts de rollback automatizados
4. Validación post-rollback

**Componentes:**

| Componente     | Comando Rollback                                                          | Tiempo | Impacto |
| -------------- | ------------------------------------------------------------------------- | ------ | ------- |
| Apache Config  | `cp asistencia.conf.bak asistencia.conf && systemctl restart httpd`       | 30 seg | Medio   |
| Backend        | `podman-compose stop backend && podman-compose up -d backend-old`         | 1 min  | Alto    |
| Frontend       | `podman-compose stop frontend && podman-compose up -d frontend-old`       | 1 min  | Medio   |
| PHP Service    | `git checkout main -- php-service/ && podman-compose restart php-service` | 2 min  | Alto    |
| Base de Datos  | `psql asistencia < backup_YYYYMMDD.sql`                                   | 5 min  | Crítico |
| Endpoint Token | Descomentar api_get_asistencia_token.php, revertir horario.php            | 1 min  | Alto    |

**Script de Rollback Completo:**

```bash
#!/bin/bash
# rollback.sh - Revertir despliegue completo

set -e

echo "[1/6] Revertir Apache config..."
cp /etc/httpd/conf.d/asistencia.conf.bak /etc/httpd/conf.d/asistencia.conf
systemctl restart httpd

echo "[2/6] Detener nuevos servicios..."
cd /var/www/html/hawaii/asistencia
podman-compose down

echo "[3/6] Restaurar código..."
git checkout main~1 -- .

echo "[4/6] Restaurar base de datos..."
psql -U asistencia_user -d asistencia < backups/backup_$(date +%Y%m%d).sql

echo "[5/6] Levantar servicios legacy..."
podman-compose -f compose.yaml -f compose.legacy.yaml up -d

echo "[6/6] Validar rollback..."
curl -f http://localhost/api_get_asistencia_token.php || echo "ROLLBACK FAILED"

echo "✅ Rollback completado"
```

---

## 4. ENTREGABLES FINALES

### 4.1 Documentación

1. **Documentación de Separación Arquitectónica** (`ARCHITECTURE_REFACTOR.md`)

   - Justificación técnica de la separación Backend/Frontend
   - Comparación antes/después
   - Guía de migración de proyectos monolíticos a separados
   - Lecciones aprendidas

2. **Informe de Validación de Requisitos** (`REQUIREMENTS_VALIDATION.md`)

   - Estado de cada uno de los 7 requisitos
   - Evidencia de cumplimiento (screenshots, queries SQL)
   - Tests automatizados por requisito

3. **Guía de Despliegue** (`DEPLOYMENT.md`)

   - Procedimiento paso a paso
   - Scripts de automatización
   - Checklist pre-despliegue

4. **Runbook Operacional** (`RUNBOOK.md`)

   - Incidentes comunes y soluciones
   - Procedimientos de mantenimiento
   - Contactos de soporte

5. **Reporte de Cobertura de Tests**

   - HTML report PHP (>80%)
   - HTML report Node.js (>85%)
   - Listado de tests E2E

6. **Documentación de API** (`API.md`)
   - Endpoints disponibles
   - Esquemas de request/response
   - Códigos de error

### 4.2 Código

1. **Módulo PHP de Integración**

   - `/php-service/src/asistencia-node-integration`
   - 115+ tests unitarios
   - Cobertura >80%

2. **Migración de Endpoint**

   - `api_get_asistencia_token.php` deprecado
   - `/asistencia-node-integration/api/token` operacional
   - `horario.php` actualizado

3. **CI/CD Pipeline**

   - `.github/workflows/test.yml`
   - Ejecución automática en push
   - Reportes de cobertura

4. **Tests E2E**
   - `e2e/profesor-flow.spec.ts`
   - `e2e/estudiante-flow.spec.ts`
   - `e2e/jwt-generation.spec.ts`

### 4.3 Infraestructura

1. **Despliegue Staging**

   - Sistema corriendo en mantochrisal.cl
   - Accesible vía Cloudflare Tunnel
   - Logs configurados y accesibles

2. **Scripts de Automatización**
   - `deploy.sh` - Despliegue automatizado
   - `rollback.sh` - Reversión a versión anterior
   - `backup.sh` - Backup de base de datos
   - `health-check.sh` - Validación de servicios

---

## 5. RIESGOS Y MITIGACIONES

### 5.1 Riesgos Técnicos

| Riesgo                                          | Probabilidad | Impacto | Mitigación                                                                       |
| ----------------------------------------------- | ------------ | ------- | -------------------------------------------------------------------------------- |
| Separación Backend/Frontend rompe funcionalidad | Media        | Alto    | Tests inmediatos post-migración, validación exhaustiva, git branch para rollback |
| Incompatibilidad JWT PHP↔Node                   | Media        | Alto    | Tests cruzados desde día 1, validación de secret                                 |
| Timeout de WebSocket en producción              | Baja         | Medio   | Configurar keep-alive, fallback a polling                                        |
| Conflicto de esquema BD                         | Baja         | Alto    | Revisar DDL antes de despliegue, namespace claro                                 |
| Problemas de CORS en iframe                     | Media        | Alto    | Configurar headers correctamente, test en staging                                |
| Pérdida de sesión PHP                           | Baja         | Medio   | Validar `$_SESSION` disponible, manejo de errores                                |

### 5.2 Riesgos de Negocio

| Riesgo                            | Probabilidad | Impacto | Mitigación                                          |
| --------------------------------- | ------------ | ------- | --------------------------------------------------- |
| Resistencia al cambio de usuarios | Media        | Bajo    | Interfaz similar al sistema actual, capacitación    |
| Downtime durante despliegue       | Media        | Alto    | Despliegue en horario valle, backup completo        |
| Bugs no detectados en producción  | Baja         | Alto    | Testing exhaustivo, rollback plan, monitoreo activo |

### 5.3 Riesgos de Proyecto

| Riesgo                          | Probabilidad | Impacto | Mitigación                                         |
| ------------------------------- | ------------ | ------- | -------------------------------------------------- |
| Retraso en testing PHP          | Media        | Medio   | Buffers en planificación, priorizar tests críticos |
| Problemas con Cloudflare Tunnel | Baja         | Alto    | Validar configuración en día 9, soporte de CF      |
| Falta de documentación técnica  | Baja         | Medio   | Documentar inline mientras se desarrolla           |

---

## 6. CRITERIOS DE ÉXITO

### 6.1 Criterios Técnicos

- [ ] 7/7 requisitos funcionales validados y documentados
- [ ] 115+ tests PHP implementados y aprobados
- [ ] 206+ tests Node.js aprobados (preexistentes)
- [ ] 3+ tests E2E automatizados con Playwright
- [ ] Cobertura de código >80% en componentes nuevos
- [ ] CI/CD pipeline operacional con checks automáticos
- [ ] Despliegue staging exitoso en mantochrisal.cl
- [ ] Tiempo de respuesta promedio <200ms
- [ ] Cero errores 500 en logs de producción durante 48h

### 6.2 Criterios Funcionales

- [ ] Profesor puede abrir sesión de asistencia desde nueva interfaz
- [ ] Código QR dinámico se proyecta correctamente
- [ ] Estudiante puede escanear QR y registrar asistencia
- [ ] Asistencia aparece en pantalla general con datos correctos
- [ ] Encuestas post-asistencia funcionan sin cambios
- [ ] Duración de reserva configurable y validada
- [ ] Sistema aislado no afecta funcionalidad legacy

### 6.3 Criterios de Documentación

- [ ] README.md actualizado con instrucciones de uso
- [ ] DEPLOYMENT.md con procedimiento completo
- [ ] RUNBOOK.md con incidentes y soluciones
- [ ] API.md con documentación de endpoints
- [ ] Comentarios inline en código crítico
- [ ] Diagramas de arquitectura actualizados

---

## 7. APRENDIZAJE Y DESARROLLO PROFESIONAL

### 7.1 Herramientas GitHub Student Pack a Explorar

1. **GitHub Codespaces** - Entorno de desarrollo en la nube

   - Configurar devcontainer para el proyecto
   - Desarrollo sin dependencias locales

2. **GitHub Copilot** - Asistente de código IA (ya en uso)

   - Generación de tests unitarios
   - Documentación automática

3. **GitHub Actions** - CI/CD (implementado en sprint 1)

   - Tests automatizados
   - Despliegue continuo

4. **Heroku** (créditos estudiante) - Hosting alternativo

   - Despliegue de demo
   - Staging environment

5. **MongoDB Atlas** (créditos estudiante) - Base de datos

   - Cache secundario (opcional)

6. **Sentry** - Monitoreo de errores
   - Tracking de excepciones en tiempo real
   - Alertas automatizadas

### 7.2 Competencias Técnicas Desarrolladas

- Testing exhaustivo (unitario, integración, E2E)
- CI/CD con GitHub Actions
- Integración de sistemas legacy con arquitecturas modernas
- Debugging de autenticación cross-service
- Optimización de queries SQL
- Logging y monitoreo de aplicaciones
- Despliegue con contenedores (Podman)
- Configuración de proxy reverso (Apache)
- Gestión de secretos y variables de entorno

### 7.3 Recursos de Aprendizaje

**Durante el proyecto:**

- Documentación oficial de PHPUnit
- Playwright documentation
- GitHub Actions workflow syntax
- Vitest best practices

**Post-proyecto:**

- Curso de Cloudflare Workers (CDN edge computing)
- Certificación PostgreSQL Performance Tuning
- Advanced TypeScript patterns

---

## 8. PRÓXIMOS PASOS POST-PROYECTO

### 8.1 Fase 3: Optimizaciones (Enero 13-31)

1. **Performance:**

   - Implementar caching de consultas frecuentes
   - Optimización de bundle frontend (code splitting)
   - CDN para assets estáticos

2. **Seguridad:**

   - Auditoría de seguridad completa
   - Rate limiting en endpoints críticos
   - Implementar CSRF protection

3. **UX:**
   - Feedback visual mejorado
   - Accesibilidad (WCAG 2.1)
   - Responsive design para tablets

### 8.2 Fase 4: Expansión (Febrero)

1. **FIDO2 Enrollment:**

   - Completar módulo de registro biométrico
   - Tests de enrollment flow

2. **Analytics:**

   - Dashboard de estadísticas para administradores
   - Reportes de uso del sistema

3. **Integración completa:**
   - Deprecar completamente `asist0.php`
   - Migrar encuestas al nuevo frontend

---

## 9. CONTACTOS Y RECURSOS

### 9.1 Equipo

**Desarrollador Principal:** Cristian  
**Rol:** Full-stack developer  
**Horario:** 9:00-17:00 (UTC-3)

### 9.2 Recursos Externos

**Repositorio:** [URL del repositorio]  
**Staging:** https://mantochrisal.cl/asistencia  
**Documentación:** `/asistencia/documents/INDEX.md`  
**CI/CD:** GitHub Actions  
**Monitoreo:** Logs en `/var/log/httpd/` y `/var/log/containers/`

### 9.3 Soporte

**Cloudflare Tunnel:** [soporte Cloudflare]  
**PostgreSQL:** [community forums]  
**Node.js:** [Stack Overflow]  
**PHPUnit:** [documentación oficial]

---

## 10. CARTA GANTT RESUMIDA

```
┌──────────────────────────────────────────────────────────────────┐
│                         ENERO 2025                                │
├────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┤
│ D  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │ 9  │ 10 │ 11 │ 12 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│    │ Mi │ Ju │ Vi │ Sa │ Do │ Lu │ Ma │ Mi │ Ju │ Vi │ Sa │ Do │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│    │ ██ │ ██ │ ██ │ ██ │ ██ │    │    │ ▓▓ │ ▓▓ │ ▓▓ │ ▓▓ │ ▓▓ │
│    │SEP │PHP │MIG │E2E │E2E │OFF │OFF │REQ │REQ │DEP │OPT │DOC │
│    │ARC │TST │END │MAN │AUT │    │    │1-4 │5-7 │STG │    │    │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘

██ Sprint 1 (Refactoring y Testing)
▓▓ Sprint 2 (Integración y Despliegue)

Día 1  (Mi 01): 🏗️  Separación Backend/Frontend (CRÍTICO)
Día 2  (Ju 02): Testing PHP Completo - 115 tests
Día 3  (Vi 03): Migración Endpoint + CI/CD
Día 4  (Sa 04): Tests E2E Manuales
Día 5  (Do 05): Tests E2E Playwright
Día 6  (Lu 06): DESCANSO
Día 7  (Ma 07): DESCANSO
Día 8  (Mi 08): Validación Requisitos 1-4
Día 9  (Ju 09): Validación Requisitos 5-7
Día 10 (Vi 10): Despliegue Staging (Cloudflare)
Día 11 (Sa 11): Optimización y Monitoreo
Día 12 (Do 12): Documentación Final

🏗️  = Refactoring arquitectónico crítico
```

---

## ANEXOS

### Anexo A: Comandos Útiles

```bash
# Levantar entorno desarrollo
cd /var/www/html/hawaii/asistencia
podman-compose -f compose.yaml -f compose.dev.yaml up -d

# Ejecutar tests PHP
cd php-service
vendor/bin/phpunit --testdox

# Ejecutar tests Node.js
cd node-service
npm test

# Ejecutar tests E2E
cd node-service
npx playwright test

# Ver logs Node.js
podman logs -f asistencia-node

# Ver logs PHP
podman logs -f asistencia-php

# Conectar a PostgreSQL
podman exec -it asistencia-postgres psql -U asistencia_user -d asistencia

# Conectar a Valkey
podman exec -it asistencia-valkey redis-cli

# Reiniciar servicios
podman-compose restart

# Ver estado
podman ps
```

### Anexo B: Estructura de Branches Git

```
main
  ├── feature/php-testing (días 1-2)
  ├── feature/endpoint-migration (día 3)
  ├── feature/ci-cd (día 3)
  ├── feature/e2e-tests (días 4-5)
  ├── feature/requirements-validation (días 8-9)
  ├── feature/deployment (día 10)
  └── feature/optimization (día 11)
```

Merge a `main` al final de cada sprint tras code review.

### Anexo C: Variables de Entorno Requeridas

```bash
# Compartidas
JWT_SECRET=<min-32-chars>

# PHP Service
NODE_MODULE_ENABLED=true
JWT_SECRET_INTERNAL=<min-32-chars>
NODE_SERVICE_URL=http://node-service:3000

# Node Service
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=asistencia
DB_USER=asistencia_user
DB_PASSWORD=<secure-password>
VALKEY_HOST=valkey
VALKEY_PORT=6379
```

---

## CONCLUSIÓN

Este plan establece una ruta clara y estructurada para completar la implementación del nuevo sistema de asistencia Hawaii en 10 días hábiles. La estrategia prioriza:

1. **Calidad mediante Testing:** >115 tests PHP, >200 tests Node.js, tests E2E
2. **Automatización:** CI/CD desde día 3
3. **Validación rigurosa:** 7 requisitos funcionales verificados sistemáticamente
4. **Documentación exhaustiva:** Procedimientos de despliegue, operación y troubleshooting
5. **Aprendizaje práctico:** Uso de herramientas profesionales (GitHub Actions, Playwright, PHPUnit)

El éxito del proyecto se medirá no solo por la funcionalidad implementada, sino por la robustez del sistema evidenciada en tests automatizados, la facilidad de despliegue demostrada en staging, y la claridad de la documentación que permitirá mantenimiento futuro.

**Fecha de generación:** 31 diciembre 2024  
**Próxima revisión:** 1 enero 2025 (Kick-off Sprint 1)

---

**FIN DEL DOCUMENTO**
