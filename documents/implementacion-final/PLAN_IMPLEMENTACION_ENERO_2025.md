 Plan de Implementacion y Validacion del Sistema de Asistencia
Proyecto: Migración y Despliegue del Nuevo Sistema de Asistencia Hawaii 
Periodo: - de enero de  
Modalidad: Tiempo completo (:-:) 
Metodologia: Dos sprints de dias hábiles
---
 . CONTEXTO Y ALCANCE
 . Objetivo General
Completar la integración y despliegue del nuevo sistema de asistencia basado en códigos QR criptográficos, validando su correcto funcionamiento en un entorno aislado del sistema legacy Hawaii, cumpliendo con siete requisitos funcionales criticos.
 . Requisitos Funcionales a Validar
. Sistema Hawaii operando en version aislada propia
. Disponibilidad de opcion "marcar asistencia" para estudiantes
. Capacidad de profesores para "abrir" sesion de asistencia
. Registro exitoso de asistencia por parte de estudiantes mediante nuevo proceso
. Preservacion del flujo de encuestas post-asistencia
. Registro correcto en pantalla general de asistencia (dia y bloque)
. Validacion de duracion configurable del código de reserva
 . Matriz de Trazabilidad Requisitos -> Implementacion -> Validacion
| Req  | Descripción     | Componentes Clave            | Tests Unitarios  | Tests Integracion | Tests EE       | Validacion Manual | Evidencia Requerida        |
| ----- | ------------------- | ---------------------------------------- | ----------------- | ------------------ | --------------------- | ----------------- | ---------------------------------- |
| | Sistema aislado   | Apache config, compose.yaml, rutas    | N/A        | Config tests    | Health checks     | Checklist dia  | Screenshots + logs sin errores |
| | Opcion estudiante  | horario.php linea ~          | PHP session tests | Modal opening   | EE reader flow    | Checklist dia  | Screenshot boton + modal      |
| | Opcion profesor   | main_curso.php, can_tomar_asistencia()  | PHP auth tests  | Modal opening   | EE host flow     | Checklist dia  | Screenshot boton + QR proyectado  |
| | Registro asistencia | AttendanceService, TOTP validation    | + backend tests | DB insertion tests | EE scan + register  | Checklist dia  | Query SQL mostrando registro    |
| | Encuestas      | Redirect a asist.php, comentarios_clase | PHP form tests  | Redirect tests   | EE complete flow   | Checklist dia  | Query SQL en comentarios_clase   |
| | Pantalla general  | asist_lista.php, alumno_asistencia    | Query tests    | Display tests   | Manual verification  | Checklist dia  | Screenshot pantalla + query    |
| | Duracion QR     | TTL validation, fechahora_termino    | TOTP expiry tests | Expiry integration | Automated expiry test | Checklist dia  | Test automatizado + logs      |
Totales: tests PHP + tests Node + tests EE + validaciónes manuales
 . Stack Tecnologico
Backend:
- Node.js (Fastify) - Servicio principal de asistencia
- PHP .+ - Sistema legacy Hawaii y modulo de integración
- PostgreSQL - Base de datos relacional
- Valkey/Redis - Cache y gestion de sesiones
Frontend:
- Vite + TypeScript - Interfaz moderna de asistencia
- WebSocket - Comunicacion tiempo real para proyeccion QR
Infraestructura:
- Podman/Docker - Contenedores (produccion inicial)
- Apache . - Servidor web y proxy reverso
- Cloudflare Tunnel - Acceso HTTPS externo
- Kubernetes - Orquestacion avanzada (post-proyecto, opcional)
CI/CD:
- GitHub Actions - Automatizacion
- Vitest - Framework de testing
- PHPUnit - Testing PHP (a implementar)
 . Plan de Validacion por Requisito
 Requisito : Sistema Aislado
Criterios de Aceptacion SMART:
- [ ] Hawaii legacy en `/` responde HTTP en < segundos
- [ ] Modulo asistencia en `/asistencia/` responde HTTP en < segundo
- [ ] PHP integration en `/asistencia-node-integration/api/token` retorna JWT valido
- [ ] errores en logs de Apache durante hora de pruebas
- [ ] conflictos de esquema en PostgreSQL (constraints verificados)
Casos de Prueba:
. Acceder a `http://localhost/` -> Mostrar Hawaii legacy
. Acceder a `http://localhost/asistencia/health` -> `{"status":"ok"}`
. Consultar tabla `curso` desde Node.js -> Retornar datos
. Insertar en `alumno_asistencia` desde Node.js -> Sin errores FK
. Logs de Apache: `grep "" /var/log/httpd/error_log` -> Sin resultados
Evidencias:
- Screenshot de Hawaii legacy funcionando
- Screenshot de health check del modulo
- Query SQL exitosa desde Node.js
- Archivo de logs sin errores 
 Requisito : Opcion Estudiante
Criterios de Aceptacion SMART:
- [ ] Boton visible para usuarios con `$_SESSION['id'] == -`
- [ ] Boton NO visible para profesores (`$_SESSION['id'] != -`)
- [ ] Clic abre modal en < ms
- [ ] URL del iframe contiene `token=` con JWT valido ( partes separadas por `.`)
- [ ] Modal tiene titulo "Tomar Asistencia"
Casos de Prueba:
. Login como alumno (RUT ) -> Verificar boton visible
. Login como profesor -> Verificar boton NO visible
. Clic en boton -> Modal abierto en < ms
. Inspeccionar URL iframe -> `token=eyJhbGc...` (JWT valido)
. Verificar titulo modal -> "Tomar Asistencia"
Evidencias:
- Screenshot de horario.php con boton visible (alumno)
- Screenshot de horario.php sin boton (profesor)
- Screenshot de modal abierto con URL visible
- Video de interaccion completa
 Requisito : Opcion Profesor
Criterios de Aceptacion SMART:
- [ ] Boton visible en main_curso.php para profesores autorizados
- [ ] Funcion `can_tomar_asistencia($idCurso, $idSemestre)` retorna true
- [ ] Clic abre modal en < ms
- [ ] QR dinámico visible y cambia cada segundos (+- seg)
- [ ] WebSocket conectado (inspeccionar console: "WebSocket connected")
Casos de Prueba:
. Login como profesor asignado al curso -> Boton visible
. Login como profesor NO asignado -> Boton NO visible
. Clic en boton -> Modal abierto con QR
. Esperar segundos -> QR cambia (payload diferente)
. Inspeccionar console -> WebSocket activo sin errores
. Cerrar modal -> WebSocket desconectado
Evidencias:
- Screenshot de main_curso.php con boton
- Video de QR cambiando cada segundos
- Screenshot de console mostrando WebSocket activo
- Registro de sesion en `asistencia_curso` con código correcto
 Requisito : Registro Exitoso
Criterios de Aceptacion SMART:
- [ ] Escaneo de QR valido registra asistencia en < segundos
- [ ] Registro en `alumno_asistencia` con estado = (presente)
- [ ] Timestamp de `hora_marca` dentro de +- segundos de hora actual
- [ ] Validacion TOTP exitosa (código no expirado, no reutilizado)
- [ ] Restriccion IP validada correctamente (si aplica)
- [ ] Respuesta HTTP con mensaje de exito
Casos de Prueba:
. Profesor abre QR -> Alumno escanea dentro de min -> Registro exitoso
. Alumno intenta escanear QR expirado (> min) -> Error 
. Alumno intenta escanear mismo QR veces -> Error "Ya registrado"
. Alumno fuera de red UCN (si requerido) -> Error 
. Verificar en BD: `SELECT FROM alumno_asistencia WHERE rut=''`
Evidencias:
- Query SQL mostrando registro:
 ```sql
 SELECT aa., ac.fecha, ac.bloque, ac.código
 FROM alumno_asistencia aa
 JOIN asistencia_curso ac ON aa.curso = ac.curso
 WHERE aa.rut = ''
 AND aa.fecha = 
 ORDER BY aa.hora_marca DESC
 LIMIT ;
 ```
- Screenshot de mensaje de exito en UI
- Logs de backend mostrando validación TOTP
 Requisito : Encuestas
Criterios de Aceptacion SMART:
- [ ] Tras registro exitoso, redirect a `asist.php?c=<código>` en < segundo
- [ ] Formulario de encuesta correcto segun tipo (-)
- [ ] Estudiante puede completar sin re-autenticarse
- [ ] Submit guarda en `comentarios_clase` en < segundos
- [ ] Campos obligatorios validados antes de guardar
Casos de Prueba:
. Tipo : Verificar campos (nota, objetivos, puntualidad, comentario)
. Tipo : Verificar solo nota y comentario
. Tipo : One minute paper basico
. Tipo : One minute paper con positivo/negativo
. Completar encuesta -> Guardar -> Verificar en BD
Evidencias:
- Screenshot de cada tipo de encuesta
- Query SQL mostrando guardado:
 ```sql
 SELECT FROM comentarios_clase
 WHERE reserva_id = (SELECT id FROM asistencia_curso WHERE código = 'CVYAFO')
 ORDER BY timestamp DESC
 LIMIT ;
 ```
- Video de flujo completo: escaneo -> registro -> encuesta -> guardado
 Requisito : Pantalla General
Criterios de Aceptacion SMART:
- [ ] Asistencia aparece en `asist_lista.php` en < segundos tras registro
- [ ] Fecha correcta (formato )
- [ ] Bloque correcto (- segun tabla `bloque`)
- [ ] Estado = "Presente" (valor en BD)
- [ ] Sin duplicados para mismo alumno/fecha/bloque
- [ ] Relacion correcta con `asistencia_curso` via código
Casos de Prueba:
. Acceder a `asist_lista.php?c=&s=`
. Filtrar por fecha --
. Buscar RUT 
. Verificar aparece en bloque correcto
. Verificar estado "Presente"
. Refrescar pagina -> Sigue apareciendo (persistencia)
Evidencias:
- Screenshot de asist_lista.php mostrando registro
- Query SQL verificando relacion:
 ```sql
 SELECT a.nombre, aa.rut, aa.fecha, aa.bloque, aa.estado, ac.código
 FROM alumno_asistencia aa
 JOIN alumno a ON aa.rut = a.rut
 JOIN asistencia_curso ac ON aa.curso = ac.curso AND aa.fecha = ac.fecha AND aa.bloque = ac.bloque
 WHERE aa.rut = '' AND aa.fecha = ;
 ```
- Verificacion de no duplicados:
 ```sql
 SELECT rut, fecha, bloque, COUNT()
 FROM alumno_asistencia
 GROUP BY rut, fecha, bloque
 HAVING COUNT() > ;
 -- Debe retornar filas
 ```
 Requisito : Duracion Configurable
Criterios de Aceptacion SMART:
- [ ] TTL por defecto = minutos ( segundos)
- [ ] TTL configurable via BD (`fechahora_termino`)
- [ ] Validacion backend: `NOW() < fechahora_termino`
- [ ] Intento post-expiracion retorna HTTP 
- [ ] Mensaje de error: "Sesion de asistencia expirada"
- [ ] Test automatizado valida expiracion
Casos de Prueba:
. Crear reserva con TTL min -> Marcar dentro de min -> Exito
. Crear reserva con TTL min -> Esperar min -> Error 
. Crear reserva con TTL min -> Marcar a los min -> Exito
. Verificar calculo: `fechahora_termino - fechahora_inicio = minutes`
. Test automatizado con TTL segundos
Test Automatizado:
```typescript
test("Reserva expira segun TTL configurado", async () => {
 const session = await createSession({ ttl: });
 await sleep();
 const result = await markAttendance(session.code);
 expect(result.status).toBe();
 await sleep();
 const result = await markAttendance(session.code);
 expect(result.status).toBe();
 expect(result.data.error).toContain("expirada");
});
```
Evidencias:
- Test automatizado pasando
- Query SQL mostrando TTL:
 ```sql
 SELECT
  id, código, fechahora_inicio, fechahora_termino,
  EXTRACT(EPOCH FROM (fechahora_termino - fechahora_inicio)) as ttl_seconds
 FROM asistencia_curso WHERE id = ;
 ```
- Logs de backend mostrando rechazo por expiracion
- Screenshot de mensaje de error en UI
 . Documentacion de Evidencias
Estructura de Carpeta:
```
evidencias/
+-- req--sistema-aislado/
|  +-- screenshot-hawaii-legacy.png
|  +-- screenshot-health-check.png
|  +-- logs-apache-sin-errores.txt
|  +-- query-sql-esquema.sql
+-- req--opcion-estudiante/
|  +-- screenshot-boton-visible-alumno.png
|  +-- screenshot-boton-invisible-profesor.png
|  +-- screenshot-modal-abierto.png
|  +-- video-interaccion-completa.mp
+-- req--opcion-profesor/
|  +-- screenshot-boton-profesor.png
|  +-- video-qr-dinámico.mp
|  +-- screenshot-console-websocket.png
|  +-- query-sql-sesion-creada.sql
+-- req--registro-exitoso/
|  +-- query-sql-registro.sql
|  +-- screenshot-mensaje-exito.png
|  +-- logs-validación-totp.txt
+-- req--encuestas/
|  +-- screenshot-encuesta-tipo.png
|  +-- screenshot-encuesta-tipo.png
|  +-- query-sql-comentarios.sql
|  +-- video-flujo-completo.mp
+-- req--pantalla-general/
|  +-- screenshot-asist-lista.png
|  +-- query-sql-relacion.sql
|  +-- query-sql-sin-duplicados.sql
+-- req--duracion-qr/
|  +-- test-automatizado-resultado.txt
|  +-- query-sql-ttl.sql
|  +-- logs-rechazo-expiracion.txt
|  +-- screenshot-error-expirado.png
+-- resumen-validación.md
```
resumen-validación.md:
```markdown
 Resumen de Validacion de Requisitos
Fecha: [FECHA]
Ambiente: Staging (mantochrisal.cl)
Validador: [NOMBRE]
 Estado General
| Requisito      | Estado | Tests Pasados | Evidencias | Observaciones   |
| -------------------- | ------- | ------------- | ---------- | ------------------ |
| . Sistema Aislado  | PASS | /      | archivos | Sin errores   |
| . Opcion Estudiante | PASS | /      | archivos | Modal < ms   |
| . Opcion Profesor  | PASS | /      | archivos | QR cambia c/s  |
| . Registro Exitoso | PASS | /      | archivos | Registro < s   |
| . Encuestas     | PASS | /      | archivos | Todos los tipos OK |
| . Pantalla General | PASS | /      | archivos | Sin duplicados   |
| . Duracion QR    | PASS | /      | archivos | Test automatizado |
TOTAL: / requisitos APROBADOS
```
---
 . DIAGNOSTICO TECNICO
 . Estado Actual del Sistema
 Componentes Implementados
Frontend:
- Interfaz de lector QR (alumno): `/asistencia/features/qr-reader/index.html`
- Interfaz de host QR (profesor): `/asistencia/features/qr-host/index.html`
- Sistema de autenticacion via postMessage y JWT
- Integracion mediante iframes en horario.php
Backend Node.js:
- Arquitectura modular DDD completa ( modulos)
- Sistema de autenticacion JWT bidireccional
- Generacion de QR con TOTP criptográfico
- WebSocket para proyeccion en tiempo real
- + tests unitarios e integración implementados
Backend PHP:
- Modulo `asistencia-node-integration` completo
 - AuthenticationService con generacion JWT
 - Biblioteca JWT sin dependencias
 - Adaptadores para sesiones legacy
 - API REST para consulta de datos
 - Vistas de modal integradas
Endpoint Legacy:
- `api_get_asistencia_token.php` - Genera JWT manualmente (a deprecar)
 Estado de Testing
| Componente    | Tests | Estado     | Cobertura |
| ----------------- | ----- | --------------- | --------- |
| Auth (Node)    |   | Aprobados    | %    |
| Attendance (Node) |   | Aprobados    | %    |
| Session (Node)  |   | Aprobados    | %    |
| Enrollment (Node) |  | Aprobados    | %    |
| Access (Node)   |   | Aprobados    | %    |
| Shared (Node)   |   | Aprobados    | -     |
| PHP Service  |   | Sin implementar | %    |
Total Node.js: tests aprobados
 . Gaps Identificados
 Criticos (Bloquean requisitos funcionales)
. Arquitectura Incorrecta: Backend en Proyecto Vite
  - Estado: Backend Node.js y Frontend mezclados en mismo proyecto
  - Impacto:
   - Vite no esta disenado para bundlear backend
   - Confusion entre concerns de frontend y backend
   - Dificulta despliegue independiente
   - Complejidad innecesaria en build process
  - Requisito afectado: (sistema aislado), mantenibilidad general
  - Solucion: Separar en dos proyectos independientes
. Endpoint de Token no Migrado
  - Estado: `api_get_asistencia_token.php` aun en uso
  - Impacto: No se utiliza el modulo PHP de integración
  - Requisito afectado: Todos (base de autenticacion)
. Sin Testing PHP
  - Estado: tests para el modulo de integración
  - Impacto: No hay validación de generacion JWT en PHP
  - Requisito afectado: , (autenticacion de profesor y alumno)
. Configuracion de Despliegue Incompleta
  - Estado: Variables de entorno no documentadas para produccion
  - Impacto: Despliegue manual propenso a errores
  - Requisito afectado: (sistema aislado)
. Sin Validacion End-to-End
  - Estado: No hay tests que validen flujo completo profesor->alumno
  - Impacto: No se garantiza funcionamiento integrado
  - Requisito afectado: , , , , 
 Importantes (Mejoran calidad y mantenibilidad)
. CI/CD Inexistente
  - Estado: No hay pipeline automatizado
  - Impacto: Verificacion manual en cada cambio
  - Requisito afectado: Ninguno directamente
. Documentacion de Despliegue Fragmentada
  - Estado: Informacion dispersa en multiples archivos
  - Impacto: Complejidad en replicar entorno
  - Requisito afectado: 
. Monitoreo de Reservas
  - Estado: No hay validación automatica de duracion de QR
  - Impacto: Requisito no verificable sistematicamente
  - Requisito afectado: 
 . Solucion: Separacion de Proyectos Backend/Frontend
 Problema Actual
El proyecto `node-service` actual mezcla backend (Fastify + WebSocket) y frontend (Vite + TypeScript) en un mismo repositorio con configuración compartida:
```
node-service/
+-- src/
|  +-- backend/     Backend Fastify
|  +-- frontend/    Frontend Vite
|  +-- shared/     Compartido (?backend o frontend?)
+-- vite.config.ts    Configuracion Vite (solo frontend)
+-- tsconfig.json    TypeScript (backend + frontend)
+-- package.json     Dependencias mezcladas
```
Problemas:
- Vite bundlea frontend pero el backend se compila con `tsc`
- Scripts confusos: `npm run dev` ejecuta ambos con `concurrently`
- Dependencias mezcladas (Fastify + Vite en mismo `package.json`)
- Testing ambiguo (Vitest para ambos)
- Despliegue complejo (dos artefactos en un build)
 Estructura Propuesta
Separar en dos proyectos independientes:
```
asistencia/
+-- backend/           Proyecto Node.js/Fastify puro
|  +-- src/
|  |  +-- modules/      Modulos DDD (auth, attendance, etc)
|  |  +-- shared/       Infraestructura (DB, cache)
|  |  +-- middleware/     Middlewares Fastify
|  |  +-- app.ts       Composicion Fastify
|  |  +-- index.ts      Entry point
|  +-- tests/         Tests unitarios e integración
|  +-- tsconfig.json      TypeScript backend
|  +-- package.json      Solo deps backend
|  +-- Containerfile      Imagen backend
|
+-- frontend/          Proyecto Vite puro
|  +-- src/
|  |  +-- features/      QR reader, QR host
|  |  +-- shared/       Auth, WebSocket, utils
|  |  +-- types/       TypeScript types
|  +-- public/         Assets estaticos
|  +-- index.html       Entry points
|  +-- vite.config.ts     Configuracion Vite
|  +-- tsconfig.json      TypeScript frontend
|  +-- package.json      Solo deps frontend
|  +-- Containerfile      Imagen frontend (nginx)
|
+-- php-service/        Servicio PHP (sin cambios)
+-- compose.yaml        Orquestacion de servicios
```
 Beneficios de la Separacion
. Claridad de Responsabilidades:
  - Backend: API REST + WebSocket + logica de negocio
  - Frontend: UI + interaccion usuario + escaneo QR
. Build Independiente:
  - Backend: `tsc` compila a `dist/` -> imagen Node.js
  - Frontend: `vite build` compila a `dist/` -> imagen Nginx
. Deploy Independiente:
  - Escalar backend y frontend por separado
  - Actualizar uno sin afectar al otro
  - CDN para frontend (assets estaticos)
. Testing Simplificado:
  - Backend: Vitest para logica de negocio
  - Frontend: Vitest + Playwright para UI
  - Sin confusion de contextos
. Desarrollo Paralelo:
  - Equipos frontend/backend pueden trabajar independientemente
  - Contratos de API claros (OpenAPI/Swagger)
 Plan de Migración
Dia . (Agregado al inicio del Sprint ):
. Crear estructura de directorios ( hora)
  ```bash
  mkdir -p asistencia-backend asistencia-frontend
  ```
. Mover código backend (. horas)
  - Copiar `src/backend/` -> `asistencia-backend/src/modules/`
  - Copiar `src/shared/infrastructure/` -> `asistencia-backend/src/shared/`
  - Copiar `src/middleware/` -> `asistencia-backend/src/middleware/`
  - Copiar `src/app.ts` y `src/index.ts`
  - Extraer deps backend de `package.json`
  - Crear `tsconfig.json` especifico backend
. Mover código frontend (. horas)
  - Copiar `src/frontend/` -> `asistencia-frontend/src/`
  - Copiar `vite.config.ts`
  - Extraer deps frontend de `package.json`
  - Crear `tsconfig.json` especifico frontend
  - Actualizar paths de imports
. Actualizar configuración ( hora)
  - Crear `Containerfile` para backend (Node.js base)
  - Crear `Containerfile` para frontend (nginx base)
  - Actualizar `compose.yaml` con servicios:
   - `backend`: puerto 
   - `frontend`: puerto (nginx)
   - `php-service`: puerto 
  - Configurar proxy en nginx para servir frontend
. Actualizar scripts CI/CD ( hora)
  - Separar workflows: `.github/workflows/backend.yml` y `frontend.yml`
  - Tests backend y frontend independientes
  - Builds separados
. Validar funcionamiento ( hora)
  ```bash
  Backend
  cd asistencia-backend
  npm install
  npm run dev
  curl http://localhost:/asistencia/health
  Frontend
  cd asistencia-frontend
  npm install
  npm run dev
  Abrir http://localhost:
  Integracion
  podman-compose up -d
  curl http://localhost/asistencia/features/qr-reader/
  ```
Total tiempo: horas (agregadas al dia )
 Configuracion Post-Separacion
Backend `package.json`:
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
  "fastify": "..",
  "@fastify/websocket": "..",
  "ioredis": "..",
  "pg": "^..",
  "jsonwebtoken": "^..",
  "otplib": "^..",
  "qrcode": "^.."
 }
}
```
Frontend `package.json`:
```json
{
 "name": "asistencia-frontend",
 "scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:ee": "playwright test"
 },
 "dependencies": {
  "@zxing/browser": "^..",
  "@zxing/library": "^.."
 },
 "devDependencies": {
  "vite": "^..",
  "@playwright/test": "^.."
 }
}
```
Frontend Containerfile (nginx):
```dockerfile
FROM node:-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 
```
 . Estado Deseado
 Arquitectura Objetivo
```
+-------------------------------------------------------------+
|           SISTEMA HAWAII LEGACY          |
| +--------------------------------------------------------+ |
| | horario.php                      | |
| | - Boton "Tomar Asistencia" (estudiante)       | |
| | - Boton "Abrir Asistencia" (profesor)        | |
| | - Boton "Nuevo Sistema de Asistencia" (profesor)   | |
| +--------------+-----------------------------------------+ |
|         | Solicita JWT                |
|                               |
| +--------------------------------------------------------+ |
| | PHP Integration Service                | |
| | /asistencia-node-integration/api/token        | |
| | - AuthenticationService.generateToken()        | |
| | - JWT.encode() con secret compartido         | |
| | - LegacySessionAdapter (sesiones PHP)         | |
| +--------------+-----------------------------------------+ |
+-----------------+---------------------------------------------+
         | Retorna JWT
         ?
+-------------------------------------------------------------+
|       FRONTEND ASISTENCIA (Vite + TS)         |
| +--------------------------------------------------------+ |
| | Iframe en Hawaii                    | |
| | - qr-reader (alumno): Escanea QR + envia asistencia | |
| | - qr-host (profesor): Proyecta QR dinámico      | |
| | - Autenticacion via postMessage + JWT         | |
| +--------------+-----------------------------------------+ |
+-----------------+---------------------------------------------+
         | HTTP + WebSocket
         ?
+-------------------------------------------------------------+
|       BACKEND NODE.JS (Fastify)            |
| +--------------------------------------------------------+ |
| | Modulos DDD                       | |
| | - auth: Verifica JWT, extrae userId          | |
| | - qr-projection: Genera QR TOTP + WebSocket      | |
| | - attendance: Valida y registra asistencia      | |
| | - session: Gestiona sesiones de asistencia      | |
| | - enrollment: FIDO (futuro)              | |
| +---------+----------------------------------------------+ |
|      |                         |
|      +--PostgreSQL (asistencia_curso, alumno_)   |
|      +--Valkey (sesiones activas, pools QR)     |
+-------------------------------------------------------------+
```
 Flujos Funcionales Validados
Flujo Profesor (Requisitos , , , ):
. Profesor accede a `horario.php` autenticado
. Clic en "Nuevo Sistema de Asistencia"
. Sistema legacy solicita JWT a `/asistencia-node-integration/api/token`
. Se abre iframe con `qr-host` + JWT en URL
. Frontend valida JWT y establece WebSocket
. Backend genera sesion de asistencia en PostgreSQL
. QR dinámico se proyecta via WebSocket cada segundos
. Reserva expira automaticamente segun configuración ( min default)
. Asistencia visible en pantalla general con dia/bloque correctos
Flujo Estudiante (Requisitos , , ):
. Estudiante accede a `horario.php` autenticado
. Clic en "Tomar Asistencia"
. Sistema legacy solicita JWT a `/asistencia-node-integration/api/token`
. Se abre iframe con `qr-reader` + JWT en URL
. Frontend escanea QR proyectado por profesor
. Backend valida TOTP, sesion activa, restricciones IP
. Asistencia registrada en `alumno_asistencia`
. Estudiante redirigido a encuesta segun tipo de asistencia
. Respuestas guardadas en `comentarios_clase`
 Criterios de Aceptacion Tecnicos
. Sistema Aislado:
  - Hawaii legacy funciona sin modificaciones en rutas criticas
  - Modulo de asistencia accesible via subdirectorio `/asistencia`
  - Base de datos compartida con esquema independiente
. Autenticacion:
  - JWT valido por minutos
  - Secret compartido identico en PHP y Node.js
  - userId consistente entre servicios
. Registro de Asistencia:
  - Insercion en `alumno_asistencia` con estado correcto (=presente)
  - Relacion con `asistencia_curso` mediante código de reserva
  - Timestamp exacto de marca
. Encuestas:
  - Redireccion a `asist.php` con parametros correctos
  - Preservacion de tipo de encuesta (tipos -)
  - Persistencia en `comentarios_clase`
. Duracion de Reserva:
  - TTL configurable en base de datos (`fechahora_termino`)
  - Validacion en backend antes de aceptar asistencia
  - Limpieza automatica de reservas expiradas
. Testing:
  - % de tests unitarios PHP del modulo de integración
  - Tests de integración para flujos criticos
  - Cobertura minima % en componentes nuevos
. CI/CD:
  - Pipeline que ejecuta tests en cada push
  - Validacion de build exitoso antes de merge
  - Reporte de cobertura automatico
---
 . PLAN DE TRABAJO
 . Estructura de Sprints
Sprint : Fundamentos y Testing (- enero) 
Sprint : Integracion y Despliegue (- enero)
 . Metodologia de Trabajo
Horario: :-: ( horas efectivas)
- :-:: Planificacion diaria y revision de blockers
- :-:: Sesion de desarrollo matutina
- :-:: Pausa almuerzo
- :-:: Sesion de desarrollo vespertina
- :-:: Retrospectiva diaria y commit de avances
Principios:
- Commits atomicos al finalizar cada tarea
- Tests antes de implementación (TDD cuando sea posible)
- Documentacion inline y actualizacion de README
- Code review automatico via CI/CD
 . Sprint : Fundamentos y Testing (- enero)
Objetivo: Establecer bases solidas de testing, migrar endpoint critico, implementar CI/CD basico.
 Dia (Miercoles): Separacion Arquitectonica y Testing PHP Base
Horas: h (dia extendido por refactoring critico)
| Hora    | Actividad                    | Entregable         |
| ----------- | ----------------------------------------------- | --------------------------- |
| :-:  | Kick-off sprint, revision de entorno      | Checklist de prerequisitos |
| :-: | Crear estructura backend/frontend separados   | Directorios creados     |
| :-: | Migrar código backend a proyecto independiente | Backend separado funcional |
| :-: | Migrar código frontend a proyecto independiente | Frontend separado funcional |
| :-: | Actualizar Containerfiles y compose.yaml    | servicios orquestados   |
| :-: | Validar funcionamiento post-separacion     | Health checks ok      |
| :-: | Instalacion PHPUnit en php-service       | Configuracion `phpunit.xml` |
| :-: | Tests unitarios `JWT.php` (inicio)       | Setup de testing      |
Nota: Los tests PHP se completan en dias subsiguientes. La separacion arquitectonica es critica y tiene prioridad.
Tareas Detalladas:
. Separar Backend del Proyecto Vite (CRITICO - horas):
  a. Crear estructura de directorios:
  ```bash
  cd /var/www/html/hawaii/asistencia
  mkdir -p backend/src/{modules,shared,middleware}
  mkdir -p frontend/src/{features,shared,types}
  ```
  b. Migrar backend:
  ```bash
  Copiar modulos de dominio
  cp -r node-service/src/backend/ backend/src/modules/
  cp -r node-service/src/shared/infrastructure backend/src/shared/
  cp -r node-service/src/middleware backend/src/middleware/
  cp node-service/src/{app.ts,index.ts} backend/src/
  Extraer dependencias backend
  cd backend
  npm init -y
  npm install fastify @fastify/websocket ioredis pg jsonwebtoken otplib qrcode
  npm install -D typescript tsx @types/node @types/pg @types/jsonwebtoken
  npm install -D vitest @vitest/coverage-v
  Crear vitest.config.ts para backend
  cat > vitest.config.ts << 'EOF'
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
   test: {
    globals: true,
    environment: 'node',
    coverage: {
     provider: 'v',
     reporter: ['text', 'html', 'lcov'],
     exclude: ['node_modules/', 'dist/', '/.test.ts']
    }
   }
  });
  EOF
  Crear tsconfig.json backend
  cat > tsconfig.json << 'EOF'
  {
   "compilerOptions": {
    "target": "ES",
    "module": "Node",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
   },
   "include": ["src//"],
   "exclude": ["node_modules", "dist"]
  }
  EOF
  ```
  c. Migrar frontend:
  ```bash
  cd /var/www/html/hawaii/asistencia
  cp -r node-service/src/frontend/ frontend/src/
  cp node-service/vite.config.ts frontend/
  cd frontend
  npm init -y
  npm install @zxing/browser @zxing/library
  npm install -D vite typescript @playwright/test
  Actualizar vite.config.ts con paths corregidos
  ```
  d. Actualizar compose.yaml:
  ```yaml
  services:
   backend:
    build: ./backend
    ports:
     - ":"
    environment:
     - NODE_ENV=production
     - DB_HOST=postgres
     - VALKEY_HOST=valkey
   frontend:
    build: ./frontend
    ports:
     - ":"
   php-service:
    build: ./php-service
    ports:
     - ":"
  ```
  e. Validar:
  ```bash
  Backend
  cd backend && npm run dev
  curl http://localhost:/asistencia/health
  Frontend
  cd frontend && npm run dev
  Verificar http://localhost:
  ```
. Configurar PHPUnit:
  ```bash
  cd /var/www/html/hawaii/asistencia/php-service
  composer require --dev phpunit/phpunit
  ```
  Crear `phpunit.xml` con configuración de directorios y coverage.
. Tests JWT.php (completar desde dia ):
  - Validar `encode()` con payload simple
  - Validar `decode()` con token valido
  - Verificar expiracion de tokens
  - Verificar firma invalida rechazada
  - Verificar formato de token (estructura header.payload.signature)
  - Meta: tests completos
. Tests AuthenticationService:
  - Generacion exitosa con sesion profesor
  - Generacion exitosa con sesion alumno
  - Validacion de userId consistente (CRC para alumnos)
  - Manejo de sesion inexistente
  - Validacion de TTL ( segundos)
  - Verificacion de campos JWT (iss, aud, exp, iat)
. Tests LegacySessionAdapter:
  - Lectura de `$_SESSION['id']` y `$_SESSION['user']`
  - Distincion profesor vs alumno (`id == -`)
  - Metodo `isProfesor()` retorna correctamente
  - Metodo `isAlumno()` retorna correctamente
  - Generacion de `userId` con CRC
 Dia (Jueves): Testing PHP Avanzado y Mocks
Horas: h
| Hora    | Actividad              | Entregable              |
| ----------- | ----------------------------------- | ------------------------------------ |
| :-:  | Stand-up, revision tests dia    | -                  |
| :-: | Tests `NodeServiceClient` con mocks | + tests de comunicacion HTTP    |
| :-: | Tests controladores API       | + tests por controlador ( total) |
| :-: | Tests de integración Router     | + tests de routing         |
| :-: | Reporte de cobertura PHP      | HTML coverage report >%      |
| :-: | Retrospectiva, commit        | + tests adicionales        |
Tareas Detalladas:
. Tests NodeServiceClient:
  - Mock de cURL para evitar llamadas reales
  - Validacion de headers (Authorization, Content-Type)
  - Manejo de respuestas exitosas ()
  - Manejo de errores HTTP (, )
  - Timeout de conexion
. Tests Controladores:
  - `UserDataController`: Mock de sesion, validación de respuesta JSON
  - `CourseDataController`: Mock de `get_def_curso()`, validación de campos
  - `EnrollmentDataController`: Mock de estudiantes inscritos
. Tests Router:
  - Mapeo correcto de rutas a handlers
  - Respuesta para rutas no existentes
  - Headers CORS configurados
  - Manejo de metodos HTTP (GET, POST, OPTIONS)
. Cobertura:
  ```bash
  phpunit --coverage-html coverage/
  ```
  Verificar >% de cobertura en archivos criticos.
 Dia (Viernes): Migración de Endpoint y CI/CD Base
Horas: h
| Hora    | Actividad                     | Entregable           |
| ----------- | ------------------------------------------------- | ------------------------------- |
| :-:  | Stand-up                     | -                |
| :-: | Migrar `api_get_asistencia_token.php` al modulo  | Endpoint `/api/token` funcional |
| :-: | Actualizar `horario.php` para usar nuevo endpoint | Integracion completa      |
| :-: | Configurar GitHub Actions workflow        | `.github/workflows/test.yml`  |
| :-: | Configurar checks automaticos (linting, tests)  | Pipeline ejecutandose      |
| :-: | Retrospectiva, commit               | Endpoint migrado + CI/CD basico |
Tareas Detalladas:
. Migración de Endpoint:
  - Modificar `horario.php` lineas ~-:
   ```javascript
   // ANTES:
   $.get('api_get_asistencia_token.php', function(response) { ... });
   // DESPUES:
   $.get('asistencia-node-integration/api/token', function(response) { ... });
   ```
  - Verificar mismás propiedades en respuesta: `success`, `token`, `expiresIn`, `userId`, `username`
  - Agregar comentario de deprecacion en `api_get_asistencia_token.php`
. GitHub Actions Workflow:
  ```yaml
  name: Test Suite
  on: [push, pull_request]
  jobs:
   test-php:
    runs-on: ubuntu-latest
    steps:
     - uses: actions/checkout@v
     - uses: shivammathur/setup-php@v
      with:
       php-version: "."
     - run: cd php-service && composer install
     - run: cd php-service && vendor/bin/phpunit
   test-node:
    runs-on: ubuntu-latest
    steps:
     - uses: actions/checkout@v
     - uses: actions/setup-node@v
      with:
       node-version: ""
     - run: cd node-service && npm ci
     - run: cd node-service && npm test
  ```
. Linting:
  - PHP CS Fixer para estandares PSR-
  - ESLint para código TypeScript
 Dia (Sabado): Tests End-to-End Manuales
Horas: h
| Hora    | Actividad            | Entregable           |
| ----------- | ------------------------------- | ------------------------------ |
| :-:  | Stand-up            | -               |
| :-: | Levantar entorno completo local | Contenedores corriendo     |
| :-: | Test manual flujo profesor   | Checklist funcional profesor  |
| :-: | Test manual flujo estudiante  | Checklist funcional estudiante |
| :-: | Documentar casos de prueba   | Documento test-cases.md    |
| :-: | Retrospectiva, commit      | Casos de prueba documentados  |
Tareas Detalladas:
. Entorno Local:
  ```bash
  cd /var/www/html/hawaii/asistencia
  podman-compose -f compose.yaml -f compose.dev.yaml up -d
  ```
  Verificar servicios:
  - PHP service: puerto 
  - Node service: puerto (interno)
  - PostgreSQL: puerto 
  - Valkey: puerto 
. Checklist Flujo Profesor:
  - [ ] Login exitoso en Hawaii
  - [ ] Acceso a horario.php
  - [ ] Clic en "Nuevo Sistema de Asistencia"
  - [ ] Modal se abre con iframe
  - [ ] JWT presente en URL del iframe
  - [ ] QR dinámico visible (cambia cada seg)
  - [ ] Registro en `asistencia_curso` con código correcto
  - [ ] WebSocket activo (inspeccionar console)
  - [ ] Al cerrar modal, sesion finaliza
. Checklist Flujo Estudiante:
  - [ ] Login exitoso en Hawaii (alumno)
  - [ ] Acceso a horario.php
  - [ ] Clic en "Tomar Asistencia"
  - [ ] Modal se abre con lector QR
  - [ ] Escaneo de QR proyectado por profesor
  - [ ] Validacion TOTP exitosa
  - [ ] Registro en `alumno_asistencia`
  - [ ] Redireccion a encuesta (asist.php)
  - [ ] Envio de encuesta guarda en `comentarios_clase`
. Documentacion:
  Crear `test-cases.md` con cada paso, screenshots esperados, y queries SQL de verificacion.
 Dia (Domingo): Tests Automatizados EE con Playwright
Horas: h
| Hora    | Actividad            | Entregable        |
| ----------- | -------------------------------- | ------------------------ |
| :-:  | Stand-up             | -            |
| :-: | Configurar Playwright      | `playwright.config.ts`  |
| :-: | Test EE: Generacion de JWT   | Test automatizado    |
| :-: | Test EE: Proyeccion QR profesor | Test automatizado    |
| :-: | Test EE: Escaneo QR alumno   | Test automatizado    |
| :-: | Retrospectiva sprint , commit  | + tests EE funcionando |
Tareas Detalladas:
. Configuracion Playwright:
  ```bash
  npm install -D @playwright/test
  npx playwright install
  ```
  Configurar `playwright.config.ts` con:
  - Base URL: `http://localhost:`
  - Timeout: segundos
  - Viewport: x
  - Screenshots en fallo
. Test EE JWT:
  ```typescript
  test("Profesor obtiene JWT valido", async ({ page }) => {
   await page.goto("/horario.php");
   await page.fill("auth-user", "profesor@ucn.cl");
   await page.fill("auth-passwd", "password");
   await page.click("auth-go");
   await page.click("main_curso_nuevo_sistema_asistencia");
   const iframe = await page.frameLocator("asistencia-iframe");
   const url = await iframe.page().url();
   expect(url).toContain("token=");
   const token = new URLSearchParams(url.split("?")[]).get("token");
   expect(token).toBeTruthy();
   // Verificar estructura JWT
   const parts = token.split(".");
   expect(parts).toHaveLength();
  });
  ```
. Test EE Proyeccion QR:
  - Abrir modal profesor
  - Esperar conexion WebSocket
  - Verificar aparicion de QR en canvas
  - Esperar segundos y verificar cambio de QR
  - Validar payload TOTP
. Test EE Escaneo:
  - Abrir dos contextos de navegador (profesor y alumno)
  - Profesor proyecta QR
  - Alumno escanea QR (simular captura)
  - Verificar llamada HTTP POST a `/attendance/mark`
  - Verificar redireccion a encuesta
 Retrospectiva Sprint 
Logros Esperados:
- + tests PHP implementados (>% cobertura)
- Endpoint `api_get_asistencia_token.php` migrado completamente
- CI/CD basico con GitHub Actions
- + tests EE automatizados con Playwright
- Documentacion de casos de prueba
M�tricas:
- Tests PHP: aprobados
- Tests Node.js: aprobados (preexistentes)
- Tests EE: aprobados
- Cobertura PHP: >%
- Cobertura Node.js: >%
---
 . Sprint : Integracion y Despliegue (- enero)
Objetivo: Validar requisitos funcionales completos, desplegar en staging, documentar procedimientos.
 Dia (Miercoles): Validacion de Requisitos -
Horas: h
| Hora    | Actividad                 | Entregable       |
| ----------- | ----------------------------------------- | ----------------------- |
| :-:  | Kick-off sprint             | -            |
| :-: | Validar requisito (sistema aislado)   | Checklist aprobado   |
| :-: | Validar requisito (opcion estudiante)  | Checklist aprobado   |
| :-: | Validar requisito (opcion profesor)   | Checklist aprobado   |
| :-: | Validar requisito (registro asistencia) | Checklist + queries SQL |
| :-: | Retrospectiva, commit           | requisitos validados |
Tareas Detalladas:
. Requisito : Sistema Aislado
  - [ ] Hawaii legacy responde en `/` sin modificaciones criticas
  - [ ] Modulo asistencia accesible en `/asistencia`
  - [ ] PHP integration en `/asistencia-node-integration`
  - [ ] Base de datos compartida sin conflictos de esquema
  - [ ] Consulta a tablas legacy (`curso`, `semestre`) funciona desde Node
  - [ ] Logs de Apache no muestran errores 
. Requisito : Opcion Estudiante
  - [ ] Boton "Tomar Asistencia" visible en horario.php
  - [ ] Visible solo para usuarios con `$_SESSION['id'] == -`
  - [ ] Clic abre modal con iframe
  - [ ] URL del iframe: `/asistencia/features/qr-reader/index.html?token=...`
  - [ ] Modal tiene titulo "Tomar Asistencia"
. Requisito : Opcion Profesor
  - [ ] Boton "Nuevo Sistema de Asistencia" visible en main_curso.php
  - [ ] Visible solo para profesores con `can_tomar_asistencia()`
  - [ ] Clic abre modal con iframe
  - [ ] URL del iframe: `/asistencia/features/qr-host/index.html?token=...`
  - [ ] Modal tiene titulo "Proyeccion de Asistencia"
. Requisito : Registro Exitoso
  - [ ] Estudiante escanea QR del profesor
  - [ ] Frontend envia POST a `/asistencia/api/attendance/mark`
  - [ ] Backend valida TOTP (token no expirado)
  - [ ] Validacion de restriccion IP (si aplicable)
  - [ ] Insercion en `alumno_asistencia`:
   ```sql
   INSERT INTO alumno_asistencia
    (rut, curso, semestre, fecha, bloque, estado, hora_marca)
   VALUES
    ('', , , , , , '-- ::');
   ```
  - [ ] Estado = (presente)
  - [ ] Timestamp correcto (hora actual)
  - [ ] Relacion con `asistencia_curso` via código de reserva
  - [ ] Respuesta HTTP al frontend
  - [ ] Mensaje de exito en UI
 Dia (Jueves): Validacion de Requisitos - y Ajustes
Horas: h
| Hora    | Actividad               | Entregable         |
| ----------- | -------------------------------------- | --------------------------- |
| :-:  | Stand-up                | -              |
| :-: | Validar requisito (encuestas)    | Checklist + verificacion DB |
| :-: | Validar requisito (pantalla general) | Screenshots + queries    |
| :-: | Validar requisito (duracion QR)   | Tests automatizados     |
| :-: | Ajustes y correcciones identificadas  | Commits de fixes      |
| :-: | Retrospectiva, commit         | requisitos validados   |
Tareas Detalladas:
. Requisito : Preservacion de Encuestas
  - [ ] Tras marcar asistencia, frontend redirige a `asist.php?c=<código>`
  - [ ] Parametro `c` es el código de reserva
  - [ ] `asist.php` muestra formulario segun `tipo` de asistencia
  - [ ] Tipos soportados: , , , , , 
  - [ ] Estudiante puede completar encuesta sin re-autenticarse
  - [ ] Submit guarda en `comentarios_clase`:
   ```sql
   INSERT INTO comentarios_clase
    (reserva_id, rut, tipo, nota, comentario, timestamp)
   VALUES
    (, '', , , 'Clase excelente', now());
   ```
  - [ ] Mensaje de confirmacion al estudiante
. Requisito : Pantalla General de Asistencia
  - [ ] Acceso a `asist_lista.php?c=<idCurso>&s=<idSemestre>`
  - [ ] Tabla muestra todas las fechas de asistencia
  - [ ] Columnas: RUT, Nombre, Fecha, Bloque, Estado
  - [ ] Filtrar por fecha especifica (--)
  - [ ] Verificar asistencia recien marcada aparece
  - [ ] Bloque correcto (segun `asistencia_curso.bloque`)
  - [ ] Estado = "Presente" (valor )
  - [ ] Sin duplicados para mismo alumno/fecha/bloque
. Requisito : Duracion de Reserva
  - Configurar reserva con minutos:
   ```sql
   UPDATE asistencia_curso
   SET fechahora_termino = fechahora_inicio + interval ' minutes'
   WHERE id = ;
   ```
  - [ ] Intentar marcar asistencia dentro de minutos: exito
  - [ ] Intentar marcar asistencia después de minutos: error 
  - [ ] Mensaje de error: "Sesion de asistencia expirada"
  - [ ] Backend valida `NOW() < fechahora_termino`
  - Test automatizado:
   ```typescript
   test("Reserva expira tras TTL configurado", async () => {
    // Crear reserva con TTL segundos
    // Esperar segundos
    // Intentar marcar asistencia
    // Expect HTTP 
   });
   ```
. Ajustes Identificados:
  - Corregir timezone en PostgreSQL (UTC vs local)
  - Agregar indices en `alumno_asistencia(rut, fecha, bloque)`
  - Mejorar mensajes de error en frontend
  - Agregar logging de eventos criticos
 Dia (Viernes): Preparacion de Despliegue y Documentacion
Horas: h
| Hora    | Actividad               | Entregable        |
| ----------- | -------------------------------------- | ------------------------- |
| :-:  | Stand-up                | -             |
| :-: | Documentar procedimiento de despliegue | `DEPLOYMENT.md`      |
| :-: | Crear scripts de configuración     | `deploy.sh`, `.env.prod` |
| :-: | Preparar checklist pre-despliegue   | `PRE_DEPLOY_CHECKLIST.md` |
| :-: | Validar secrets y configuraciónes   | Archivo `.env` verificado |
| :-: | Retrospectiva, commit         | Documentacion completa  |
Tareas Detalladas:
. DEPLOYMENT.md:
  ```markdown
  Procedimiento de Despliegue - Sistema de Asistencia
  Pre-requisitos
  - Servidor con Apache ., PHP .+, PostgreSQL +
  - Acceso SSH con sudo
  - Cloudflare Tunnel configurado
  - Dominio: mantochrisal.cl apuntando al tunnel
  Pasos
  . Clonar repositorio
  git clone <repo> /var/www/html/hawaii/asistencia
  cd /var/www/html/hawaii/asistencia
  . Configurar variables de entorno
  cp .env.example .env
  Editar .env con valores de produccion
  . Generar secrets
  openssl rand -base > jwt_secret.txt
  Copiar valor a .env JWT_SECRET
  Copiar mismo valor a sistema legacy
  . Levantar servicios
  podman-compose -f compose.yaml -f compose.prod.yaml up -d
  . Verificar salud
  curl http://localhost:/asistencia/health
  Expect: {"status":"ok"}
  . Configurar Apache
  Copiar asistencia.conf a /etc/httpd/conf.d/
  systemctl restart httpd
  . Configurar Cloudflare Tunnel
  Editar config.yml con ingress rules
  systemctl restart cloudflared
  . Verificar acceso externo
  curl https://mantochrisal.cl/asistencia/health
  ```
. Scripts de Configuracion:
  - `deploy.sh`: Script automatizado para pasos -
  - `rollback.sh`: Script para revertir a version anterior
  - `backup.sh`: Script para backup de base de datos
. Checklist Pre-Despliegue:
  - [ ] Backup de base de datos creado
  - [ ] JWT_SECRET coincide entre PHP y Node.js
  - [ ] Variables de entorno validadas
  - [ ] Tests aprobados (CI/CD verde)
  - [ ] Documentacion actualizada
  - [ ] Cloudflare Tunnel activo
  - [ ] Apache configurado con proxy reverso
  - [ ] Firewall permite trafico en puertos , 
  - [ ] PostgreSQL acepta conexiones desde contenedores
  - [ ] Valkey accesible desde Node.js
. Validacion de Secrets:
  ```bash
  En servidor
  grep JWT_SECRET /var/www/html/hawaii/asistencia/.env
  grep jwtSecret /var/www/html/hawaii/api_get_asistencia_token.php
  DEBEN SER IDENTICOS
  ```
 Dia (Sabado): Despliegue en Staging
Horas: h
| Hora    | Actividad          | Entregable     |
| ----------- | --------------------------- | ------------------- |
| :-:  | Stand-up          | -          |
| :-: | Backup de produccion    | Dump SQL + archivos |
| :-: | Ejecutar despliegue staging | Servicios corriendo |
| :-: | Validar salud de servicios | Health checks ok  |
| :-: | Tests manuales en staging  | Checklist completo |
| :-: | Correcciones de staging   | Fixes aplicados   |
| :-: | Retrospectiva, commit    | Staging funcional  |
Tareas Detalladas:
. Backup:
  ```bash
  pg_dump asistencia > backup_$(date +%Y%m%d_%H%M%S).sql
  tar -czf hawaii_backup_$(date +%Y%m%d).tar.gz /var/www/html/hawaii
  ```
. Despliegue:
  ```bash
  cd /var/www/html/hawaii/asistencia
  git pull origin main
### ./deploy.sh
  ```
. Health Checks:
  ```bash
  Node.js
  curl http://localhost:/asistencia/health
  PHP
  curl http://localhost:/asistencia-node-integration/api/validate-session
  PostgreSQL
  psql -U asistencia_user -d asistencia -c "SELECT ;"
  Valkey
  redis-cli PING
  ```
. Tests Manuales Staging:
  - Repetir checklist de dia (flujo profesor y estudiante)
  - Validar desde dispositivos moviles
  - Verificar desde red externa (fuera de UCN)
  - Probar con multiples usuarios concurrentes
  - Validar logs de Apache y Node.js sin errores
 Dia (Domingo): Optimizacion y Monitoreo
Horas: h
| Hora    | Actividad            | Entregable     |
| ----------- | -------------------------------- | ------------------ |
| :-:  | Stand-up             | -         |
| :-: | Implementar logging estructurado | Logger configurado |
| :-: | Configurar metricas basicas   | Dashboard Valkey  |
| :-: | Optimizacion de queries SQL   | Indices agregados |
| :-: | Documentar runbook operacional  | `RUNBOOK.md`    |
| :-: | Retrospectiva sprint , commit  | Sistema optimizado |
Tareas Detalladas:
. Logging Estructurado:
  - Configurar Winston en Node.js con niveles: error, warn, info, debug
  - Formato JSON para parsing automatizado
  - Rotacion diaria de logs
  - Agregar context en cada log (userId, sessionId, timestamp)
. M�tricas Basicas:
  - Contador de asistencias registradas por hora
  - Tiempo de respuesta promedio de endpoints
  - Uso de memoria Valkey
  - Conexiones activas PostgreSQL
  - Dashboard simple con Grafana (opcional)
. Optimizacion SQL:
  ```sql
  -- Indices para consultas frecuentes
  CREATE INDEX idx_alumno_asistencia_fecha
   ON alumno_asistencia(fecha, bloque);
  CREATE INDEX idx_asistencia_curso_código
   ON asistencia_curso(código);
  CREATE INDEX idx_comentarios_clase_reserva
   ON comentarios_clase(reserva_id);
  -- Analizar plan de ejecución
  EXPLAIN ANALYZE
  SELECT FROM alumno_asistencia
  WHERE fecha = AND bloque = ;
  ```
. RUNBOOK.md:
  ```markdown
  Runbook Operacional - Sistema de Asistencia
  Incidentes Comunes
  Error: "JWT Signature Invalid"
  Causa: Secreto desincronizado entre PHP y Node.js
  Solucion:
### . Verificar JWT_SECRET en .env
### . Verificar jwtSecret en api_get_asistencia_token.php
### . Reiniciar contenedores
  Error: "Session Expired" ()
  Causa: Reserva expiro antes de marca
  Solucion:
### . Verificar fechahora_termino en asistencia_curso
### . Considerar aumentar TTL a minutos
  Error: Asistencia no aparece en pantalla general
  Causa: Problema de sincronizacion DB
  Solucion:
### . Verificar registro en alumno_asistencia
### . Validar relacion con asistencia_curso via código
### . Refrescar cache de pagina
  ```
 Retrospectiva Sprint 
Logros Esperados:
- requisitos funcionales validados
- Sistema desplegado en staging (mantochrisal.cl)
- Documentacion completa de despliegue y operaciones
- Logging y metricas basicas implementadas
- Optimizaciones de performance aplicadas
M�tricas:
- Requisitos aprobados: /
- Tests EE en staging: aprobados
- Tiempo de respuesta promedio: <ms
- Uptime staging (h): >%
 . Escenarios de Error y Manejo de Excepciones
Por Requisito:
 Requisito : Sistema Aislado
Escenarios de Fallo:
. Conflicto de rutas: `/asistencia` capturado por legacy
  - Deteccion: Health check retorna 
  - Solucion: Verificar orden de reglas en Apache config
  - Rollback: Comentar proxy de asistencia, reiniciar Apache
. Conflicto de esquema BD: Foreign keys fallan
  - Deteccion: Error en insercion `alumno_asistencia`
  - Solucion: Verificar nombres de tablas y constraints
  - Rollback: Restaurar backup de esquema
. Puerto en uso: Backend no puede iniciar
  - Deteccion: `EADDRINUSE` en logs
  - Solucion: Verificar `podman ps`, matar proceso
  - Rollback: Cambiar puerto en `.env`
 Requisito y : Opciones UI
Escenarios de Fallo:
. Boton no aparece: Sesion PHP no valida
  - Deteccion: `$_SESSION['id']` undefined
  - Solucion: Verificar `session_start()` en legacy
  - Rollback: Revertir cambios en horario.php
. JWT invalido: Token no se genera
  - Deteccion: Response sin campo `token`
  - Solucion: Verificar JWT_SECRET sincronizado
  - Rollback: Usar endpoint legacy
. Modal no abre: Iframe bloqueado
  - Deteccion: Error CORS en console
  - Solucion: Agregar headers en backend
  - Rollback: Abrir en ventana nueva en lugar de iframe
 Requisito : Registro Asistencia
Escenarios de Fallo:
. TOTP invalido: Codigo expirado o incorrecto
  - Deteccion: HTTP "Invalid TOTP"
  - Solucion: Verificar sincronizacion de tiempo (NTP)
  - Rollback: Aumentar ventana de tolerancia TOTP
. Duplicado: Alumno ya registrado
  - Deteccion: HTTP "Already registered"
  - Solucion: Verificar constraint UNIQUE en BD
  - Rollback: Permitir multiples registros (quitar constraint)
. IP restringida: Alumno fuera de red UCN
  - Deteccion: HTTP "Network not allowed"
  - Solucion: Verificar IP del alumno
  - Rollback: Cambiar `acepta_origen_ip` a "ALL"
. Timeout BD: PostgreSQL no responde
  - Deteccion: HTTP , logs "Connection timeout"
  - Solucion: Reiniciar PostgreSQL, verificar pool
  - Rollback: Usar BD de respaldo
 Requisito : Encuestas
Escenarios de Fallo:
. Redirect falla: No se abre asist.php
  - Deteccion: Alumno queda en pantalla de exito
  - Solucion: Verificar URL de redirect
  - Rollback: Mostrar link manual a encuesta
. Tipo de encuesta incorrecto: Formulario no coincide
  - Deteccion: Campos faltantes o incorrectos
  - Solucion: Verificar `tipo` en `asistencia_curso`
  - Rollback: Permitir cualquier tipo de encuesta
. Guardado falla: Error en `comentarios_clase`
  - Deteccion: Submit sin confirmacion
  - Solucion: Verificar constraints de tabla
  - Rollback: Hacer campos opcionales
 Requisito : Pantalla General
Escenarios de Fallo:
. Asistencia no aparece: Retraso de sincronizacion
  - Deteccion: Query retorna vacio
  - Solucion: Verificar transaction commit
  - Rollback: Refrescar cache, VACUUM BD
. Fecha incorrecta: Timezone mal configurado
  - Deteccion: Asistencia en fecha diferente
  - Solucion: Configurar timezone en PostgreSQL
  - Rollback: Ajustar manualmente fechas
. Duplicados: Mismo alumno aparece veces
  - Deteccion: COUNT > en query de verificacion
  - Solucion: Agregar constraint UNIQUE, limpiar duplicados
  - Rollback: Mostrar todos, marcar duplicados
 Requisito : Duracion QR
Escenarios de Fallo:
. Expiracion no funciona: Acepta códigos viejos
  - Deteccion: Test automatizado falla
  - Solucion: Verificar comparacion de timestamps
  - Rollback: Aumentar TTL a minutos
. Expira demasiado rápido: Alumnos no alcanzan
  - Deteccion: Multiples errores 
  - Solucion: Aumentar TTL en BD
  - Rollback: Configurar TTL minutos
. Timezone causa expiracion prematura: Servidor en UTC
  - Deteccion: Expira inmediatamente
  - Solucion: Sincronizar timezone PHP/Node/PostgreSQL
  - Rollback: Usar UTC en todos los servicios
 . Plan de Rollback por Componente
Estrategia General:
. Cada cambio en branch separado
. Backup antes de despliegue
. Scripts de rollback automatizados
. Validacion post-rollback
Componentes:
| Componente   | Comando Rollback                             | Tiempo | Impacto |
| -------------- | ------------------------------------------------------------------------- | ------ | ------- |
| Apache Config | `cp asistencia.conf.bak asistencia.conf && systemctl restart httpd`    | seg | Medio  |
| Backend    | `podman-compose stop backend && podman-compose up -d backend-old`     | min | Alto  |
| Frontend    | `podman-compose stop frontend && podman-compose up -d frontend-old`    | min | Medio  |
| PHP Service  | `git checkout main -- php-service/ && podman-compose restart php-service` | min | Alto  |
| Base de Datos | `psql asistencia < backup_YYYYMMDD.sql`                  | min | Critico |
| Endpoint Token | Descomentar api_get_asistencia_token.php, revertir horario.php      | min | Alto  |
Script de Rollback Completo:
```bash
!/bin/bash
 rollback.sh - Revertir despliegue completo
set -e
echo "[/] Revertir Apache config..."
cp /etc/httpd/conf.d/asistencia.conf.bak /etc/httpd/conf.d/asistencia.conf
systemctl restart httpd
echo "[/] Detener nuevos servicios..."
cd /var/www/html/hawaii/asistencia
podman-compose down
echo "[/] Restaurar código..."
git checkout main~ -- .
echo "[/] Restaurar base de datos..."
psql -U asistencia_user -d asistencia < backups/backup_$(date +%Y%m%d).sql
echo "[/] Levantar servicios legacy..."
podman-compose -f compose.yaml -f compose.legacy.yaml up -d
echo "[/] Validar rollback..."
curl -f http://localhost/api_get_asistencia_token.php || echo "ROLLBACK FAILED"
echo "Rollback completado"
```
---
 . ENTREGABLES FINALES
 . Documentacion
. Documentacion de Separacion Arquitectonica (`ARCHITECTURE_REFACTOR.md`)
  - Justificacion t�cnica de la separacion Backend/Frontend
  - Comparacion antes/despues
  - Guia de migración de proyectos monoliticos a separados
  - Lecciones aprendidas
. Informe de Validacion de Requisitos (`REQUIREMENTS_VALIDATION.md`)
  - Estado de cada uno de los requisitos
  - Evidencia de cumplimiento (screenshots, queries SQL)
  - Tests automatizados por requisito
. Guia de Despliegue (`DEPLOYMENT.md`)
  - Procedimiento paso a paso
  - Scripts de automatizacion
  - Checklist pre-despliegue
. Runbook Operacional (`RUNBOOK.md`)
  - Incidentes comunes y soluciones
  - Procedimientos de mantenimiento
  - Contactos de soporte
. Reporte de Cobertura de Tests
  - HTML report PHP (>%)
  - HTML report Node.js (>%)
  - Listado de tests EE
. Documentacion de API (`API.md`)
  - Endpoints disponibles
  - Esquemás de request/response
  - Codigos de error
 . Codigo
. Modulo PHP de Integracion
  - `/php-service/src/asistencia-node-integration`
  - + tests unitarios
  - Cobertura >%
. Migración de Endpoint
  - `api_get_asistencia_token.php` deprecado
  - `/asistencia-node-integration/api/token` operacional
  - `horario.php` actualizado
. CI/CD Pipeline
  - `.github/workflows/test.yml`
  - Ejecucion automatica en push
  - Reportes de cobertura
. Tests EE
  - `ee/profesor-flow.spec.ts`
  - `ee/estudiante-flow.spec.ts`
  - `ee/jwt-generation.spec.ts`
 . Infraestructura
. Despliegue Staging
  - Sistema corriendo en mantochrisal.cl
  - Accesible via Cloudflare Tunnel
  - Logs configurados y accesibles
. Scripts de Automatizacion
  - `deploy.sh` - Despliegue automatizado
  - `rollback.sh` - Reversion a version anterior
  - `backup.sh` - Backup de base de datos
  - `health-check.sh` - Validacion de servicios
---
 . RIESGOS Y MITIGACIONES
 . Riesgos Tecnicos
| Riesgo                     | Probabilidad | Impacto | Mitigacion                                    |
| ----------------------------------------------- | ------------ | ------- | -------------------------------------------------------------------------------- |
| Separacion Backend/Frontend rompe funcionalidad | Media    | Alto  | Tests inmediatos post-migración, validación exhaustiva, git branch para rollback |
| Incompatibilidad JWT PHP<->Node          | Media    | Alto  | Tests cruzados desde dia , validación de secret                 |
| Timeout de WebSocket en produccion       | Baja     | Medio  | Configurar keep-alive, fallback a polling                    |
| Conflicto de esquema BD             | Baja     | Alto  | Revisar DDL antes de despliegue, namespace claro                 |
| Problemas de CORS en iframe           | Media    | Alto  | Configurar headers correctamente, test en staging                |
| Perdida de sesion PHP              | Baja     | Medio  | Validar `$_SESSION` disponible, manejo de errores                |
 . Riesgos de Negocio
| Riesgo              | Probabilidad | Impacto | Mitigacion                     |
| --------------------------------- | ------------ | ------- | --------------------------------------------------- |
| Resistencia al cambio de usuarios | Media    | Bajo  | Interfaz similar al sistema actual, capacitacion  |
| Downtime durante despliegue    | Media    | Alto  | Despliegue en horario valle, backup completo    |
| Bugs no detectados en produccion | Baja     | Alto  | Testing exhaustivo, rollback plan, monitoreo activo |
 . Riesgos de Proyecto
| Riesgo             | Probabilidad | Impacto | Mitigacion                     |
| ------------------------------- | ------------ | ------- | -------------------------------------------------- |
| Retraso en testing PHP     | Media    | Medio  | Buffers en planificacion, priorizar tests criticos |
| Problemas con Cloudflare Tunnel | Baja     | Alto  | Validar configuración en dia , soporte de CF   |
| Falta de documentacion t�cnica | Baja     | Medio  | Documentar inline mientras se desarrolla      |
---
 . CRITERIOS DE EXITO
 . Criterios Tecnicos
- [ ] / requisitos funcionales validados y documentados
- [ ] + tests PHP implementados y aprobados
- [ ] + tests Node.js aprobados (preexistentes)
- [ ] + tests EE automatizados con Playwright
- [ ] Cobertura de código >% en componentes nuevos
- [ ] CI/CD pipeline operacional con checks automaticos
- [ ] Despliegue staging exitoso en mantochrisal.cl
- [ ] Tiempo de respuesta promedio <ms
- [ ] Cero errores en logs de produccion durante h
 . Criterios Funcionales
- [ ] Profesor puede abrir sesion de asistencia desde nueva interfaz
- [ ] Codigo QR dinámico se proyecta correctamente
- [ ] Estudiante puede escanear QR y registrar asistencia
- [ ] Asistencia aparece en pantalla general con datos correctos
- [ ] Encuestas post-asistencia funcionan sin cambios
- [ ] Duracion de reserva configurable y validada
- [ ] Sistema aislado no afecta funcionalidad legacy
 . Criterios de Documentacion
- [ ] README.md actualizado con instrucciones de uso
- [ ] DEPLOYMENT.md con procedimiento completo
- [ ] RUNBOOK.md con incidentes y soluciones
- [ ] API.md con documentacion de endpoints
- [ ] Comentarios inline en código critico
- [ ] Diagramás de arquitectura actualizados
---
 . APRENDIZAJE Y DESARROLLO PROFESIONAL
 . Herramientas GitHub Student Pack a Explorar
. GitHub Codespaces - Entorno de desarrollo en la nube
  - Configurar devcontainer para el proyecto
  - Desarrollo sin dependencias locales
. GitHub Copilot - Asistente de código IA (ya en uso)
  - Generacion de tests unitarios
  - Documentacion automatica
. GitHub Actions - CI/CD (implementado en sprint )
  - Tests automatizados
  - Despliegue continuo
. Heroku (creditos estudiante) - Hosting alternativo
  - Despliegue de demo
  - Staging environment
. MongoDB Atlas (creditos estudiante) - Base de datos
  - Cache secundario (opcional)
. Sentry - Monitoreo de errores
  - Tracking de excepciones en tiempo real
  - Alertas automatizadas
 . Competencias T�cnicas Desarrolladas
- Testing exhaustivo (unitario, integración, EE)
- CI/CD con GitHub Actions
- Integracion de sistemas legacy con arquitecturas modernas
- Debugging de autenticacion cross-service
- Optimizacion de queries SQL
- Logging y monitoreo de aplicaciones
- Despliegue con contenedores (Podman)
- Configuracion de proxy reverso (Apache)
- Gestion de secretos y variables de entorno
 . Recursos de Aprendizaje
Durante el proyecto:
- Documentacion oficial de PHPUnit
- Playwright documentation
- GitHub Actions workflow syntax
- Vitest best practices
Post-proyecto:
- Curso de Cloudflare Workers (CDN edge computing)
- Certificacion PostgreSQL Performance Tuning
- Advanced TypeScript patterns
---
 . PROXIMOS PASOS POST-PROYECTO
 . Fase : Optimizaciones (Enero -)
. Performance:
  - Implementar caching de consultas frecuentes
  - Optimizacion de bundle frontend (code splitting)
  - CDN para assets estaticos
. Seguridad:
  - Auditoria de seguridad completa
  - Rate limiting en endpoints criticos
  - Implementar CSRF protection
. UX:
  - Feedback visual mejorado
  - Accesibilidad (WCAG .)
  - Responsive design para tablets
 . Fase : Expansion (Febrero)
. FIDO Enrollment:
  - Completar modulo de registro biometrico
  - Tests de enrollment flow
. Analytics:
  - Dashboard de estadisticas para administradores
  - Reportes de uso del sistema
. Integracion completa:
  - Deprecar completamente `asist.php`
  - Migrar encuestas al nuevo frontend
 . Fase : Clusterizacion con Kubernetes (Marzo - Opcional)
Prerequisito: Sistema operando establemente en produccion por + dias
Justificacion:
- Escalabilidad horizontal automatica ante picos de carga (inicio de semestre)
- Alta disponibilidad con multiples replicas
- Despliegue profesional con rolling updates sin downtime
- Recuperacion automatica ante fallos de pods/nodos
- Gestion centralizada de configuración y secretos
Componentes a migrar:
. Backend Node.js (Semana -)
  - Crear Deployment con replicas
  - HorizontalPodAutoscaler: - replicas (CPU >%)
  - Service tipo ClusterIP en puerto 
  - ConfigMap para variables no sensibles
  - Secret para JWT_SECRET y DB credentials
  - Liveness probe: GET /asistencia/health
  - Readiness probe: GET /asistencia/ready
. Frontend (Semana )
  - Deployment con replicas (nginx)
  - Service ClusterIP en puerto 
  - ConfigMap con nginx.conf optimizado
  - Servir assets estaticos desde CDN (opcional)
. PostgreSQL (Semana )
  - StatefulSet con replica (o cluster con replicacion)
  - PersistentVolumeClaim Gi (SSD para performance)
  - Service headless para DNS estable
  - Backup automatico con CronJob (pg_dump diario)
  - Monitoring con postgres_exporter
. Valkey/Redis (Semana )
  - StatefulSet con replica
  - PersistentVolumeClaim Gi
  - Service ClusterIP
  - Redis Sentinel para alta disponibilidad (opcional)
. Ingress y Certificados SSL (Semana )
  - Ingress controller (nginx-ingress o Traefik)
  - Cert-manager con Let's Encrypt
  - Reglas de enrutamiento:
   - mantochrisal.cl/asistencia -> frontend Service
   - mantochrisal.cl/asistencia/api -> backend Service
  - Rate limiting con annotations
Manifiestos Kubernetes:
```yaml
 backend-deployment.yaml
apiVersion: apps/v
kind: Deployment
metadata:
 name: asistencia-backend
 namespace: asistencia-ucn
spec:
 replicas: 
 selector:
  matchLabels:
   app: asistencia-backend
 template:
  metadata:
   labels:
    app: asistencia-backend
  spec:
   containers:
    - name: backend
     image: registry.ucn.cl/asistencia-backend:v..
     ports:
      - containerPort: 
     env:
      - name: NODE_ENV
       value: "production"
      - name: JWT_SECRET
       valueFrom:
        secretKeyRef:
         name: asistencia-secrets
         key: jwt-secret
      - name: DB_HOST
       value: "postgres-svc"
      - name: VALKEY_HOST
       value: "valkey-svc"
     resources:
      requests:
       memory: "Mi"
       cpu: "m"
      limits:
       memory: "Mi"
       cpu: "m"
     livenessProbe:
      httpGet:
       path: /asistencia/health
       port: 
      initialDelaySeconds: 
      periodSeconds: 
     readinessProbe:
      httpGet:
       path: /asistencia/ready
       port: 
      initialDelaySeconds: 
      periodSeconds: 
---
apiVersion: autoscaling/v
kind: HorizontalPodAutoscaler
metadata:
 name: asistencia-backend-hpa
 namespace: asistencia-ucn
spec:
 scaleTargetRef:
  apiVersion: apps/v
  kind: Deployment
  name: asistencia-backend
 minReplicas: 
 maxReplicas: 
 metrics:
  - type: Resource
   resource:
    name: cpu
    target:
     type: Utilization
     averageUtilization: 
```
Helm Chart (alternativa simplificada):
```bash
helm create asistencia-ucn
cd asistencia-ucn
 Editar values.yaml con configuración especifica
 Instalar en cluster
helm install asistencia ./asistencia-ucn -n asistencia-ucn --create-namespace
 Upgrade en despliegues posteriores
helm upgrade asistencia ./asistencia-ucn -n asistencia-ucn
```
CI/CD con Kubernetes:
```yaml
 .github/workflows/deploy-ks.yml
name: Deploy to Kubernetes
on:
 push:
  branches: [main]
jobs:
 deploy:
  runs-on: ubuntu-latest
  steps:
   - uses: actions/checkout@v
   - name: Build and push backend image
    run: |
     docker build -t registry.ucn.cl/asistencia-backend:${{ github.sha }} ./backend
     docker push registry.ucn.cl/asistencia-backend:${{ github.sha }}
   - name: Deploy to Kubernetes
    uses: azure/ks-deploy@v
    with:
     manifests: |
      ks/backend-deployment.yaml
      ks/backend-service.yaml
     images: |
      registry.ucn.cl/asistencia-backend:${{ github.sha }}
     namespace: asistencia-ucn
```
Monitoreo en Kubernetes:
- Prometheus Operator para metricas
- Grafana con dashboards de Kubernetes
- Alertmanager para notificaciones
- ELK Stack o Loki para logs centralizados
Costos y Recursos:
- Cluster minimo: nodos ( vCPU, GB RAM cada uno)
- Storage: GB total (SSD recomendado)
- Trafico: Depende de uso (estimado <GB/mes)
- Alternativas:
 - Cluster local con ks (lightweight Kubernetes)
 - Managed Kubernetes (GKE, EKS, AKS) con creditos estudiantiles
 - Minikube para desarrollo y testing
Checklist de Pre-Requisitos:
- [ ] Sistema estable en produccion por + dias
- [ ] M�tricas de carga promedio/pico recopiladas
- [ ] Cluster Kubernetes disponible (local o cloud)
- [ ] kubectl configurado y funcionando
- [ ] Registry de imagenes Docker accesible
- [ ] Equipo capacitado en conceptos básicos de Ks
- [ ] Plan de rollback documentado
- [ ] Backup completo de datos antes de migración
Prioridad: BAJA (despues de validación completa del sistema) 
Complejidad: ALTA 
ROI: MEDIO (beneficio significativo solo con carga alta o multiples ambientes)
---
 . CONTACTOS Y RECURSOS
 . Equipo
Desarrollador Principal: Cristian 
Rol: Full-stack developer 
Horario: :-: (UTC-)
 . Recursos Externos
Repositorio: [URL del repositorio] 
Staging: https://mantochrisal.cl/asistencia 
Documentacion: `/asistencia/documents/INDEX.md` 
CI/CD: GitHub Actions 
Monitoreo: Logs en `/var/log/httpd/` y `/var/log/containers/`
 . Soporte
Cloudflare Tunnel: [soporte Cloudflare] 
PostgreSQL: [community forums] 
Node.js: [Stack Overflow] 
PHPUnit: [documentacion oficial]
---
 . CARTA GANTT RESUMIDA
```
+------------------------------------------------------------------+
|             ENERO                 |
+----+----+----+----+----+----+----+----+----+----+----+----+----+
| D |  |  |  |  |  |  |  |  |  | | | |
+----+----+----+----+----+----+----+----+----+----+----+----+----+
|  | Mi | Ju | Vi | Sa | Do | Lu | Ma | Mi | Ju | Vi | Sa | Do |
+----+----+----+----+----+----+----+----+----+----+----+----+----+
|  | ?| ?? | ?? | ?? | ?? |  |  | ?? | ?? | ?? | ?? | ?? |
|  |SEP |PHP |MIG |EE |EE |OFF |OFF |REQ |REQ |DEP |OPT |DOC |
|  |ARC |TST |END |MAN |AUT |  |  |- |- |STG |  |  |
+----+----+----+----+----+----+----+----+----+----+----+----+----+
Sprint (Refactoring y Testing)
Sprint (Integracion y Despliegue)
Dia  (Mi ): Separacion Backend/Frontend (CRITICO)
Dia  (Ju ): Testing PHP Completo - tests
Dia  (Vi ): Migración Endpoint + CI/CD
Dia  (Sa ): Tests EE Manuales
Dia  (Do ): Tests EE Playwright
Dia  (Lu ): DESCANSO
Dia  (Ma ): DESCANSO
Dia  (Mi ): Validacion Requisitos -
Dia  (Ju ): Validacion Requisitos -
Dia (Vi ): Despliegue Staging (Cloudflare)
Dia (Sa ): Optimizacion y Monitoreo
Dia (Do ): Documentacion Final
 = Refactoring arquitectonico critico
```
---
 ANEXOS
 Anexo A: Comandos Utiles
```bash
 Levantar entorno desarrollo
cd /var/www/html/hawaii/asistencia
podman-compose -f compose.yaml -f compose.dev.yaml up -d
 Ejecutar tests PHP
cd php-service
vendor/bin/phpunit --testdox
 Ejecutar tests Node.js
cd node-service
npm test
 Ejecutar tests EE
cd node-service
npx playwright test
 Ver logs Node.js
podman logs -f asistencia-node
 Ver logs PHP
podman logs -f asistencia-php
 Conectar a PostgreSQL
podman exec -it asistencia-postgres psql -U asistencia_user -d asistencia
 Conectar a Valkey
podman exec -it asistencia-valkey redis-cli
 Reiniciar servicios
podman-compose restart
 Ver estado
podman ps
```
 Anexo B: Estructura de Branches Git
```
main
 +-- feature/php-testing (dias -)
 +-- feature/endpoint-migration (dia )
 +-- feature/ci-cd (dia )
 +-- feature/ee-tests (dias -)
 +-- feature/requirements-validation (dias -)
 +-- feature/deployment (dia )
 +-- feature/optimization (dia )
```
Merge a `main` al final de cada sprint tras code review.
 Anexo C: Variables de Entorno Requeridas
```bash
 Compartidas
JWT_SECRET=<min--chars>
 PHP Service
NODE_MODULE_ENABLED=true
JWT_SECRET_INTERNAL=<min--chars>
NODE_SERVICE_URL=http://node-service:
 Node Service
NODE_ENV=production
PORT=
DB_HOST=postgres
DB_PORT=
DB_NAME=asistencia
DB_USER=asistencia_user
DB_PASSWORD=<secure-password>
VALKEY_HOST=valkey
VALKEY_PORT=
```
---
 CONCLUSION
Este plan establece una ruta clara y estructurada para completar la implementación del nuevo sistema de asistencia Hawaii en dias hábiles. La estrategia prioriza:
. Calidad mediante Testing: > tests PHP, > tests Node.js, tests EE
. Automatizacion: CI/CD desde dia 
. Validacion rigurosa: requisitos funcionales verificados sistematicamente
. Documentacion exhaustiva: Procedimientos de despliegue, operacion y troubleshooting
. Aprendizaje practico: Uso de herramientas profesionales (GitHub Actions, Playwright, PHPUnit)
El exito del proyecto se medira no solo por la funcionalidad implementada, sino por la robustez del sistema evidenciada en tests automatizados, la facilidad de despliegue demostrada en staging, y la claridad de la documentacion que permitira mantenimiento futuro.
Fecha de generacion: diciembre  
Próxima revision: enero (Kick-off Sprint )
---
FIN DEL DOCUMENTO
