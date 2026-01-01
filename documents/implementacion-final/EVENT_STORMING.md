# Event Storming - Sistema de Asistencia con QR Criptografico
Institución: Universidad Católica del Norte - Campus Coquimbo 
Unidad: Escuela de Ingeniería 
Fecha: de diciembre de  
Facilitadores: Equipo de Desarrollo 
Objetivo: Descubrir rapidamente lo que esta sucediendo en el proceso de toma de asistencia en clases presenciales de ingenieria
---
## Contexto: UCN Coquimbo - Escuela de Ingeniería
Desafio: Modernizar el proceso de toma de asistencia en cursos presenciales
- Alumnos: - por curso tipico de ingenieria
- Horarios: Bloques de minutos ( bloques diarios)
- Problema Actual: Sistemas manuales lentos, propensos a fraude (firmar por companeros)
- Solucion: QR dinámico con códigos criptográficos (TOTP) que cambian cada segundos
---
## Leyenda de Colores
- Eventos de Dominio - Algo que sucedio (pasado)
- Comandos - Intencion de hacer algo
- Actores - Personas que ejecutan comandos
- Politicas - Reglas de negocio automaticas
- Sistemas Externos - Integraciones
- Hotspots - Problemas, preguntas, areas de conflicto
- Read Models - Informacion que se consulta
---
## Timeline de Eventos - Flujo de Toma de Asistencia
> Contexto: Clase presencial de "Programación Avanzada" (IWI-) con alumnos 
> Sala: Laboratorio de Computacion L-, Escuela de Ingeniería 
> Horario: Miercoles :-: (Bloque ) 
> Profesor: Cristian Salazar
---
### FASE : Profesor Inicia Sesion de Asistencia ( minutos)
```
Profesor
     ?
  Abrir Sesion de Asistencia
     ?
Sesion de Asistencia Abierta
  - idCurso
  - fecha
  - bloque (-)
  - tipo_encuesta (-)
  - fechahora_inicio
  - fechahora_termino (TTL: - min)
  - código_reserva ( chars: CVYAFO)
     ?
  Sistema genera código TOTP criptográfico
     ?
QR Dinamico Generado
  - Cambia cada segundos
  - Payload: {código, totp, timestamp}
     ?
  WebSocket -> Frontend Profesor
     ?
  QR Visible en Pantalla/Proyector
```
Hotspot: Qué pasa si el profesor cierra el modal antes de que todos marquen?
- Respuesta: Sesion sigue activa hasta `fechahora_termino`, alumnos pueden marcar
Hotspot: ?Puede haber multiples sesiones simultaneas del mismo curso?
- Respuesta: NO - Constraint UNIQUE (curso, fecha, bloque)
### Fase : Toma de Asistencia (Estudiante)
```
Estudiante
     ?
  Escanear QR
     ?
QR Escaneado
  - payload: {código, totp, timestamp}
   ASE : Estudiantes Marcan Asistencia (- minutos)
```
Estudiante (ej: Maria Gonzalez, RUT ..-) - Ubicacion: Sala L-, UCN Coquimbo - Dispositivo: Smartphone con camara

Abrir Sistema Hawaii en movil

horario.php carga con sesion activa

Clic en "Tomar Asistencia"

Modal de Lector QR Abierto - Iframe carga: /asistencia/features/qr-reader/ - JWT incluido en URL - Camara activada

Apuntar camara al proyector/pantalla del profesor

QR Detectado por ZXing Library - Payload decodificado: {código: "CVYAFO", totp: "", timestamp: }

VALIDACION : TOTP correcto - Verificar hash con algoritmo HMAC-SHA - Ventana de tolerancia: segundos - VALIDO

VALID Critico:\\ Qué pasa si alumnos intentan escanear simultaneamente?
- Respuesta: Backend Node.js (Fastify) maneja concurrencia nativa
- Capacidad: ~ req/seg en hardware UCN
- Real: alumnos en minutos = . req/seg -> Sin problemas
Hotspot Critico: Cómo evitar que un alumno ausente pida foto del QR a companero?
- Mitigacion : QR cambia cada segundos -> foto vieja invalida
- Mitigacion : Validacion IP requiere estar en red UCN
- Mitigacion : Hora_marca registrada -> profesor ve si marco sin estar fisicamente
Hotspot: Alumno sin smartphone o bateria agotada
- Solucion : Usar computador de la sala (si hay)
- Solucion : Profesor marca manualmente post-clase (asist_lista.php)
- Solucion : Companero presta telefono (solo debe logearse)
### FASE : Feedback Post-Asistencia (Opcional, - minutos)
    - IP estudiante: ... (red UCN Coquimbo)
    - acepta_origen_ip: "UCN" o "ALL"
    - VALIDO
     ?
  VALIDACION : No duplicado
    - Query: SELECT FROM alumno_asistencia
     WHERE rut='-' AND fecha= AND bloque=
    - Result: registros
    - VALIDO (primera marca)
     ?
  POST /asistencia/api/attendance/mark
    Body: {
     "reservationCode": "CVYAFO",
     "totp": "",
     "studentRut": "-"
    }
     ?
Asistencia Registrada en PostgreSQL
INSERT INTO alumno_asistencia VALUES (
rut: '-',
curso: , -- IWI-
semestre: , -- -
fecha: , -- enero 
bloque: , -- :-:
estado: , -- Presente
hora_marca: '-- ::'
)

Registro Confirmado - HTTP Created - Response: {
"success": true,
"message": "Asistencia registrada exitosamente",
"studentName": "Maria Gonzalez",
"courseName": "Programación Avanzada",
"timestamp": "::"
}

Frontend muestra: "? Asistencia registrada - Maria Gonzalez"

Auto-redirect en segundos

Encuesta Post-Asistencia Mostrada - URL: asist.php?c=CVYAFO - Tipo: (Encuesta completa) - Campos: Nota clase, Objetivos, Puntualidad, Comentarios
```
Tiempo Total del Flujo: - segundos por estudiante
- Abrir modal: seg
- Activar camara: seg
- Escanear QR: - seg
- Validaciones backend: . seg
- Confirmacion visual: seg
Capacidad: alumnos pueden marcar en ~- minutos (escaneos paralelos) Fase : Feedback Post-Asistencia
```
Estudiante

Completar Encuesta

Encuesta Respondida - tipo (-) - nota (-) - comentario - objetivos_cumplidos - puntualidad

PostgreSQL -> comentarios_clase

Feedback Guardado

Mensaje de Confirmacion
```
Tipos de Encuesta:
- Tipo : Completa (nota, objetivos, puntualidad, comentario)
- Tipo : Simple (nota, comentario)
- Tipo : One Minute Paper basico
- Tipo : One Minute Paper con positivo/negativo
- Tipo -: Variantes especificas
### Fase : Consulta de Asistencia (Profesor)
```
Profesor

Ver Lista de Asistencia

asist_lista.php

Lista Renderizada - Filtros: fecha, bloque - Columnas: RUT, Nombre, Estado, Hora

Si faltan alumnos

Marcar Asistencia Manual (opcional)

Asistencia Manual Registrada
```
---
 Hotspots Identificados (Riesgos y Preguntas)
 . Sincronizacion de Tiempo
Problema: TOTP depende de sincronizacion de relojes (servidor backend vs servidor PHP vs cliente)
- Impacto: Si hay desincronizacion > seg, QR valido puede rechazarse
- Mitigacion:
 - Configurar NTP en servidores
 - Aumentar ventana de tolerancia TOTP si es necesario
 - Logging de diferencias de tiempo
 . Expiracion de Sesion Durante Clase
Problema: TTL de minutos puede ser insuficiente para clases grandes (+ alumnos)
- Impacto: Ultimos alumnos no pueden marcar
- Mitigacion:
 - TTL configurable por curso/sala
 - Profesor puede extender TTL desde interfaz
 - Notificacion visual cuando quedan minutos
 . Concurrencia en Horarios Paralelos
Problema: Profesor dicta secciones del mismo curso en bloques consecutivos
- Impacto: Constraint UNIQUE (curso, fecha, bloque) bloquea segunda sesion
- Opciones:
 - Usar NRC (seccion) en lugar de curso
 - Permitir multiples códigos por curso/bloque
 - Agregar campo `seccion` a asistencia_curso
 . Conflicto de Schemás PostgreSQL
Problema: Sistema legacy y nuevo sistema comparten tablas pero diferentes filosofias
- Impacto: Cambios en legacy pueden romper asistencia moderna
- Mitigacion:
 - Views en lugar de tablas directas
 - Foreign keys para integridad
 - Tests de integración
 . JWT Secret Sincronizacion
Problema: PHP y Node.js deben compartir mismo JWT_SECRET
- Impacto: Si no coinciden, tokens invalidos
- Mitigacion:
 - Validacion pre-deploy automatica
 - Single source of truth (.env compartido)
 - Test de integración JWT cross-service
---
 Politicas de Negocio (Reglas Automaticas)
 Politica : Auto-Expiracion de Sesiones
```
CUANDO Sesion de Asistencia Abierta
Y fechahora_termino < NOW()
ENTONCES Sesion Expirada
-> Rechazar nuevas marcas con HTTP 
-> Frontend muestra "Sesion finalizada"
```
 Politica : Prevencion de Duplicados
```
CUANDO Estudiante intenta Marcar Asistencia
Y YA EXISTE registro (rut, fecha, bloque)
ENTONCES Rechazar con HTTP 
-> Frontend muestra "Ya registraste tu asistencia"
```
 Politica : Restriccion por IP (Opcional)
```
CUANDO Estudiante marca desde fuera de red UCN
Y acepta_origen_ip = "UCN"
ENTONCES Rechazar con HTTP 
-> Frontend muestra "Debes estar en red UCN"
```
 Politica : Encuesta Obligatoria Post-Asistencia
```
CUANDO Asistencia Registrada exitosamente
ENTONCES Redirigir a asist.php?c={código}
-> Estudiante completa feedback
-> Guardado en comentarios_clase
```
 Politica : Regeneracion de QR
```
CUANDO Sesion de Asistencia Activa
CADA segundos
ENTONCES Generar nuevo TOTP
-> Actualizar payload QR
-> Push via WebSocket a frontend
````
---
 Actores del Sistema
 . Profesor ???
Responsabilidades:
- Abrir sesiones de asistencia
- Configurar tipo de encuesta
- Proyectar QR en pantalla
- Consultar lista de asistencia
- (Opcional) Marcar asistencia manual
Pain Points:
- Configurar encuesta antes de cada clase
- Proyector puede fallar -> necesita backup
- Alumnos sin telefono -> proceso manual tedioso
 . Estudiante ???
Responsabilidades:
- Escanear QR del profesor
- Completar encuesta post-asistencia
- Verificar registro en pantalla general
Pain Points:
- QR cambia muy rápido -> dificulta escaneo
- Red UCN lenta -> timeout al marcar
- Sin telefono -> no puede marcar (edge case)
 . Administrador Academico ???
Responsabilidades:
- Crear cursos en sistema
- Asignar profesores
- Configurar semestres
- Validar integridad de datos
Pain Points:
- Cursos sin profesor asignado
- Datos desactualizados de Banner
- Necesita reportes de asistencia global
 . Sistema Legacy Hawaii ?
Responsabilidades:
- Gestionar sesiones PHP
- Proveer datos de cursos/estudiantes
- Renderizar pantallas (horario.php, main_curso.php)
Integraciones:
- JWT generation via `/asistencia-node-integration/api/token`
- Consulta de datos via API REST
- Renderizado de iframes
 . Backend Node.js (Fastify) ?
Responsabilidades:
- Generar códigos TOTP criptográficos
- Validar marcas de asistencia
- Gestionar WebSocket para QR dinámico
- Persistir datos en PostgreSQL
Dependencias:
- PostgreSQL (shared schema)
- Valkey/Redis (cache, sessions)
- JWT_SECRET (sincronizado con PHP)
---
 Read Models (Vistas de Consulta)
 Vista : Lista de Asistencia del Dia
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
 Vista : Estadisticas de Asistencia por Curso
```sql
SELECT
 c.nombre as curso,
 COUNT(DISTINCT aa.rut) as total_alumnos,
 COUNT(DISTINCT aa.fecha) as dias_con_registro,
 ROUND(AVG(CASE WHEN aa.estado = THEN . ELSE END), ) as porcentaje_presente
FROM curso c
LEFT JOIN alumno_asistencia aa ON c.id = aa.curso
WHERE c.semestre = :idSemestre
GROUP BY c.id, c.nombre;
```
 Vista : Sesiones Activas (Dashboard Tiempo Real)
```sql
SELECT
 c.nombre as curso,
 ac.fecha,
 ac.bloque,
 ac.código,
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
 Agregados Identificados (DDD Bounded Contexts)
 Agregado : Attendance Session (Sesion de Asistencia)
Root Entity: `asistencia_curso` 
Entities:
- AttendanceSession (id, curso, fecha, bloque, código, ttl)
- TOTPGenerator (algoritmo criptográfico)
Value Objects:
- ReservationCode ( chars, uppercase, unique)
- TimeWindow (fechahora_inicio, fechahora_termino)
Invariantes:
- Codigo unico por sesion
- TTL > y <= minutos
- UNIQUE (curso, fecha, bloque)
 Agregado : Attendance Record (Registro de Asistencia)
Root Entity: `alumno_asistencia` 
Entities:
- AttendanceRecord (rut, curso, fecha, bloque, estado, hora_marca)
Value Objects:
- RUT (validación digito verificador)
- AttendanceStatus (enum: presente, ausente, justificado)
Invariantes:
- UNIQUE (rut, fecha, bloque)
- hora_marca <= NOW()
- estado en valores permitidos
 Agregado : Course Enrollment (Inscripcion de Curso)
Root Entity: `curso` 
Entities:
- Course (id, nrc, nombre, profesor, semestre)
- Enrollment (alumno, curso, semestre)
Invariantes:
- Curso debe tener profesor asignado
- Estudiante solo puede inscribirse una vez por curso/semestre
---
 Flujos Alternativos (Edge Cases)
 Flujo : Profesor Pierde Conexion Durante Proyeccion
```
Sesion de Asistencia Abierta
  ?
WebSocket Desconectado (profesor)
  ?
Backend mantiene sesion activa (no depende de WebSocket)
  ?
Estudiantes siguen marcando (QR sigue valido)
  ?
Profesor reconecta -> Continua desde donde quedo
```
 Flujo : Alumno Sin Telefono o Camara Danada
```
Estudiante sin medio de escaneo
  ?
Solicitar al Profesor marca manual
  ?
Profesor accede a asist_lista.php
  ?
Marcar manualmente (cambio de estado)
  ?
Asistencia Manual Registrada
  ?
Sin encuesta (registro manual no redirige)
```
 Flujo : Error en PostgreSQL Durante Marca
```
Marcar Asistencia
  ?
PostgreSQL Timeout / Connection Error
  ?
Backend captura excepcion
  ?
Error enviado a frontend
  ?
Frontend muestra "Error del sistema, intenta nuevamente"
  ?
Backend registra log con stack trace
  ?
Alumno reintenta (si sesion sigue activa)
```
---
 Eventos de Negocio (Business Events)
Estos eventos pueden disparar notificaciones, reportes o integraciónes:
 . `AttendanceSessionStarted`
```json
{
 "eventType": "AttendanceSessionStarted",
 "timestamp": "--T::Z",
 "data": {
  "sessionId": ,
  "courseId": ,
  "courseName": "Programación Avanzada",
  "professorId": ,
  "block": ,
  "ttl": 
 }
}
```
Suscriptores:
- Dashboard de monitoreo (mostrar sesiones activas)
- Sistema de notificaciones (alertar a estudiantes inscritos)
 . `AttendanceMarked`
```json
{
 "eventType": "AttendanceMarked",
 "timestamp": "--T::Z",
 "data": {
  "rut": "",
  "studentName": "Juan Perez",
  "courseId": ,
  "block": ,
  "status": "present"
 }
}
```
Suscriptores:
- Real-time dashboard (contador de presentes)
- Analytics (estadisticas de puntualidad)
 . `AttendanceSessionExpired`
```json
{
 "eventType": "AttendanceSessionExpired",
 "timestamp": "--T::Z",
 "data": {
  "sessionId": ,
  "courseId": ,
  "totalMarked": ,
  "totalEnrolled": ,
  "attendanceRate": .
 }
}
```
Suscriptores:
- Sistema de reportes (generar estadistica diaria)
- Notificaciones (alertar profesor sobre ausentes)
---
 Lenguaje Ubicuo (Ubiquitous Language)
Terminos clave del dominio que todo el equipo debe usar consistentemente:
| Termino Español    | Termino Tecnico        | Definicion                      |
| --------------------- | ------------------------------ | ----------------------------------------------------- |
| Reserva      | `AttendanceSession`      | Sesion de asistencia abierta por el profesor     |
| Codigo de Reserva | `ReservationCode`       | Identificador unico de caracteres (ej: CVYAFO)   |
| TOTP       | `Time-based One-Time Password` | Codigo criptográfico que cambia cada segundos   |
| Marcar      | `Mark Attendance`       | Accion de registrar asistencia escaneando QR     |
| Bloque      | `Block`            | Periodo de clase (-, corresponde a horarios UCN)  |
| Presente     | `Present`           | Estado de asistencia confirmada (valor )       |
| TTL        | `Time To Live`         | Duracion de validez de la sesion (- minutos)    |
| NRC        | `NRC`             | Numero de Referencia del Curso (identificador Banner) |
---
 Proximos Pasos Identificados
 Corto Plazo (Sprint -)
. Separar backend de Vite
. Implementar + tests PHP
. Migrar endpoint legacy
. Validar requisitos funcionales
 Mediaño Plazo (Post-Produccion)
. Event Sourcing: Considerar guardar eventos en lugar de solo estado final
  - Permite auditoria completa
  - Facilita debugging de problemas historicos
  - Habilita analytics avanzado
. CQRS: Separar modelos de escritura y lectura
  - AttendanceWriter (comandos)
  - AttendanceReader (queries optimizadas)
. Notificaciones en Tiempo Real:
  - Push notifications a estudiantes cuando profesor abre sesion
  - Alerts a profesor cuando >% han marcado
. Dashboard Analytics:
  - Tendencias de asistencia por curso
  - Prediccion de ausencias
  - Comparativas entre secciones
---
 Conclusiones del Event Storming
Descubrimientos Clave:
. El dominio es event-driven por naturaleza (sesiones activas, marcas, expiraciones)
. TOTP es el corazon del sistema de seguridad -> cualquier problema aqui es critico
. Concurrencia y sincronizacion de tiempo son hotspots principales
. Sistema legacy es bounded context separado que debe integrarse cuidadosamente
Riesgos Mitigados:
- Sincronizacion de tiempo -> NTP + tolerancia
- Expiracion prematura -> TTL configurable
- Duplicados -> Constraints UNIQUE
- Conflictos de schema -> Foreign keys + tests
Arquitectura Emergente:
- agregados principales (Session, Record, Enrollment)
- Event-driven communication (WebSocket para QR)
- Shared kernel con sistema legacy (PostgreSQL)
---
Facilitado por: GitHub Copilot & Equipo de Desarrollo 
Revision: de diciembre de  
Próxima Sesion: Post-produccion para análisis de eventos historicos
