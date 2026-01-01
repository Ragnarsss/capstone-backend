# Event Storming - Sistema de Asistencia con QR Criptográfico

**Institución:** Universidad Católica del Norte - Campus Coquimbo  
**Unidad:** Escuela de Ingeniería  
**Fecha:** 31 de diciembre de 2025  
**Facilitadores:** Equipo de Desarrollo  
**Objetivo:** Descubrir rápidamente lo que está sucediendo en el proceso de **toma de asistencia** en clases presenciales de ingeniería

---

## 🎓 Contexto: UCN Coquimbo - Escuela de Ingeniería

**Desafío:** Modernizar el proceso de toma de asistencia en cursos presenciales

- **Alumnos:** 30-50 por curso típico de ingeniería
- **Horarios:** Bloques de 90 minutos (8 bloques diarios)
- **Problema Actual:** Sistemas manuales lentos, propensos a fraude (firmar por compañeros)
- **Solución:** QR dinámico con códigos criptográficos (TOTP) que cambian cada 10 segundos

---

## 🎯 Leyenda de Colores

- 🟠 **Eventos de Dominio** - Algo que sucedió (pasado)
- 🔵 **Comandos** - Intención de hacer algo
- 🟡 **Actores** - Personas que ejecutan comandos
- 🟢 **Políticas** - Reglas de negocio automáticas
- 🟣 **Sistemas Externos** - Integraciones
- 🔴 **Hotspots** - Problemas, preguntas, áreas de conflicto
- 📝 **Read Models** - Información que se consulta

---

## 📍 Timeline de Eventos - Flujo de Toma de Asistencia

> **Contexto:** Clase presencial de "Programación Avanzada" (IWI-131) con 42 alumnos  
> **Sala:** Laboratorio de Computación L-201, Escuela de Ingeniería  
> **Horario:** Miércoles 08:00-09:30 (Bloque 1)  
> **Profesor:** Cristian Salazar

---

### FASE 1: Profesor Inicia Sesión de Asistencia (2 minutos)

```
🟡 Profesor
         ↓
    🔵 Abrir Sesión de Asistencia
         ↓
🟠 Sesión de Asistencia Abierta
    - idCurso
    - fecha
    - bloque (1-8)
    - tipo_encuesta (2-7)
    - fechahora_inicio
    - fechahora_termino (TTL: 5-10 min)
    - codigo_reserva (6 chars: CVYAFO)
         ↓
    🟢 Sistema genera código TOTP criptográfico
         ↓
🟠 QR Dinámico Generado
    - Cambia cada 10 segundos
    - Payload: {codigo, totp, timestamp}
         ↓
    🟣 WebSocket → Frontend Profesor
         ↓
    📝 QR Visible en Pantalla/Proyector
```

**🔴 Hotspot:** ¿Qué pasa si el profesor cierra el modal antes de que todos marquen?

- **Respuesta:** Sesión sigue activa hasta `fechahora_termino`, alumnos pueden marcar

**🔴 Hotspot:** ¿Puede haber múltiples sesiones simultáneas del mismo curso?

- **Respuesta:** NO - Constraint UNIQUE (curso, fecha, bloque)

### Fase 3: Toma de Asistencia (Estudiante)

```
🟡 Estudiante
         ↓
    🔵 Escanear QR
         ↓
🟠 QR Escaneado
    - payload: {codigo, totp, timestamp}
     ASE 2: Estudiantes Marcan Asistencia (3-5 minutos)

```

🟡 Estudiante (ej: María González, RUT 20.123.456-7) - Ubicación: Sala L-201, UCN Coquimbo - Dispositivo: Smartphone con cámara
↓
🔵 Abrir Sistema Hawaii en móvil
↓
📝 horario.php carga con sesión activa
↓
🔵 Clic en "Tomar Asistencia"
↓
🟠 Modal de Lector QR Abierto - Iframe carga: /asistencia/features/qr-reader/ - JWT incluido en URL - Cámara activada
↓
🔵 Apuntar cámara al proyector/pantalla del profesor
↓
🟠 QR Detectado por ZXing Library - Payload decodificado: {codigo: "CVYAFO", totp: "847362", timestamp: 1736323425}
↓
🟢 VALIDACIÓN 1: TOTP correcto - Verificar hash con algoritmo HMAC-SHA1 - Ventana de tolerancia: 30 segundos - ✅ VÁLIDO
↓
🟢 VALID Crítico:\*\* ¿Qué pasa si 10 alumnos intentan escanear simultáneamente?

- **Respuesta:** Backend Node.js (Fastify) maneja concurrencia nativa
- **Capacidad:** ~1000 req/seg en hardware UCN
- **Real:** 42 alumnos en 4 minutos = 0.175 req/seg → Sin problemas

**🔴 Hotspot Crítico:** ¿Cómo evitar que un alumno ausente pida foto del QR a compañero?

- **Mitigación 1:** QR cambia cada 10 segundos → foto vieja inválida
- **Mitigación 2:** Validación IP requiere estar en red UCN
- **Mitigación 3:** Hora_marca registrada → profesor ve si marcó sin estar físicamente

**🔴 Hotspot:** Alumno sin smartphone o batería agotada

- **Solución 1:** Usar computador de la sala (si hay)
- **Solución 2:** Profesor marca manualmente post-clase (asist_lista.php)
- **Solución 3:** Compañero presta teléfono (solo debe logearse)

### FASE 3: Feedback Post-Asistencia (Opcional, 1-2 minutos)

       - IP estudiante: 200.14.84.156 (red UCN Coquimbo)
       - acepta_origen_ip: "UCN" o "ALL"
       - ✅ VÁLIDO
         ↓
    🟢 VALIDACIÓN 4: No duplicado
       - Query: SELECT 1 FROM alumno_asistencia
         WHERE rut='20123456-7' AND fecha=20250108 AND bloque=1
       - Result: 0 registros
       - ✅ VÁLIDO (primera marca)
         ↓
    🔵 POST /asistencia/api/attendance/mark
       Body: {
         "reservationCode": "CVYAFO",
         "totp": "847362",
         "studentRut": "20123456-7"
       }
         ↓

🟠 Asistencia Registrada en PostgreSQL
INSERT INTO alumno_asistencia VALUES (
rut: '20123456-7',
curso: 429, -- IWI-131
semestre: 5, -- 1-2025
fecha: 20250108, -- 08 enero 2025
bloque: 1, -- 08:00-09:30
estado: 1, -- Presente
hora_marca: '2025-01-08 08:03:45'
)
↓
🟠 Registro Confirmado - HTTP 201 Created - Response: {
"success": true,
"message": "Asistencia registrada exitosamente",
"studentName": "María González",
"courseName": "Programación Avanzada",
"timestamp": "08:03:45"
}
↓
📝 Frontend muestra: "✅ Asistencia registrada - María González"
↓
🟢 Auto-redirect en 2 segundos
↓
🟠 Encuesta Post-Asistencia Mostrada - URL: asist0.php?c=CVYAFO - Tipo: 2 (Encuesta completa) - Campos: Nota clase, Objetivos, Puntualidad, Comentarios

```

**⏱️ Tiempo Total del Flujo:** 15-20 segundos por estudiante
- Abrir modal: 2 seg
- Activar cámara: 1 seg
- Escanear QR: 3-5 seg
- Validaciones backend: 0.5 seg
- Confirmación visual: 2 seg

**📊 Capacidad:** 42 alumnos pueden marcar en ~3-4 minutos (escaneos paralelos) Fase 4: Feedback Post-Asistencia
```

🟡 Estudiante
↓
🔵 Completar Encuesta
↓
🟠 Encuesta Respondida - tipo (2-7) - nota (1-7) - comentario - objetivos_cumplidos - puntualidad
↓
🟣 PostgreSQL → comentarios_clase
↓
🟠 Feedback Guardado
↓
📝 Mensaje de Confirmación

```

**Tipos de Encuesta:**
- **Tipo 2:** Completa (nota, objetivos, puntualidad, comentario)
- **Tipo 3:** Simple (nota, comentario)
- **Tipo 4:** One Minute Paper básico
- **Tipo 5:** One Minute Paper con positivo/negativo
- **Tipo 6-7:** Variantes específicas

### Fase 5: Consulta de Asistencia (Profesor)
```

🟡 Profesor
↓
🔵 Ver Lista de Asistencia
↓
📝 asist_lista.php
↓
🟠 Lista Renderizada - Filtros: fecha, bloque - Columnas: RUT, Nombre, Estado, Hora
↓
🟢 Si faltan alumnos
↓
🔵 Marcar Asistencia Manual (opcional)
↓
🟠 Asistencia Manual Registrada

```

---

## 🔥 Hotspots Identificados (Riesgos y Preguntas)

### 1. Sincronización de Tiempo
**🔴 Problema:** TOTP depende de sincronización de relojes (servidor backend vs servidor PHP vs cliente)
- **Impacto:** Si hay desincronización >30 seg, QR válido puede rechazarse
- **Mitigación:**
  - Configurar NTP en servidores
  - Aumentar ventana de tolerancia TOTP si es necesario
  - Logging de diferencias de tiempo

### 2. Expiración de Sesión Durante Clase
**🔴 Problema:** TTL de 5 minutos puede ser insuficiente para clases grandes (40+ alumnos)
- **Impacto:** Últimos alumnos no pueden marcar
- **Mitigación:**
  - TTL configurable por curso/sala
  - Profesor puede extender TTL desde interfaz
  - Notificación visual cuando quedan 2 minutos

### 3. Concurrencia en Horarios Paralelos
**🔴 Problema:** Profesor dicta 2 secciones del mismo curso en bloques consecutivos
- **Impacto:** Constraint UNIQUE (curso, fecha, bloque) bloquea segunda sesión
- **Opciones:**
  - Usar NRC (sección) en lugar de curso
  - Permitir múltiples códigos por curso/bloque
  - Agregar campo `seccion` a asistencia_curso

### 4. Conflicto de Schemas PostgreSQL
**🔴 Problema:** Sistema legacy y nuevo sistema comparten tablas pero diferentes filosofías
- **Impacto:** Cambios en legacy pueden romper asistencia moderna
- **Mitigación:**
  - Views en lugar de tablas directas
  - Foreign keys para integridad
  - Tests de integración

### 5. JWT Secret Sincronización
**🔴 Problema:** PHP y Node.js deben compartir mismo JWT_SECRET
- **Impacto:** Si no coinciden, tokens inválidos
- **Mitigación:**
  - Validación pre-deploy automática
  - Single source of truth (.env compartido)
  - Test de integración JWT cross-service

---

## 🔄 Políticas de Negocio (Reglas Automáticas)

### Política 1: Auto-Expiración de Sesiones
```

CUANDO Sesión de Asistencia Abierta
Y fechahora_termino < NOW()
ENTONCES Sesión Expirada
→ Rechazar nuevas marcas con HTTP 410
→ Frontend muestra "Sesión finalizada"

```

### Política 2: Prevención de Duplicados
```

CUANDO Estudiante intenta Marcar Asistencia
Y YA EXISTE registro (rut, fecha, bloque)
ENTONCES Rechazar con HTTP 409
→ Frontend muestra "Ya registraste tu asistencia"

```

### Política 3: Restricción por IP (Opcional)
```

CUANDO Estudiante marca desde fuera de red UCN
Y acepta_origen_ip = "UCN"
ENTONCES Rechazar con HTTP 403
→ Frontend muestra "Debes estar en red UCN"

```

### Política 4: Encuesta Obligatoria Post-Asistencia
```

CUANDO Asistencia Registrada exitosamente
ENTONCES Redirigir a asist0.php?c={codigo}
→ Estudiante completa feedback
→ Guardado en comentarios_clase

```

### Política 5: Regeneración de QR
```

CUANDO Sesión de Asistencia Activa
CADA 10 segundos
ENTONCES Generar nuevo TOTP
→ Actualizar payload QR
→ Push via WebSocket a frontend

````

---

## 👥 Actores del Sistema

### 1. Profesor 👨‍🏫
**Responsabilidades:**
- Abrir sesiones de asistencia
- Configurar tipo de encuesta
- Proyectar QR en pantalla
- Consultar lista de asistencia
- (Opcional) Marcar asistencia manual

**Pain Points:**
- Configurar encuesta antes de cada clase
- Proyector puede fallar → necesita backup
- Alumnos sin teléfono → proceso manual tedioso

### 2. Estudiante 👨‍🎓
**Responsabilidades:**
- Escanear QR del profesor
- Completar encuesta post-asistencia
- Verificar registro en pantalla general

**Pain Points:**
- QR cambia muy rápido → dificulta escaneo
- Red UCN lenta → timeout al marcar
- Sin teléfono → no puede marcar (edge case)

### 3. Administrador Académico 👨‍💼
**Responsabilidades:**
- Crear cursos en sistema
- Asignar profesores
- Configurar semestres
- Validar integridad de datos

**Pain Points:**
- Cursos sin profesor asignado
- Datos desactualizados de Banner
- Necesita reportes de asistencia global

### 4. Sistema Legacy Hawaii 🖥️
**Responsabilidades:**
- Gestionar sesiones PHP
- Proveer datos de cursos/estudiantes
- Renderizar pantallas (horario.php, main_curso.php)

**Integraciones:**
- JWT generation via `/asistencia-node-integration/api/token`
- Consulta de datos via API REST
- Renderizado de iframes

### 5. Backend Node.js (Fastify) ⚡
**Responsabilidades:**
- Generar códigos TOTP criptográficos
- Validar marcas de asistencia
- Gestionar WebSocket para QR dinámico
- Persistir datos en PostgreSQL

**Dependencias:**
- PostgreSQL (shared schema)
- Valkey/Redis (cache, sessions)
- JWT_SECRET (sincronizado con PHP)

---

## 📊 Read Models (Vistas de Consulta)

### Vista 1: Lista de Asistencia del Día
```sql
SELECT
  a.nombre,
  aa.rut,
  aa.fecha,
  b.nombre as bloque,
  aa.estado,
  aa.hora_marca
FROM alumno_asistencia aa
JOIN alumno a ON aa.rut = a.rut
JOIN bloque b ON aa.bloque = b.numero
WHERE aa.curso = :idCurso
  AND aa.fecha = :fecha
ORDER BY aa.hora_marca DESC;
````

### Vista 2: Estadísticas de Asistencia por Curso

```sql
SELECT
  c.nombre as curso,
  COUNT(DISTINCT aa.rut) as total_alumnos,
  COUNT(DISTINCT aa.fecha) as dias_con_registro,
  ROUND(AVG(CASE WHEN aa.estado = 1 THEN 100.0 ELSE 0 END), 2) as porcentaje_presente
FROM curso c
LEFT JOIN alumno_asistencia aa ON c.id = aa.curso
WHERE c.semestre = :idSemestre
GROUP BY c.id, c.nombre;
```

### Vista 3: Sesiones Activas (Dashboard Tiempo Real)

```sql
SELECT
  c.nombre as curso,
  ac.fecha,
  ac.bloque,
  ac.codigo,
  ac.fechahora_inicio,
  ac.fechahora_termino,
  EXTRACT(EPOCH FROM (ac.fechahora_termino - NOW())) as segundos_restantes,
  COUNT(aa.rut) as alumnos_registrados
FROM asistencia_curso ac
JOIN curso c ON ac.curso = c.id
LEFT JOIN alumno_asistencia aa ON ac.curso = aa.curso
  AND ac.fecha = aa.fecha
  AND ac.bloque = aa.bloque
WHERE ac.fechahora_termino > NOW()
GROUP BY ac.id, c.nombre
ORDER BY ac.fechahora_inicio DESC;
```

---

## 🏗️ Agregados Identificados (DDD Bounded Contexts)

### Agregado 1: **Attendance Session** (Sesión de Asistencia)

**Root Entity:** `asistencia_curso`  
**Entities:**

- AttendanceSession (id, curso, fecha, bloque, codigo, ttl)
- TOTPGenerator (algoritmo criptográfico)

**Value Objects:**

- ReservationCode (6 chars, uppercase, unique)
- TimeWindow (fechahora_inicio, fechahora_termino)

**Invariantes:**

- Código único por sesión
- TTL > 0 y <= 60 minutos
- UNIQUE (curso, fecha, bloque)

### Agregado 2: **Attendance Record** (Registro de Asistencia)

**Root Entity:** `alumno_asistencia`  
**Entities:**

- AttendanceRecord (rut, curso, fecha, bloque, estado, hora_marca)

**Value Objects:**

- RUT (validación dígito verificador)
- AttendanceStatus (enum: presente, ausente, justificado)

**Invariantes:**

- UNIQUE (rut, fecha, bloque)
- hora_marca <= NOW()
- estado en valores permitidos

### Agregado 3: **Course Enrollment** (Inscripción de Curso)

**Root Entity:** `curso`  
**Entities:**

- Course (id, nrc, nombre, profesor, semestre)
- Enrollment (alumno, curso, semestre)

**Invariantes:**

- Curso debe tener profesor asignado
- Estudiante solo puede inscribirse una vez por curso/semestre

---

## 🔀 Flujos Alternativos (Edge Cases)

### Flujo 1: Profesor Pierde Conexión Durante Proyección

```
🟠 Sesión de Asistencia Abierta
    ↓
🔴 WebSocket Desconectado (profesor)
    ↓
🟢 Backend mantiene sesión activa (no depende de WebSocket)
    ↓
🟡 Estudiantes siguen marcando (QR sigue válido)
    ↓
📝 Profesor reconecta → Continúa desde donde quedó
```

### Flujo 2: Alumno Sin Teléfono o Cámara Dañada

```
🟡 Estudiante sin medio de escaneo
    ↓
🔵 Solicitar al Profesor marca manual
    ↓
🟡 Profesor accede a asist_lista.php
    ↓
🔵 Marcar manualmente (cambio de estado)
    ↓
🟠 Asistencia Manual Registrada
    ↓
📝 Sin encuesta (registro manual no redirige)
```

### Flujo 3: Error en PostgreSQL Durante Marca

```
🔵 Marcar Asistencia
    ↓
🔴 PostgreSQL Timeout / Connection Error
    ↓
🟢 Backend captura excepción
    ↓
🟠 Error 500 enviado a frontend
    ↓
📝 Frontend muestra "Error del sistema, intenta nuevamente"
    ↓
🟢 Backend registra log con stack trace
    ↓
🔵 Alumno reintenta (si sesión sigue activa)
```

---

## 📈 Eventos de Negocio (Business Events)

Estos eventos pueden disparar notificaciones, reportes o integraciones:

### 1. `AttendanceSessionStarted`

```json
{
  "eventType": "AttendanceSessionStarted",
  "timestamp": "2025-01-08T08:00:00Z",
  "data": {
    "sessionId": 12345,
    "courseId": 429,
    "courseName": "Programación Avanzada",
    "professorId": 987,
    "block": 1,
    "ttl": 300
  }
}
```

**Suscriptores:**

- Dashboard de monitoreo (mostrar sesiones activas)
- Sistema de notificaciones (alertar a estudiantes inscritos)

### 2. `AttendanceMarked`

```json
{
  "eventType": "AttendanceMarked",
  "timestamp": "2025-01-08T08:03:45Z",
  "data": {
    "rut": "186875052",
    "studentName": "Juan Pérez",
    "courseId": 429,
    "block": 1,
    "status": "present"
  }
}
```

**Suscriptores:**

- Real-time dashboard (contador de presentes)
- Analytics (estadísticas de puntualidad)

### 3. `AttendanceSessionExpired`

```json
{
  "eventType": "AttendanceSessionExpired",
  "timestamp": "2025-01-08T08:05:00Z",
  "data": {
    "sessionId": 12345,
    "courseId": 429,
    "totalMarked": 38,
    "totalEnrolled": 42,
    "attendanceRate": 0.905
  }
}
```

**Suscriptores:**

- Sistema de reportes (generar estadística diaria)
- Notificaciones (alertar profesor sobre ausentes)

---

## 🎓 Lenguaje Ubicuo (Ubiquitous Language)

Términos clave del dominio que todo el equipo debe usar consistentemente:

| Término Español       | Término Técnico                | Definición                                            |
| --------------------- | ------------------------------ | ----------------------------------------------------- |
| **Reserva**           | `AttendanceSession`            | Sesión de asistencia abierta por el profesor          |
| **Código de Reserva** | `ReservationCode`              | Identificador único de 6 caracteres (ej: CVYAFO)      |
| **TOTP**              | `Time-based One-Time Password` | Código criptográfico que cambia cada 10 segundos      |
| **Marcar**            | `Mark Attendance`              | Acción de registrar asistencia escaneando QR          |
| **Bloque**            | `Block`                        | Período de clase (1-8, corresponde a horarios UCN)    |
| **Presente**          | `Present`                      | Estado de asistencia confirmada (valor 1)             |
| **TTL**               | `Time To Live`                 | Duración de validez de la sesión (5-10 minutos)       |
| **NRC**               | `NRC`                          | Número de Referencia del Curso (identificador Banner) |

---

## 🚀 Próximos Pasos Identificados

### Corto Plazo (Sprint 1-2)

1. ✅ Separar backend de Vite
2. ✅ Implementar 115+ tests PHP
3. ✅ Migrar endpoint legacy
4. ⏳ Validar 7 requisitos funcionales

### Mediano Plazo (Post-Producción)

1. **Event Sourcing:** Considerar guardar eventos en lugar de solo estado final

   - Permite auditoría completa
   - Facilita debugging de problemas históricos
   - Habilita analytics avanzado

2. **CQRS:** Separar modelos de escritura y lectura

   - AttendanceWriter (comandos)
   - AttendanceReader (queries optimizadas)

3. **Notificaciones en Tiempo Real:**

   - Push notifications a estudiantes cuando profesor abre sesión
   - Alerts a profesor cuando >80% han marcado

4. **Dashboard Analytics:**
   - Tendencias de asistencia por curso
   - Predicción de ausencias
   - Comparativas entre secciones

---

## 📝 Conclusiones del Event Storming

**Descubrimientos Clave:**

1. El dominio es **event-driven** por naturaleza (sesiones activas, marcas, expiraciones)
2. TOTP es el corazón del sistema de seguridad → cualquier problema aquí es crítico
3. Concurrencia y sincronización de tiempo son **hotspots** principales
4. Sistema legacy es **bounded context** separado que debe integrarse cuidadosamente

**Riesgos Mitigados:**

- Sincronización de tiempo → NTP + tolerancia
- Expiración prematura → TTL configurable
- Duplicados → Constraints UNIQUE
- Conflictos de schema → Foreign keys + tests

**Arquitectura Emergente:**

- 3 agregados principales (Session, Record, Enrollment)
- Event-driven communication (WebSocket para QR)
- Shared kernel con sistema legacy (PostgreSQL)

---

**Facilitado por:** GitHub Copilot & Equipo de Desarrollo  
**Revisión:** 31 de diciembre de 2025  
**Próxima Sesión:** Post-producción para análisis de eventos históricos
