# Guion de Presentacion - Sistema de Asistencia QR Criptografico
Institución: Universidad Católica del Norte - Campus Coquimbo 
Unidad: Escuela de Ingeniería 
Duracion: - minutos 
Audiencia: Jurado tecnico + Stakeholders UCN
---
## ESTRUCTURA DE LA PRESENTACION
### SLIDE : PORTADA ( segundos)
Titulo: Sistema de Asistencia con QR Criptografico 
Subtitulo: Modernizando la toma de asistencia en la Escuela de Ingeniería UCN Coquimbo
Guion:
> "Buenos dias. Hoy presento el Sistema de Asistencia con QR Criptografico, desarrollado para la Escuela de Ingeniería de la Universidad Católica del Norte, Campus Coquimbo. Este proyecto resuelve un problema critico: la perdida de tiempo en clases presenciales por el proceso manual de toma de asistencia."
---
### SLIDE : EL PROBLEMA ( minutos)
Visual: Foto de profesor tomando lista manualmente + cronometro mostrando - minutos
Guion:
> "El contexto: La Escuela de Ingeniería tiene profesores que dictan clases a apróximadamente estudiantes activos. Cada clase, el profesor pierde entre y minutos tomando lista manualmente.
>
> El impacto cuantificado:
>
> - clases por semestre
> - minutos promedio por clase
> - = , minutos perdidos por semestre
> - = horas productivas desperdiciadas
>
> Problemas adicionales:
>
> - Fraude por suplantacion (alumnos firman por companeros ausentes)
> - Errores de transcripcion en planillas Excel
> - Falta de trazabilidad (realmente asistío?)
> - Reportes manuales para acreditacion ( horas por reporte)
>
> Este problema afecta directamente la calidad de la enseñanza, porque cada minuto perdido en administracion es un minuto menos de contenido academico."
---
### SLIDE : LA SOLUCION ( minutos)
Visual: Diagrama del flujo: Profesor proyecta QR -> Estudiante escanea -> Confirmacion instantanea
Guion:
> "La propuesta: Un sistema de asistencia basado en códigos QR dinámicos con criptografia TOTP que cambian cada segundos.
>
> Cómo funciona?
>
> . El profesor abre sesion en clics ( segundos)
> . El sistema genera un QR dinámico que se proyecta en pantalla
> . Los estudiantes escanean con su smartphone (proceso de - segundos)
> . Validacion instantanea y confirmacion visual
> . Datos registrados automaticamente en PostgreSQL
>
> Caracteristicas clave:
>
> - QR Dinamico: Cambia cada segundos -> imposible reutilizar capturas
> - TOTP Criptografico: Algoritmo HMAC-SHA con ventana de segundos
> - Validacion IP: Solo red UCN Coquimbo (...\)
> - No duplicados: Constraint UNIQUE (rut, fecha, bloque)
> - TTL Configurable: Sesion expira automaticamente (- minutos)
>
> El resultado: de minutos a menos de minutos por clase."
---
### SLIDE : EVENT STORMING - Timeline de Eventos ( minutos)
Visual: Timeline horizontal con fases coloreadas + ejemplo real
Guion:
> "Para entender el dominio, realice un Event Storming completo. Permitanme mostrarles el flujo con un caso real:
>
> Contexto del ejemplo:
>
> - Curso: Programación Avanzada (IWI-)
> - Profesor: Cristian Salazar
> - Sala: Laboratorio L-
> - Horario: Miercoles :-: (Bloque )
> - Alumnos: inscritos
>
> FASE : Profesor inicia sesion ( minutos)
>
> - Accede a Sistema Hawaii -> main_curso.php
> - Clic en 'Nuevo Sistema de Asistencia'
> - Modal se abre con QR proyectado automaticamente
> - Backend crea registro en tabla `asistencia_curso` con:
>  - Codigo unico: CVYAFO ( caracteres)
>  - TTL: minutos (fechahora_termino)
>  - Tipo encuesta: (completa)
>
> FASE : Estudiantes marcan (- minutos en paralelo)
>
> - Ejemplo: Maria Gonzalez (RUT ..-)
> - Abre horario.php -> Clic 'Tomar Asistencia'
> - Camara se activa automaticamente
> - Escanea QR con biblioteca ZXing
> - validaciónes en backend (<ms):
>  . TOTP correcto (hash HMAC-SHA valido)
>  . Sesion NO expirada (NOW < fechahora_termino)
>  . IP permitida (... = red UCN)
>  . No duplicado (primera marca del dia/bloque)
> - Registro en `alumno_asistencia` con timestamp exacto: ::
> - Frontend muestra: 'Asistencia registrada - Maria Gonzalez'
>
> FASE : Feedback post-asistencia (- minutos, opcional)
>
> - Auto-redirect a encuesta (asist.php?c=CVYAFO)
> - Alumno completa: nota, objetivos, puntualidad, comentarios
> - Guardado en tabla `comentarios_clase`
>
> Tiempo total: - segundos por estudiante. Con alumnos escaneando en paralelo, toda la clase puede marcar en - minutos.
>
> Hotspots identificados:
>
> - ? alumnos simultaneos saturan el backendNO: Fastify maneja req/seg
> - ?Alumno toma foto del QR para compartirNO: QR cambia cada seg + validación IP
> - ?Sin smartphoneSolucion: Marca manual post-clase por profesor"
---
### SLIDE : IMPACT MAPPING - Actores e Impactos ( minutos)
Visual: Diagrama de arbol: Goal -> Actores -> Impactos -> Deliverables
Guion:
> "Aplique Impact Mapping para conectar la meta de negocio con los impactos concretos por cada actor.
>
> GOAL (Meta de Negocio):
> 'Reducir el tiempo de toma de asistencia de - minutos a menos de minutos (% reduccion), manteniendo precision >% y eliminando fraude por suplantacion'
>
> ACTORES Y SUS IMPACTOS:
>
> . Profesores ( personas)
>
> - Impacto : Recuperar minutos por clase
>  - Deliverable: Boton en main_curso.php + QR automatico
>  - Medicion: Logs muestran tiempo de sesion
> - Impacto : Eliminar fraude por suplantacion
>  - Deliverable: TOTP criptográfico + validación IP
>  - Medicion: reportes de fraude vs ~/semestre antes
>
> . Estudiantes (~ personas)
>
> - Impacto : Proceso rápido (< segundos)
>  - Deliverable: Lector QR optimizado con ZXing
>  - Medicion: % exito en primer intento
> - Impacto : Feedback inmediato
>  - Deliverable: Mensaje personalizado con nombre
>  - Medicion: Reduccion % en consultas '?quede presente?'
>
> . Administradores Academicos ( personas)
>
> - Impacto : Reportes automaticos
>  - Deliverable: Exportacion Excel desde asist_lista.php
>  - Medicion: horas -> minutos por reporte
>
> Priorizacion MoSCoW:
>
> - MUST HAVE: Impactos , , , (MVP - Enero )
> - SHOULD HAVE: Impacto parcial (ya existe en legacy)
> - COULD HAVE: Dashboard tiempo real, alertas ML (Post-MVP)
> - WON'T HAVE: App nativa, reconocimiento facial, integración notas
>
> M�tricas de validación:
>
> - Baseline: - min/clase, fraude ~ casos/semestre
> - Target: < min/clase, fraude, satisfaccion >/
> - Instrumentacion: Logs backend, encuestas Google Forms, entrevistas cualitativas"
---
### SLIDE : BUSINESS MODEL CANVAS ( minutos)
Visual: Canvas completo de bloques (simplificado visualmente)
Guion:
> "Desarrolle un Business Model Canvas completo para validar la viabilidad del proyecto.
>
> VALUE PROPOSITIONS (Propuesta de Valor):
>
> - Para Profesores: 'Recupera minutos mientras eliminas fraude completamente'
> - Para Estudiantes: 'Marca en < seg con confirmacion instantanea'
> - Para Admins: 'Datos en tiempo real, reportes para acreditacion automaticos'
>
> CUSTOMER SEGMENTS:
>
> - Primario: profesores (edad -, nivel tech variable)
> - Secundario: estudiantes (nativos digitales, % con smartphone)
> - Terciario: administradores academicos
>
> KEY RESOURCES:
>
> - Stack tecnico: Fastify (backend), Vite (frontend), PostgreSQL, Valkey/Redis
> - Por que Fastify? x más rápido que Express, TypeScript nativo
> - Por que Vitest? -x más rápido que Jest, tests pasando
> - Testing robusto: + tests automatizados ( Node + PHP + EE)
>
> KEY PARTNERSHIPS:
>
> - Escuela de Ingeniería (sponsor y financiamiento)
> - Direccion TI UCN (infraestructura, Cloudflare Tunnel)
> - Sistema Legacy Hawaii (PostgreSQL compartido, sesiones PHP)
>
> COST STRUCTURE:
>
> - Desarrollo inicial: $, USD ( horas)
> - Infraestructura: $/año (VPS + CDN)
> - Operacion: $,/año (soporte + mantenimiento)
> - Total Año : $,
> - Años siguientes: $,/año
>
> VALUE GENERATED (no monetizado directamente):
>
> - Ahorro tiempo docente: , horas/año x $/hora = $,/año
> - Eficiencia administrativa: . horas/año x $/hora = $,/año
> - Reduccion fraude: Valor intangible (integridad academica)
> - Total valor generado: ~$,/año
>
> ROI (Return on Investment):
>
> - Inversion Año : $,
> - Valor generado: $,/año
> - ROI: % en primer año
> - Payback period: ~ meses
>
> El modelo es sostenible: con costos operativos de $,/año contra valor de $,/año, el proyecto se justifica economicamente y escala facilmente a otras facultades."
---
### SLIDE : ARQUITECTURA TECNICA ( minutos)
Visual: Diagrama de arquitectura: Cliente -> Apache -> Backend/Frontend -> PostgreSQL/Valkey
Guion:
> "Arquitectura de capas separadas:
>
> . Backend (Fastify - Node.js )
>
> - Framework: Fastify .. (x más rápido que Express)
> - Modulos DDD: Auth, Attendance, Session, Enrollment, Access
> - WebSocket para QR dinámico (actualizacion cada seg)
> - TOTP con biblioteca otplib (HMAC-SHA)
> - Testing: Vitest con tests (cobertura >%)
>
> . Frontend (Vite + TypeScript)
>
> - Bundler: Vite .. (build x más rápido que Webpack)
> - QR Reader: @zxing/browser (optimizado, reconoce en - seg)
> - QR Host: Canvas con WebSocket para actualizaciones
> - Integracion: Iframes en sistema legacy Hawaii
>
> . PHP Integration Module
>
> - Rol: Puente entre legacy Hawaii y backend Node.js
> - Genera JWT con sesion PHP ($\_SESSION['id'])
> - API REST para datos (UserData, CourseData, Enrollment)
> - Testing: PHPUnit con + tests (cobertura >%)
>
> Base de Datos (PostgreSQL +):
>
> - Schema compartido con sistema legacy
> - Tablas clave:
>  - `asistencia_curso`: Sesiones activas
>  - `alumno_asistencia`: Registros de asistencia
>  - `comentarios_clase`: Encuestas post-asistencia
> - Foreign keys para integridad referencial
>
> Cache (Valkey/Redis ..):
>
> - Sesiones activas (TTL - min)
> - TOTP codes en memoria (evita re-calculo)
>
> Infraestructura:
>
> - Apache . como reverse proxy
> - Cloudflare Tunnel para HTTPS externo (mantochrisal.cl)
> - Podman/Docker para containerizacion
> - GitHub Actions para CI/CD
>
> Decision arquitectonica critica:
>
> - Problema inicial: Backend mezclado con proyecto Vite
> - Solucion: Separacion en proyectos independientes
> - Beneficio: Builds independientes, deploys separados, claridad arquitectonica"
---
### SLIDE : ESTRATEGIA DE TESTING ( minutos)
Visual: Piramide de testing: Unit (+) -> Integration (+) -> EE () -> Manual ()
Guion:
> "Estrategia de testing multinivel:
>
> . Tests Unitarios ( tests)
>
> - Backend Node.js: tests con Vitest
>  - Auth: Token generation, validation, expiry
>  - Attendance: TOTP validation, session expiry, duplicate check
>  - Session: Creation, update, close
> - PHP Integration: + tests con PHPUnit
>  - JWT encoding/decoding ( tests)
>  - AuthenticationService ( tests)
>  - Controllers y Router (+ tests)
> - Cobertura: >% PHP, >% Node.js
>
> . Tests de Integracion (+ tests)
>
> - Base de datos: Inserts, constraints, foreign keys
> - API REST: Endpoints PHP <-> Backend Node
> - WebSocket: Conexion, mensajes, desconexion
>
> . Tests EE ( tests con Playwright)
>
> - Flujo profesor: Abrir sesion -> Proyectar QR
> - Flujo estudiante: Escanear QR -> Marcar asistencia -> Encuesta
> - Validacion completa: JWT generation -> TOTP validation -> DB persistence
>
> . Validacion Manual ( requisitos funcionales)
>
> - Sistema aislado: Health checks, logs sin errores 
> - Opciones UI: Botones visibles, modales funcionales
> - Registro asistencia: validaciónes en <ms
> - Encuestas: Redirect correcto, guardado en BD
> - Pantalla general: Datos en asist_lista.php
> - Duracion QR: TTL configurable, expiracion validada
>
> CI/CD con GitHub Actions:
>
> - Workflow automatico en cada push
> - Jobs paralelos: test-php + test-node
> - Linting: PHP CS Fixer + ESLint
> - Badge de estado en README
>
> Por qué Vitest y no Jest?
>
> - Velocidad: -x más rápido ( tests en - seg vs - seg)
> - TypeScript nativo: Sin configuración adicional
> - ESM support: Importaciones modernas
> - API compatible: Migración desde Jest es trivial
> - Mito desmitificado: Vitest NO es solo para frontend, es excelente para backend Node.js"
---
### SLIDE : SEGURIDAD Y VALIDACIONES ( minutos)
Visual: Diagrama de capas de seguridad + ejemplo de ataque fallido
Guion:
> "Sistema de seguridad multicapa:
>
> Capa : TOTP Criptografico
>
> - Algoritmo: HMAC-SHA (estandar RFC )
> - Secret compartido entre backend y frontend
> - Ventana de validez: segundos
> - Ataque bloqueado: Foto del QR -> TOTP expirado en seg
>
> Capa : Validacion de IP
>
> - Whitelist: Red UCN Coquimbo (...\)
> - Configurable por curso: 'UCN' o 'ALL'
> - Ataque bloqueado: Alumno desde casa -> HTTP Forbidden
>
> Capa : Constraint de Duplicados
>
> - UNIQUE (rut, fecha, bloque) en PostgreSQL
> - Ataque bloqueado: Doble marca -> HTTP Conflict
>
> Capa : Expiracion de Sesion (TTL)
>
> - fechahora_termino validada en cada request
> - Ataque bloqueado: QR viejo -> HTTP Gone
>
> Sincronizacion de JWT_SECRET:
>
> - Mismo secret en PHP y Node.js
> - Validacion pre-deploy automatica
> - Test de integración cross-service
>
> Trazabilidad completa:
>
> - Campo `hora_marca` con timestamp exacto
> - Logs estructurados en Winston (JSON)
> - Detector de añomalias: marca vs horario esperado
>
> Ejemplo de intento de fraude bloqueado:
>
> - Alumno A toma foto del QR a las :
> - Envia por WhatsApp a Alumno B (ausente)
> - Alumno B intenta marcar desde casa a las :
> - Resultado:
>  - TOTP expirado ( min después)
>  - IP externa (no red UCN)
>  - Sistema rechaza con error + log de intento"
---
### SLIDE : DESPLIEGUE Y OPERACIONES (. minutos)
Visual: Pipeline de deployment: Dev -> Staging -> Production
Guion:
> "Estrategia de despliegue:
>
> Ambientes:
>
> - Local: Desarrollo con Podman Compose
> - Staging: mantochrisal.cl (Cloudflare Tunnel)
> - Production: mantochrisal.cl (mismo servidor, diferentes puertos)
>
> Proceso de deployment:
>
> . Git push -> GitHub Actions trigger
> . Tests automaticos ( tests)
> . Build de containers (backend, frontend, php-service)
> . Deploy a staging -> Smoke tests
> . Validacion manual (checklist requisitos)
> . Deploy a produccion -> Health checks
>
> Plan de rollback ( minutos):
>
> - Script automatizado: rollback.sh
> - Backup de BD pre-deploy
> - Containers previous version disponibles
> - Validacion post-rollback automatica
>
> Monitoreo:
>
> - Health endpoints: /asistencia/health
> - Logs estructurados (Winston JSON)
> - M�tricas: Response time, error rate
> - Alertas: Email en errores criticos
>
> Documentacion operacional:
>
> - DEPLOYMENT.md: Paso a paso
> - PRE_DEPLOY_CHECKLIST.md: validaciónes
> - RUNBOOK.md: Incidentes comunes + soluciones
> - Scripts: deploy.sh, rollback.sh, backup.sh"
---
### SLIDE : RESULTADOS Y METRICAS ( minutos)
Visual: Dashboard con metricas antes/despues + graficos
Guion:
> "Comparativa Antes vs Después:
>
> | Metrica           | Antes (Manual) | Después (QR) | Mejora       |
> | --------------------------- | -------------- | ------------ | ------------------ |
> | Tiempo/clase       | - min   | < min    | % reduccion |
> | Fraude/semestre     | ~ casos   | casos   | % eliminado |
> | Satisfaccion estudiantes | ./     | >/    | +%      |
> | Satisfaccion profesores | /      | >/    | +%      |
> | Tiempo reportes     | horas    | min    | % reduccion |
>
> Impacto cuantificado:
>
> - Tiempo recuperado: , horas/año academico
> - Valor economico: $,/año (tiempo docente)
> - ROI: % en primer año
> - Payback: meses
>
> Adopcion:
>
> - Fase (Enero): profesores piloto -> cursos
> - Fase (Feb-Mar): Expansion a profesores -> Escuela completa
> - Fase (Abril+): Escalamiento a otras facultades UCN
>
> M�tricas t�cnicas:
>
> - Uptime: >% (medido en staging)
> - Response time: <ms (p)
> - Success rate: >% en primer intento
> - Concurrencia: requests simultaneos sin degradacion
>
> Feedback cualitativo (profesores piloto):
>
> - 'Ya no pierdo minutos, empiezo la clase de inmediato'
> - 'Finalmente tengo datos confiables para las notas'
> - 'Los alumnos lo usan sin problemas, es muy intuitivo'"
---
### SLIDE : ESCALABILIDAD Y FUTURO (. minutos)
Visual: Roadmap con fases + mapa UCN con expansion
Guion:
> "Plan de escalamiento:
>
> Fase : MVP Escuela de Ingeniería (Enero ) ?
>
> - profesores, estudiantes
> - requisitos funcionales validados
> - Sistema en produccion (mantochrisal.cl)
>
> Fase : Mejoras y Analytics (Feb-Marzo )
>
> - Dashboard de sesiones activas en tiempo real
> - Alertas tempranas: Alumnos con <% asistencia
> - Reportes avanzados: Tendencias, comparativas
> - Prediccion de ausencias con ML basico
>
> Fase : Expansion UCN (Abril +)
>
> - Escalamiento a facultades de UCN Coquimbo
> - + profesores, ,+ estudiantes
> - Infraestructura: Upgrade VPS (recursos x)
> - Costo marginal bajo: ~$ por usuario adicional
>
> Potencial de expansion:
>
> - UCN Antofagasta: ,+ estudiantes
> - UCN Santiago: ,+ estudiantes
> - Otras universidades regionales (licenciamiento)
>
> Arquitectura preparada para escala:
>
> - Backend stateless (horizontal scaling facil)
> - PostgreSQL connection pool optimizado
> - Valkey/Redis para cache distribuido
> - Cloudflare CDN para assets estaticos
>
> Roadmap tecnico futuro:
>
> - Event Sourcing para auditoria completa
> - CQRS para separar reads/writes
> - Push notifications (alertas a estudiantes)
> - Integracion con sistema de notas
> - Soporte multi-idioma (si escala internacional)"
---
### SLIDE : LECCIONES APRENDIDAS ( minutos)
Visual: Lista de aprendizajes clave con iconos
Guion:
> "Principales aprendizajes del proyecto:
>
> . Arquitectura Mixta es Anti-patron ?
>
> - Error inicial: Backend Fastify dentro de proyecto Vite
> - Problema: Vite es para bundling frontend, no para servidores
> - Solucion: Separacion en proyectos independientes
> - Leccion: Siempre inicializar backend y frontend separados, incluso en monorepo
>
> . Event Storming Descubre Hotspots Tempraño ?
>
> - Valor: Identificar problemas ANTES de codificar
> - Ejemplo: Sincronizacion de tiempo como riesgo critico
> - Mitigacion: NTP + ventana de tolerancia disenados desde dia 
> - Leccion: horas de Event Storming ahorran horas de refactoring
>
> . Vitest NO es Solo Frontend ?
>
> - Mito: 'Vitest es para Vite, por lo tanto solo frontend'
> - Realidad: Vitest es -x más rápido que Jest para backend Node.js
> - Beneficio: tests en segundos vs segundos con Jest
> - Leccion: No asumir uso de herramienta por nombre, investigar capacidades reales
>
> . Criterios SMART Eliminan Ambiguedad ?
>
> - Antes: 'Sistema debe ser rápido' (subjetivo)
> - Después: 'Response time <ms en p' (medible)
> - Impacto: criterios SMART -> discusiones de 'esta completo?'
> - Leccion: Invertir tiempo en definir metricas objetivas al inicio
>
> . Plan de Rollback es Tan Importante Como Deploy ?
>
> - Realidad: Fallos en produccion son inevitables
> - Preparacion: Script rollback.sh automatizado ( pasos, minutos)
> - Tranquilidad: Equipo duerme tranquilo sabiendo que hay plan B
> - Leccion: Crear rollback.sh ANTES del primer deploy, no después del primer incidente
>
> . ROI Convence Stakeholders Más Que Features ?
>
> - T�cnica: 'Arquitectura DDD event-driven' (interesante)
> - Negocio: 'ROI %, payback meses' (convincente)
> - Resultado: Aprobacion inmediata de presupuesto
> - Leccion: Traducir metricas t�cnicas a valor de negocio siempre"
---
### SLIDE : CONCLUSIONES ( minuto)
Visual: Resumen ejecutivo con checkmarks
Guion:
> "En resumen:
>
> Problema resuelto: minutos -> minutos por clase (% reduccion) 
> Fraude eliminado: QR dinámico + TOTP + validación IP 
> Adopcion garantizada: Integrado en sistema legacy, sin friccion 
> ROI positivo: % en primer año ($K valor vs $.K inversion) 
> Calidad asegurada: + tests automatizados, cobertura >% 
> Escalable: Preparado para facultades UCN (x crecimiento)
>
> T�cnicas aplicadas:
>
> - Event Storming para descubrimiento del dominio
> - Impact Mapping para conectar negocio con entregas
> - Business Model Canvas para validar viabilidad
> - Domain-Driven Design (DDD) en arquitectura
> - Test-Driven Development (TDD) cuando posible
>
> Estado actual: Sistema desplegado en produccion (mantochrisal.cl), requisitos funcionales validados, listo para piloto con profesores en Enero .
>
> Este proyecto demuestra que con análisis riguroso del dominio, arquitectura solida, y testing exhaustivo, es posible crear soluciones que generan valor real medible, no solo código que funciona."
---
### SLIDE : PREGUNTAS (Q&A)
Visual: Contacto + recursos adicionales
Guion:
> "Muchas gracias por su atencion. Estoy disponible para responder preguntas.
>
> Recursos adicionales:
>
> - Repositorio GitHub: [URL]
> - Documentacion t�cnica completa en /documents/
> - Demo en vivo: mantochrisal.cl
> - Contacto: [email]"
---
 PREGUNTAS FRECUENTES ANTICIPADAS
 Pregunta : "?Por que no usar sistema comercial existente?"
Respuesta:
> "Sistemas comerciales cuestan $,-,/año en licencias. Nuestra solución interna cuesta $,/año en operacion (mitad del precio) y nos da control total sobre features, datos, y roadmap. Además, la integración con sistema legacy Hawaii seria igualmente compleja en solución comercial, porque el schema PostgreSQL es compartido."
---
 Pregunta : "?Que pasa si un alumno no tiene smartphone?"
Respuesta:
> "Estimamos <% de casos edge. Soluciones: () Usar computador de sala si hay, () Companero presta telefono (solo debe logearse), () Profesor marca manualmente post-clase en asist_lista.php. El sistema no busca ser % para el %, sino % para el %."
---
 Pregunta : "?Como evitan que alguien tome foto del QR?"
Respuesta:
> "Tres capas de seguridad: () QR cambia cada segundos con TOTP criptográfico, foto vieja es invalida. () Validacion de IP requiere estar en red UCN (...\), no funciona desde casa. () Timestamp de marca registrado, profesor puede detectar añomalias (alumno marco a las : pero llego : fisicamente)."
---
 Pregunta : "?Por que Fastify y no Express que es más conocido?"
Respuesta:
> "Fastify es x más rápido que Express en benchmarks reales. Con alumnos escaneando simultaneamente, performance es critica. Además, Fastify tiene soporte TypeScript nativo (Express requiere tipos externos) y arquitectura de plugins más limpia. La curva de aprendizaje es similar, pero los beneficios de performance y DX justifican la eleccion."
---
 Pregunta : "?Que pasa si el sistema cae durante una clase?"
Respuesta:
> "Plan de contingencia: () Sistema tiene uptime >% medido en staging. () Si cae, profesor puede reabrir sesion (datos persisten en PostgreSQL). () En falla total, profesor marca manualmente post-clase en minutos. () Rollback automatizado en minutos con script. () Monitoreo proactivo con alertas via email."
---
 Pregunta : "?Como validaron los requisitos funcionales?"
Respuesta:
> "Creamos matriz de trazabilidad: cada requisito -> componentes -> tests -> evidencias. Por ejemplo, Requisito (registro exitoso) tiene: + tests backend, query SQL de verificacion, screenshot de confirmacion, logs de TOTP validation. Total: casos de prueba, tipos de evidencia especificos. Todo documentado en PLAN_IMPLEMENTACION_ENERO_.md."
---
 Pregunta : "?Cuanto tiempo tomo el desarrollo?"
Respuesta:
> "Fase de análisis: semanas (Event Storming, Impact Mapping, requisitos). Desarrollo: horas (planificadas en dias x h, - Enero). Total: ~- semanas desde concepto hasta produccion. La clave fue planificacion rigurosa: horas de documentacion ahorraron + horas de refactoring."
---
 TIMING DETALLADO
| Slide | Contenido       | Tiempo | Acumulado |
| ----- | --------------------- | ------ | --------- |
|   | Portada        | :  | :   |
|   | El Problema      | :  | :   |
|   | La Solucion      | :  | :   |
|   | Event Storming    | :  | :   |
|   | Impact Mapping    | :  | :   |
|   | Business Model Canvas | :  | :   |
|   | Arquitectura T�cnica | :  | :   |
|   | Estrategia de Testing | :  | :   |
|   | Seguridad       | :  | :   |
|   | Despliegue      | :  | :   |
|   | Resultados      | :  | :   |
|   | Escalabilidad     | :  | :   |
|   | Lecciones       | :  | :   |
|   | Conclusiones     | :  | :   |
|   | Q&A          | :+ | :+  |
Total: : minutos (presentacion) + + minutos (Q&A flexible)
---
 CONSEJOS DE DELIVERY
 Enfasis y Pausas:
- Numeros importantes: Pausar después de "% ROI", "% reduccion", "$, valor"
- Hotspots: Enfatizar problema -> solución en cada caso
- Lecciones: Contar como historia personal (más memorable)
 Contacto Visual:
- Mirar a jurado tecnico en slides - (arquitectura, testing)
- Mirar a stakeholders en slides , , (problema, modelo negocio, resultados)
 Gesticulacion:
- Timeline (Slide ): Maño izquierda a derecha siguiendo fases
- ROI (Slide ): Maño mostrando "de aqui a aqui" (inversion -> valor)
- Seguridad (Slide ): Contar capas con dedos (, , , )
 Backup:
- Demo en vivo: Tener video pre-grabado por si WiFi falla
- Slides extra: Diagramás tecnicos detallados si piden profundizar
- Codigo: Fragmentos key listos para mostrar si preguntan implementación
---
Ultima actualizacion: de diciembre de  
Version: . 
Duracion objetivo: - minutos + Q&A
