# Impact Mapping - Sistema de Asistencia QR Criptografico
Institución: Universidad Católica del Norte - Campus Coquimbo 
Unidad: Escuela de Ingeniería 
Fecha: de diciembre de  
T�cnica: Mapeo de Impacto para producto de toma de asistencia
---
## GOAL (Meta de Negocio)
 Objetivo Principal
> "Reducir el tiempo de toma de asistencia en clases presenciales de ingenieria de - minutos a menos de minutos, manteniendo precision del %+ y eliminando fraude por suplantacion"
M�tricas de Exito:
- Tiempo: De min -> min (reduccion %)
- Precision: >% registros correctos (sin errores de transcripcion)
- Fraude: % suplantacion (QR dinámico + IP validation)
- Adopcion: >% profesores activos en Escuela de Ingeniería
- ROI: Ahorro de min/clase x clases/semestre = , minutos recuperados
---
## ACTORS (Actores Clave)
 Actor : Profesores de Ingeniería ( profesores)
Qui�nes son?
- Docentes de tiempo completo y adjuntos
- Dictan cursos como: Programación, Calculo, Física, Estructuras de Datos
- Edad: - años
- Nivel tecnológico: Variable (desde usuarios básicos a expertos)
Pain Points Actuales:
- Pierden - minutos tomando lista manualmente
- Planilla Excel propensa a errores de transcripcion
- Dificil detectar fraude (firmas falsas)
- Reportes finales requieren consolidacion manual
Motivaciones:
- Maximizar tiempo efectivo de enseñanza
- Cumplir normativa universitaria de control de asistencia
- Tener datos precisos para evaluación
- Evitar reclamos de estudiantes ("si asistí, no me marcaron")
---
 Actor : Estudiantes de Ingeniería (~ activos)
Qui�nes son?
- Alumnos de Ingeniería Civil Informatica, Mecanica, Industrial
- Edad: - años
- Nativos digitales: % tiene smartphone
- Cursan - ramos simultaneos
Pain Points Actuales:
- Proceso de lista manual es lento y aburrido
- A veces olvidan firmar (llegaron pero no firmaron)
- Interrupciones cuando profesor lee nombres en voz alta
- Sin feedback inmediato si fueron registrados
Motivaciones:
- Proceso rápido que no interrumpa la clase
- Confirmacion visual instantanea ("si quede registrado")
- Usar tecnologia familiar (QR con celular)
- Evitar problemas con el % minimo de asistencia (% en UCN)
---
 Actor : Administradores Academicos ( personas)
Qui�nes son?
- Jefes de carrera de Ingeniería Civil Informatica, Mecanica, Industrial
- Secretarias academicas
- Coordinadores de docencia
Pain Points Actuales:
- Consolidar datos de asistencia de multiples profesores es tedioso
- Identificar alumnos en riesgo academico (baja asistencia) es reactivo
- Validar cumplimiento de normativa UCN toma tiempo
- Generar reportes para acreditacion es manual
Motivaciones:
- Reportes automatizados en tiempo real
- Alertas tempranas de alumnos con <% asistencia
- Cumplimiento normativo automatico
- Datos para acreditacion de carreras
---
## IMPACTS (Impactos Deseados)
 Para Profesores -> Impacto : Recuperar minutos por clase
Como ayudamos?
- Proceso de apertura de sesion en segundos ( clics)
- QR proyectado automaticamente (no requiere configuración)
- Alumnos marcan en paralelo mientras profesor inicia clase
- Cierre automatico tras TTL (no requiere accion del profesor)
Medicion:
- Tiempo promedio de apertura: < minuto
- % de profesores que usan el sistema: >%
- NPS de profesores: >/
Evidencia de Impacto:
- Survey post-implementación
- Logs de tiempos de sesion
- Entrevistas a profesores early adopters
---
 Para Profesores -> Impacto : Eliminar fraude por suplantacion
Como ayudamos?
- QR dinámico cambia cada segundos -> foto no sirve
- Validacion IP requiere estar en red UCN Coquimbo
- Timestamp de marca registrado -> detector de añomalias
Medicion:
- Intentos de marca con IP externa (bloqueados)
- Comparativa: asistencia registrada vs. observacion visual del profesor
- Reporte de añomalias (ej: alumno marco a las : pero llego :)
Evidencia de Impacto:
- reportes de fraude en primer semestre
- Dashboard de añomalias para revision
---
 Para Estudiantes -> Impacto : Proceso rápido (< segundos)
Como ayudamos?
- Modal de escaneo abre en segundos
- Camara activa automaticamente
- Escaneo ZXing optimizado (reconoce en - seg)
- Confirmacion visual inmediata con nombre del alumno
Medicion:
- Tiempo promedio de marca: < segundos (medido en logs)
- % de exito en primer intento: >%
- Tasa de abandono: <%
Evidencia de Impacto:
- Logs de performance frontend
- Encuesta de satisfaccion estudiantil
- M�tricas de UX (tiempo de interaccion)
---
 Para Estudiantes -> Impacto : Feedback inmediato de registro
Como ayudamos?
- Mensaje de exito muestra: "Asistencia registrada - [Nombre Estudiante]"
- Color verde + icono check
- Timestamp visible: "::"
- Nombre del curso: "Programación Avanzada"
Medicion:
- % de estudiantes que reportan "no se si quede registrado": <%
- Encuesta post-clase: "?Te sentiste seguro de que tu asistencia quedo registrada?"
- Reduccion de consultas a profesor: "?quede presente?"
Evidencia de Impacto:
- Encuesta semestral
- Conteo de tickets de soporte
---
 Para Administradores -> Impacto : Reportes automaticos en tiempo real
Como ayudamos?
- Dashboard con sesiones activas del dia
- Reporte de asistencia por curso/alumno en asist_lista.php
- Exportacion a Excel con un clic
- Estadisticas agregadas: % promedio de asistencia por curso
Medicion:
- Tiempo de generacion de reporte: De horas -> minutos
- % de administradores que usan reportes automaticos: >%
- Reduccion de emails solicitando datos: %
Evidencia de Impacto:
- Survey a jefes de carrera
- Conteo de reportes generados/mes
- Tiempo registrado en tareas administrativas
---
 DELIVERABLES (Entregables que Generan Impacto)
 Para lograr Impacto (Recuperar minutos):
 Deliverable .: Boton "Nuevo Sistema de Asistencia" en main_curso.php
Prioridad: CRITICA 
Esfuerzo: dias 
Dependencias: JWT generation funcional 
Validacion:
- [ ] Boton visible solo para profesores autorizados
- [ ] Clic abre modal en <ms
- [ ] Iframe carga features/qr-host/ con token
 Deliverable .: Generacion automatica de QR dinámico
Prioridad: CRITICA 
Esfuerzo: dias 
Dependencias: TOTP library (otplib), WebSocket 
Validacion:
- [ ] QR cambia cada segundos exactos
- [ ] Payload incluye código, TOTP, timestamp
- [ ] WebSocket mantiene conexion estable
 Deliverable .: Cierre automatico de sesion tras TTL
Prioridad: ALTA 
Esfuerzo: dia 
Dependencias: Validacion backend de fechahora_termino 
Validacion:
- [ ] Sesion expira exactamente al cumplir TTL
- [ ] Intentos post-expiracion retornan HTTP 
- [ ] Frontend muestra "Sesion finalizada"
---
 Para lograr Impacto (Eliminar fraude):
 Deliverable .: TOTP criptográfico con ventana de segundos
Prioridad: CRITICA 
Esfuerzo: dias 
Dependencias: Algoritmo HMAC-SHA 
Validacion:
- [ ] TOTP valido solo dentro de ventana de seg
- [ ] TOTP de hace minuto rechazado
- [ ] Test automatizado de generacion/validación
 Deliverable .: Validacion de IP por red UCN
Prioridad: ALTA 
Esfuerzo: dia 
Dependencias: Configuracion de rangos IP UCN 
Validacion:
- [ ] IP ...\ (UCN Coquimbo) permitida
- [ ] IP externa rechazada con HTTP 
- [ ] Configurable por curso (acepta_origen_ip: UCN/ALL)
 Deliverable .: Registro de timestamp de marca
Prioridad: MEDIA 
Esfuerzo: . dias 
Dependencias: Campo hora_marca en alumno_asistencia 
Validacion:
- [ ] hora_marca registra timestamp exacto
- [ ] Dashboard muestra hora de marca por alumno
- [ ] Detector de añomalias (marca vs. observacion visual)
---
 Para lograr Impacto (Proceso rápido):
 Deliverable .: Boton "Tomar Asistencia" en horario.php
Prioridad: CRITICA 
Esfuerzo: dia 
Dependencias: JWT generation para estudiantes 
Validacion:
- [ ] Boton visible solo para estudiantes (id == -)
- [ ] Modal abre lector QR en < seg
- [ ] Camara activa automaticamente
 Deliverable .: Lector QR optimizado con ZXing
Prioridad: CRITICA 
Esfuerzo: dias 
Dependencias: @zxing/browser library 
Validacion:
- [ ] Reconocimiento en - segundos
- [ ] Funciona con camaras de MP+ (smartphones comunes)
- [ ] Feedback visual mientras escanea
 Deliverable .: Validaciones backend en <ms
Prioridad: ALTA 
Esfuerzo: dias 
Dependencias: Indices PostgreSQL, conexion pool 
Validacion:
- [ ] validaciónes (TOTP, TTL, IP, duplicado) en <ms
- [ ] Response time p < segundo
- [ ] Concurrencia: requests simultaneos sin degradacion
---
 Para lograr Impacto (Feedback inmediato):
 Deliverable .: Mensaje de exito personalizado
Prioridad: ALTA 
Esfuerzo: . dias 
Dependencias: Response incluye nombre del estudiante 
Validacion:
- [ ] Muestra: "Asistencia registrada - [Nombre]"
- [ ] Incluye curso, timestamp, bloque
- [ ] Color verde + animacion de check
 Deliverable .: Redireccion a encuesta post-asistencia
Prioridad: MEDIA 
Esfuerzo: dia 
Dependencias: asist.php legacy 
Validacion:
- [ ] Auto-redirect en segundos
- [ ] URL correcta: asist.php?c={código}
- [ ] Encuesta carga sin reautenticacion
---
 Para lograr Impacto (Reportes automaticos):
 Deliverable .: Dashboard de sesiones activas
Prioridad: BAJA (Post-MVP) 
Esfuerzo: dias 
Dependencias: WebSocket server-to-server 
Validacion:
- [ ] Muestra sesiones activas en tiempo real
- [ ] Contador de alumnos registrados
- [ ] Tiempo restante de cada sesion
 Deliverable .: Exportacion a Excel desde asist_lista.php
Prioridad: MEDIA 
Esfuerzo: dias (ya implementado en sistema legacy) 
Dependencias: PHPExcel library 
Validacion:
- [ ] Boton "Exportar" genera Excel en < seg
- [ ] Columnas: RUT, Nombre, Fecha, Bloque, Estado
- [ ] Formato compatible con sistemas UCN
---
 Impact Map - Resumen Visual
```
                 GOAL
          Reducir tiempo asistencia %
             (min -> min)
                 |
     +------------------------+------------------------+
     |            |            |
  Profesores     Estudiantes    Administradores
     |            |            |
  +----+----+      +-----+-----+      +-----+-----+
  |     |      |      |      |      |
Recuperar Eliminar Proceso Feedback Reportes Alertas
 minutos  fraude   rápido   inmediato  automaticos tempranas
  |     |      |      |      |      |
  |     |      |      |      |      |
 [Boton] [TOTP]  [Lector QR] [Mensaje] [Excel]  [Dashboard]
 [QR Auto] [IP]  [<seg]  [Nombre]  [min]   [<%]
 [TTL Auto] [Log] [ZXing]  [?]    [Click]  [Email]
```
---
 Priorizacion de Impactos (MoSCoW)
 MUST HAVE (Criticos para MVP)
. Impacto : Recuperar minutos por clase
. Impacto : Eliminar fraude por suplantacion
. Impacto : Proceso rápido (< segundos)
. Impacto : Feedback inmediato de registro
Justificacion: Sin estos , el sistema no cumple la promesa de valor principal
 SHOULD HAVE (Importantes, Sprint )
. Impacto : Reportes automaticos (parcial - Excel ya existe)
Justificacion: Mejora operativa pero no bloquea adopcion
 COULD HAVE (Deseables, Post-MVP)
. Alertas tempranas de alumnos en riesgo
. Dashboard de sesiones activas en tiempo real
. Analytics de tendencias de asistencia
Justificacion: Aportan valor pero requieren inversion mayor
 WON'T HAVE (Fuera de scope actual)
- Integracion con sistema de notas
- App movil nativa (web responsive suficiente)
- Reconocimiento facial como alternativa
- Notificaciones push a estudiantes
---
 M�tricas de Validacion de Impacto
 Antes del Sistema (Baseline)
- Tiempo promedio toma de lista: - minutos
- Fraude reportado: ~ casos/semestre (estimado)
- Satisfaccion estudiantes: ./ (encuesta informal)
- Satisfaccion profesores: / (proceso tedioso)
- Tiempo generacion reportes: horas/reporte
 Después del Sistema (Target Enero )
- Tiempo promedio toma de lista: < minutos ?
- Fraude reportado: casos ?
- Satisfaccion estudiantes: >/ ?
- Satisfaccion profesores: >/ ?
- Tiempo generacion reportes: minutos ?
 Como Mediremos (Instrumentacion)
. Logs backend: Tiempo de sesion (apertura -> primer registro -> ultimo registro)
. Encuesta post-clase: Google Forms a muestra de alumnos (n=)
. Entrevistas: profesores early adopters (feedback cualitativo)
. Logs de seguridad: Intentos de marca con IP externa (bloqueados)
. Analytics: Contador de reportes Excel generados/mes
---
 Assumptions & Risks
 Asunciones Clave
Asuncion : %+ estudiantes tienen smartphone con camara
- Validacion: Encuesta pre-implementación confirmo %
Asuncion : Red WiFi UCN soporta conexiones simultaneas
- Validacion: Test de carga en sala L- exitoso
Asuncion : Profesores aceptaran proyectar QR (no ven perdida de control)
- Riesgo: Resistencia al cambio
- Mitigacion: Capacitacion + early adopters como champions
Asuncion : Sistema legacy (Hawaii) se mantiene estable
- Riesgo: Cambios en legacy rompen integración
- Mitigacion: Tests de integración + versionado de API
 Riesgos de Impacto
Riesgo Alto: Sincronizacion de tiempo entre servidores
- Impacto: TOTP invalido -> alumnos no pueden marcar
- Mitigacion: NTP configurado + ventana de tolerancia seg
Riesgo Medio: Proyector/pantalla falla en sala
- Impacto: QR no visible -> proceso se detiene
- Mitigacion: Profesor puede compartir código manual ( chars)
Riesgo Bajo: Alumnos sin telefono (estimado <%)
- Impacto: Necesitan proceso manual
- Mitigacion: Marca manual post-clase por profesor
---
 Roadmap de Impactos
### Fase : MVP (Enero ) - % del Valor
- Impactos , , , (criticos)
- requisitos funcionales validados
- Desplegado en produccion (mantochrisal.cl)
### Fase : Mejoras (Febrero-Marzo ) - % del Valor
- Dashboard de sesiones activas
- Alertas tempranas (<% asistencia)
- Reportes avanzados (tendencias)
### Fase : Escalamiento (Abril +) - % del Valor
- Expansion a otras escuelas de UCN Coquimbo
- Optimizaciones moviles
- Integracion con sistema de notas
---
Creado por: Equipo de Desarrollo UCN Coquimbo 
Revisado por: Escuela de Ingeniería 
Fecha: de diciembre de  
Próxima Revision: Post-despliegue (Enero )
