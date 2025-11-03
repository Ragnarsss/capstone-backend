# Plan de Implementación Definitivo - Sistema de Asistencia Criptográfica

**Versión:** 4.0 (Consolidada)
**Fecha:** 3 de noviembre de 2025
**Estado:** Plan Activo
**Fuente:** Consolidación de `Plan.md` v3.0 y la carpeta `documents/`.

---

## 1. Visión General y Arquitectura

### 1.1. Resumen Ejecutivo

Este documento describe el plan de implementación para un sistema de validación de asistencia que utiliza autenticación criptográfica multi-ronda para garantizar la presencia física del usuario y mitigar el fraude.

**Pilares del Sistema:**

- **Device Binding:** Uso de FIDO2/WebAuthn para vincular de forma segura una cuenta de usuario a un dispositivo físico.
- **Confidential Key Exchange:** Uso de ECDH para establecer una clave de sesión (`session_key`) sin que esta viaje por la red.
- **Validación Multi-Ronda:** Requerir que el alumno valide su presencia `N` veces a través de QR rotatorios.
- **Análisis Estadístico:** Calcular un umbral de certeza basado en los tiempos de respuesta (RT) para detectar anomalías.

### 1.2. Arquitectura Monolito Modular

El sistema se implementa como un **Monolito Modular** (Node.js) que se integra con un sistema PHP existente (HAWAII). Esta decisión, documentada en `07-decisiones-arquitectonicas.md`, prioriza la simplicidad operacional y la velocidad de desarrollo sobre la complejidad de una arquitectura de microservicios, que no es necesaria para la escala actual del proyecto.

```mermaid
  Mejorar la visualización del diagrama
```

### 1.3. Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| Orquestador | PHP + Apache | 7.4 / 2.4 | Servidor web principal, emisor de JWT |
| Servicio Principal | Node.js + TypeScript | 20 LTS | Lógica de negocio, criptografía |
| Base de Datos | PostgreSQL | 18 | Persistencia de enrolamientos y asistencias |
| Caché | Valkey | 7 | Almacenamiento de `session_key` y colas de QR |

---

## 2. Componentes Criptográficos Clave

Extraído de `02-componentes-criptograficos.md`.

- **FIDO2/WebAuthn (ES256):** Para el enrolamiento y la creación de `device-bound passkeys`. Se utiliza la curva elíptica P-256.
- **ECDH (P-256):** Para el intercambio de claves Diffie-Hellman en curva elíptica, garantizando *Perfect Forward Secrecy*.
- **HKDF (SHA-256):** Para derivar claves (`handshake_secret`, `session_key`) de forma segura a partir de un material maestro.
- **TOTP Dual:** Un TOTP para el usuario (`TOTPu`) y otro para el servidor (`TOTPs`) para validación mutua.
- **AES-256-GCM:** Para el cifrado autenticado de los *payloads* de los QR, previniendo manipulación.

---

## 3. División Funcional en Módulos Paralelos

El proyecto se divide en cuatro módulos funcionales que pueden ser desarrollados de forma independiente.

### MÓDULO 1 IDENTIDAD Y ENROLAMIENTO

**Objetivo:** Gestionar el ciclo de vida de la identidad criptográfica del usuario y sus dispositivos.

**Funcionalidades Clave:**

- **Enrolamiento FIDO2:** Vincular un dispositivo a un usuario.
- **Login con ECDH:** Establecer una sesión segura.
- **Gestión de Dispositivos:** Almacenar y consultar credenciales.

**Flujos de Referencia:**

- `03-flujo-enrolamiento.md`
- `02-componentes-criptograficos.md` (Secciones FIDO2 y ECDH)

**Tareas:**

- **Backend:**
  - [ ] Implementar endpoint `POST /api/enrollment/start` para generar el `challenge` WebAuthn.
  - [ ] Implementar endpoint `POST /api/enrollment/finish` para validar la `attestation` y almacenar la credencial.
  - [ ] Implementar la derivación de `handshake_secret` usando HKDF.
  - [ ] Implementar endpoint `POST /api/enrollment/login` para el intercambio de claves ECDH y generación de `TOTPu`.
  - [ ] Implementar la lógica de almacenamiento de `session_key` en Valkey.
- **Frontend:**
  - [ ] Crear UI para el proceso de enrolamiento (`navigator.credentials.create`).
  - [ ] Crear UI para el proceso de login (`navigator.credentials.get`).
  - [ ] Gestionar la derivación de la `session_key` del lado del cliente.
- **Base de Datos (Schema `enrollment`):**
  - [ ] Definir y crear la tabla `enrollment.devices` con todos los campos de seguridad.
  - [ ] Definir y crear la tabla `enrollment.enrollment_history` para auditoría.

---

### MÓDULO 2 ASISTENCIA Y VALIDACIÓN

**Objetivo:** Gestionar la lógica de negocio para el registro y validación de la asistencia.

**Funcionalidades Clave:**

- **Registro en Sesión:** Un alumno se apunta para participar en una sesión de asistencia.
- **Generación de Payloads:** Crear los `N` payloads cifrados para los QR.
- **Validación de Rondas:** Recibir, desencriptar y validar las respuestas del alumno.
- **Cálculo de Certeza:** Aplicar lógica estadística a los tiempos de respuesta.

**Flujos de Referencia:**

- `04-flujo-asistencia.md`

**Tareas:**

- **Backend:**
  - [ ] Implementar endpoint `POST /api/attendance/register` para que un usuario se una a una sesión.
  - [ ] Implementar la lógica de generación de `N` payloads de QR por usuario, cifrados con `session_key`.
  - [ ] Implementar el almacenamiento de los metadatos del QR en Valkey y añadirlos a la cola de proyección.
  - [ ] Implementar endpoint `POST /api/attendance/validate` para procesar las respuestas del alumno.
  - [ ] Implementar la validación de `TOTPu` y `TOTPs`.
  - [ ] Implementar el cálculo del tiempo de respuesta (RT) y su validación.
  - [ ] Implementar la función `calculateCertainty()` basada en la media y desviación estándar de los RT.
  - [ ] Persistir el resultado final (`PRESENTE`, `AUSENTE`) en la base de datos.
- **Frontend:**
  - [ ] Crear UI para que el alumno se registre en una sesión.
  - [ ] Implementar el scanner de QR (ej. con `jsQR`).
  - [ ] Implementar la lógica de desencriptación del QR con la `session_key` local.
  - [ ] Implementar la creación y cifrado de la respuesta para el endpoint de validación.
  - [ ] Mostrar feedback al usuario (`Ronda X/N completada`, `Asistencia confirmada`).
- **Base de Datos (Schema `attendance`):**
  - [ ] Definir y crear la tabla `attendance.sessions`.
  - [ ] Definir y crear la tabla `attendance.records` para los resultados de la asistencia.

---

### MÓDULO 3 PROYECCIÓN EN TIEMPO REAL

**Objetivo:** Mostrar los QR de todos los alumnos participantes de forma aleatoria y en tiempo real.

**Funcionalidades Clave:**

- **Conexión WebSocket:** Permitir que la interfaz del profesor se conecte al servidor.
- **Rotación Aleatoria:** Seleccionar un QR de la cola de Valkey cada `X` milisegundos.
- **Broadcast:** Enviar el QR seleccionado a todas las interfaces de profesor conectadas a esa sesión.

**Flujos de Referencia:**

- `09-protocolo-websocket.md`

**Tareas:**

- **Backend:**
  - [ ] Implementar el servidor WebSocket que maneje el ciclo de vida de la conexión.
  - [ ] Implementar el mensaje `join_session` para que un profesor se suscriba a una sesión.
  - [ ] Crear un `setInterval` que se active cuando un profesor se une.
  - [ ] Dentro del intervalo, leer la cola de proyección de Valkey (`LRANGE`).
  - [ ] Seleccionar un payload de QR de forma aleatoria.
  - [ ] Enviar el payload a los clientes WebSocket suscritos a través de un mensaje `qr_frame`.
  - [ ] Gestionar la desconexión y limpieza de recursos.
- **Frontend:**
  - [ ] Crear la UI de proyección del profesor (un canvas para el QR e información básica).
  - [ ] Implementar la lógica para conectarse al servidor WebSocket.
  - [ ] Implementar el manejador de mensajes `onmessage` para recibir los `qr_frame`.
  - [ ] Renderizar el payload recibido como un QR en el canvas (ej. con `qrcode.js`).
  - [ ] Mostrar feedback visual de la rotación.

---

### MÓDULO 4 INTEGRACIÓN Y ORQUESTACIÓN

**Objetivo:** Conectar el sistema de asistencia con la plataforma existente (HAWAII) y configurar la infraestructura.

**Funcionalidades Clave:**

- **Puente de Autenticación:** Un script PHP que valida la sesión del monolito y emite un JWT.
- **Proxy Inverso:** Redirigir las peticiones del cliente al servicio Node.js y WebSocket.
- **Notificación Backend:** Permitir que el servicio Node.js envíe logs o eventos al sistema PHP.

**Flujos de Referencia:**

- `10-guia-integracion-php-node.md`
- `Plan.md` v3.0 (Sección de integración PHP y Apache)

**Tareas:**

- **Infraestructura:**
  - [ ] Crear `Containerfile` o `Dockerfile` para el servicio Node.js.
  - [ ] Crear `compose.yaml` para orquestar los servicios (Node, PostgreSQL, Valkey).
  - [ ] Configurar el Reverse Proxy en Apache para redirigir `/asistencia/api` y `/asistencia/ws`.
- **PHP (Puente):**
  - [ ] Crear el script `api_puente_minodo.php`.
  - [ ] Implementar la acción `iniciar_participacion`:
    - Validar la sesión PHP existente (`$_SESSION`).
    - Generar un JWT de corta duración (5 min) con el `userId` y `role`.
    - Devolver el JWT al cliente.
  - [ ] Implementar la acción `log_evento_seguridad` para recibir notificaciones desde el backend de Node.js.
- **Node.js (Integración):**
  - [ ] Crear un middleware para validar el JWT emitido por PHP en todas las peticiones a la API.
  - [ ] Crear un cliente HTTP para enviar notificaciones al `api_puente_minodo.php` si es necesario.

---

## 4. Esquema de Base de Datos Completo

Extraído de `05-esquema-base-datos.md`. **No se realizan simplificaciones.**

### Schema `enrollment`

```sql
CREATE SCHEMA IF NOT EXISTS enrollment;

-- Tabla para dispositivos enrolados
CREATE TABLE enrollment.devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  handshake_secret TEXT NOT NULL,
  aaguid TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  attestation_format TEXT,
  sign_count INTEGER DEFAULT 0,
  enrolled_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Tabla para historial de enrolamientos
CREATE TABLE enrollment.enrollment_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  device_id INTEGER REFERENCES enrollment.devices(id) ON DELETE SET NULL,
  action TEXT NOT NULL,  -- 'enrolled', 're-enrolled', 'revoked'
  reason TEXT,
  performed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
```

### Schema `attendance`

```sql
CREATE SCHEMA IF NOT EXISTS attendance;

-- Tabla para sesiones de asistencia
CREATE TABLE attendance.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL,
  professor_id INTEGER NOT NULL,
  professor_name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  room TEXT NOT NULL,
  semester TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  max_rounds INTEGER DEFAULT 3,
  status TEXT DEFAULT 'active',  -- 'active', 'closed', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Tabla para registros de asistencia
CREATE TABLE attendance.records (
  id SERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES attendance.sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  device_id INTEGER REFERENCES enrollment.devices(id) ON DELETE SET NULL,
  round_times JSONB NOT NULL,
  avg_rt FLOAT NOT NULL,
  std_dev FLOAT NOT NULL,
  min_rt FLOAT NOT NULL,
  max_rt FLOAT NOT NULL,
  median_rt FLOAT NOT NULL,
  certainty FLOAT NOT NULL,
  status TEXT NOT NULL,
  total_rounds INTEGER NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
```

---

## 5. Estrategia de Testing

Como se detalla en `11-estrategia-testing.md` (versión actualizada), el proyecto se centrará **exclusivamente en testing unitario**, con un objetivo de cobertura de código superior al 60% para cada módulo. No se implementarán tests de integración ni E2E.
