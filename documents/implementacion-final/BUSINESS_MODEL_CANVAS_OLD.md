# Business Model Canvas - Sistema de Asistencia QR Criptográfico
Institución: Universidad Católica del Norte - Campus Coquimbo 
Unidad: Escuela de Ingeniería 
Producto: Sistema de Toma de Asistencia con QR Dinámico 
Fecha: de diciembre de 
---
 📋 Canvas Completo
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│          BUSINESS MODEL CANVAS                       │
│          Sistema de Asistencia QR - UCN Coquimbo              │
└──────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────┬─────────────────────┬──────────────────────┬─────────────────┐
│           │           │           │         │
│ KEY PARTNERS    │ KEY ACTIVITIES   │ VALUE PROPOSITIONS │ CUSTOMER    │
│ Socios Clave    │ Actividades Clave │ Propuesta de Valor │ RELATIONSHIPS │
│           │           │           │ Relación con  │
│ • Escuela de    │ • Desarrollo y   │ PARA PROFESORES:  │ Clientes    │
│  Ingeniería UCN  │  mantención de  │ ✅ Recuperar   │         │
│  (sponsor)    │  software     │  minutos por clase │ • Capacitación │
│           │           │ ✅ Eliminar fraude │  presencial  │
│ • Dirección de   │ • Soporte t�cnico │  por suplantación │  (talleres)  │
│  TI UCN      │  a profesores y  │ ✅ Reportes     │         │
│  (infraestructura)│  estudiantes   │  automáticos    │ • Soporte   │
│           │           │ ✅ Cumplimiento   │  t�cnico vía │
│ • Sistema Legacy  │ • Integración con │  normativo     │  email/ticket │
│  Hawaii      │  sistema legacy  │           │         │
│  (proveedor datos)│  (PostgreSQL   │ PARA ESTUDIANTES:  │ • FAQ y    │
│           │  compartido)   │ ⚡ Proceso rápido  │  tutoriales  │
│ • Proveedor    │           │  (< seg)     │  en línea   │
│  hosting     │ • Generación de  │ ✅ Feedback     │         │
│  (Cloudflare)   │  códigos TOTP   │  inmediato     │ • Early    │
│           │  criptográficos  │ 📱 Tecnología    │  adopters como│
│ • Comunidad    │           │  familiar (QR)   │  champions  │
│  Open Source   │ • Validación de  │ ✓ Confirmación   │         │
│  (Fastify, Vitest,│  registros en   │  visual      │         │
│  ZXing)      │  tiempo real   │           │         │
│           │           │ PARA ADMINS:    │         │
│           │ • Testing continuo │ 📊 Datos en tiempo │         │
│           │  ( tests Node, │  real       │         │
│           │  + tests PHP) │ 📈 Reportes para  │         │
│           │           │  acreditación   │         │
│           │           │ 🚨 Detección de   │         │
│           │           │  alumnos en riesgo │         │
│           ├─────────────────────┴──────────────────────┤         │
│           │ KEY RESOURCES               │         │
│           │ Recursos Clave              │         │
│           │                      │         │
│           │ TECNOLÓGICOS:               │         │
│           │ • Backend: Node.js + Fastify ..    │         │
│           │ • Frontend: Vite + TypeScript + ZXing   │         │
│           │ • Base de datos: PostgreSQL (compartida) │         │
│           │ • Cache: Valkey/Redis ..        │         │
│           │ • Hosting: Apache + Cloudflare Tunnel   │         │
│           │ • Testing: Vitest + PHPUnit + Playwright │         │
│           │                      │         │
│           │ HUMANOS:                 │         │
│           │ • Desarrollador Full-Stack       │         │
│           │ • Soporte TI UCN (infraestructura)    │         │
│           │ • Profesores early adopters      │         │
│           │                      │         │
│           │ INTANGIBLES:               │         │
│           │ • Conocimiento del dominio educativo   │         │
│           │ • Arquitectura DDD + Event-Driven     │         │
│           │ • tests automatizados (confiabilidad) │         │
│           │ • Documentación t�cnica completa     │         │
│           │                      │         │
├─────────────────────┴────────────────────────────────────────────┴─────────────────┤
│                                           │
│ CUSTOMER SEGMENTS                                 │
│ Segmentos de Clientes                               │
│                                           │
│ PRIMARIO - Profesores de Ingeniería ( personas):                │
│ • Docentes tiempo completo: personas                     │
│ • Docentes adjuntos: personas                         │
│ • Cursos: Programación, Cálculo, Física, Estructuras de Datos, etc.       │
│ • Pain point crítico: Pierden - min/clase tomando lista manualmente     │
│                                           │
│ SECUNDARIO - Estudiantes de Ingeniería (~ activos):              │
│ • Ing. Civil Informática: estudiantes                    │
│ • Ing. Civil Mecánica: estudiantes                      │
│ • Ing. Civil Industrial: estudiantes                     │
│ • Nativos digitales (% con smartphone)                    │
│ • Pain point: Proceso manual lento, sin confirmación de registro         │
│                                           │
│ TERCIARIO - Administradores Acad�micos ( personas):               │
│ • Jefes de carrera: personas                          │
│ • Secretarias acad�micas: personas                       │
│ • Pain point: Consolidación manual de datos, reportes para acreditación     │
│                                           │
├─────────────────────────────────────────────────────────────────────────────────┬─┤
│                                          │ │
│ CHANNELS                                     │ │
│ Canales                                     │C│
│                                          │O│
│ DESCUBRIMIENTO:                                 │S│
│ • Talleres de capacitación presenciales (kick-off semestre)           │T│
│ • Email institucional a profesores                       │ │
│ • Anuncio en sistema Hawaii (banner visible)                  │S│
│ • Boca a boca de early adopters                         │T│
│                                          │R│
│ EVALUACIÓN:                                   │U│
│ • Demostración en vivo en sala ( minutos)                   │C│
│ • Video tutorial de minutos (YouTube)                     │T│
│ • FAQ en sitio web UCN                             │U│
│ • Testimonios de profesores piloto                       │R│
│                                          │E│
│ COMPRA/ADOPCIÓN:                                 │ │
│ • Acceso automático (integrado en sistema Hawaii)                │ │
│ • Sin instalación requerida (web-based)                     │C│
│ • Single Sign-On (sesión PHP legacy)                      │O│
│                                          │S│
│ ENTREGA:                                     │T│
│ • Sistema web responsive (móvil + desktop)                   │ │
│ • Acceso vía https://mantochrisal.cl                      │S│
│ • Disponible / (uptime >%)                         │T│
│                                          │R│
│ POST-VENTA:                                   │U│
│ • Soporte t�cnico vía email: soporte@ucn.cl                   │C│
│ • Tickets en sistema interno                          │T│
│ • Actualizaciones automáticas sin downtime                   │U│
│ • Monitoreo proactivo (logs + alertas)                     │R│
│                                          │E│
└───────────────────────────────────────────────────────────────────────────────────┴─┘
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ COST STRUCTURE                │ REVENUE STREAMS           │
│ Estructura de Costos             │ Fuentes de Ingresos         │
│                        │                   │
│ DESARROLLO (One-time):            │ MODELO: Servicio Interno Gratuito │
│ • Desarrollo inicial: horas × $/hora  │ (No generación de ingresos directa) │
│  = $, USD                │                   │
│                        │ VALOR GENERADO:           │
│ INFRAESTRUCTURA (Recurrente):        │ • Ahorro de tiempo: min/clase  │
│ • Servidor VPS: $/mes           │  × clases/sem × sem/año   │
│ • Cloudflare Tunnel: $ (plan gratuito)   │  = , min/año recuperados    │
│ • Base de datos: $ (compartida con legacy) │  = horas/año          │
│ • CDN/Storage: $/mes            │  = $,/año (a $/hora docente) │
│ • Total: $/mes = $/año         │                   │
│                        │ • Reducción de fraude: Evita ~  │
│ OPERACIÓN (Recurrente):           │  casos/semestre de suplantación  │
│ • Soporte t�cnico: horas/mes × $/hora  │  = Mejora integridad acad�mica   │
│  = $/mes = $,/año          │                   │
│ • Mantenimiento: horas/mes × $/hora   │ • Cumplimiento normativo: Datos   │
│  = $/mes = $,/año          │  precisos para acreditación    │
│ • Total: $,/año             │  = Valor no monetizado pero crítico│
│                        │                   │
│ TOTAL ANUAL:                 │ ROI (Return on Investment):     │
│ • Año : $, + $, = $,      │ • Inversión Año : $,     │
│ • Año +: $,/año             │ • Valor generado: $,/año    │
│                        │ • Payback: ~ años         │
│ COSTOS VARIABLES:              │ • Beneficios intangibles: +++    │
│ • Escalamiento: Marginal (cloud-based)    │                   │
│ • Por usuario adicional: ~$         │ JUSTIFICACIÓN PRESUPUESTARIA:    │
│ • Por clase adicional: ~$          │ ✅ Financiado por Escuela de    │
│                        │  Ingeniería como mejora continua  │
│ OPTIMIZACIONES:               │ ✅ Alternativa: Sistema comercial  │
│ • Open Source → $ en licencias       │  = $,-,/año       │
│ • Infraestructura compartida → Reduce %  │ ✅ Solución interna = Control total │
└───────────────────────────────────────────────┴──────────────────────────────────────┘
```
---
 🎯 Análisis Detallado por Sección
 . 👥 CUSTOMER SEGMENTS (Segmentos de Clientes)
 Segmento Primario: Profesores de Ingeniería
Perfil Demográfico:
- Edad: - años
- G�nero: % masculino, % femenino
- Educación: % con postgrado (Magíster o Doctorado)
- Tecnología: Variable (% early adopters, % pragmáticos, % conservadores)
Perfil Psicográfico:
- Valoración alta de eficiencia (tiempo = oro)
- Orientados a resultados acad�micos
- Preocupados por cumplimiento normativo
- Receptivos a tecnología si demuestra valor claro
Comportamiento:
- Dictan - cursos/semestre
- - sesiones/curso
- Usan sistema Hawaii diariamente
- Prefieren soluciones que "funcionen sin complicaciones"
Jobs-to-be-Done:
. Verificar asistencia de estudiantes (normativa UCN: % mínimo)
. Generar reportes para notas (asistencia = % de nota final)
. Identificar alumnos en riesgo por ausencias
. Cumplir obligaciones administrativas
---
 Segmento Secundario: Estudiantes de Ingeniería
Perfil Demográfico:
- Edad: - años (promedio )
- G�nero: % masculino, % femenino
- Procedencia: % Coquimbo, % regiones cercanas
- Nivel socioeconómico: Medio (% con beca/cr�dito)
Perfil Psicográfico:
- Nativos digitales (nacidos -)
- Cómodos con tecnología móvil
- Valoración alta de velocidad y feedback inmediato
- Esc�pticos de sistemas "antiguos" o lentos
Comportamiento:
- % tiene smartphone (mínimo Android + o iOS +)
- Usan QR para pagos, menús, transporte (familiar)
- Acceden a sistema Hawaii desde móvil % del tiempo
- Prefieren interfaces simples y visuales
Jobs-to-be-Done:
. Registrar asistencia rápidamente (sin interrumpir clase)
. Confirmar que quedaron presentes (evitar problemas futuros)
. No perder tiempo en procesos administrativos
. Cumplir % asistencia para aprobar
---
 Segmento Terciario: Administradores Acad�micos
Perfil Demográfico:
- Edad: - años
- Rol: Jefes de carrera, secretarias acad�micas
- Experiencia: - años en UCN
Jobs-to-be-Done:
. Consolidar datos de asistencia de todos los cursos
. Generar reportes para acreditación de carreras
. Identificar alumnos en riesgo (alertas tempranas)
. Validar cumplimiento de normativa interna
---
 . 💎 VALUE PROPOSITIONS (Propuestas de Valor)
 Para Profesores:
🎯 Propuesta Principal:
> "Recupera minutos por clase mientras eliminas completamente el fraude por suplantación, con reportes automáticos y cumplimiento normativo garantizado"
Beneficios Funcionales:
- ⏰ Tiempo: min → min (% reducción)
- 🛡️ Seguridad: QR dinámico cambia cada seg
- 📊 Reportes: Un clic para exportar a Excel
- ✅ Cumplimiento: % trazabilidad
Beneficios Emocionales:
- 😌 Tranquilidad: "S� que los datos son confiables"
- 😄 Satisfacción: "Tengo más tiempo para enseñar"
- 💪 Control: "Puedo ver qui�n marcó y a qu� hora"
Diferenciadores vs. Competencia:
- vs. Lista Manual: x más rápido, sin errores de transcripción
- vs. Firma en Papel: Imposible firmar por compañero
- vs. Sistemas Comerciales: Integrado con Hawaii, sin costo adicional
---
 Para Estudiantes:
🎯 Propuesta Principal:
> "Marca tu asistencia en menos de segundos con tu celular, recibe confirmación instantánea y olvídate de preocuparte si quedaste registrado"
Beneficios Funcionales:
- ⚡ Velocidad: < segundos total
- ✅ Confirmación: Mensaje con tu nombre
- 📱 Familiar: Tecnología QR que ya usan
- 🔄 Sin instalación: Funciona en navegador
Beneficios Emocionales:
- 😌 Tranquilidad: "S� que qued� presente"
- 😊 Comodidad: "No tuve que esperar lista manual"
- � Gamificación sutil: "Fue rápido y moderno"
---
 . 📢 CHANNELS (Canales)
 Canal de Descubrimiento: Talleres de Capacitación
Formato:
- Presencial en sala de profesores
- minutos por sesión
- sesiones (inicio de cada semestre)
- Máximo profesores por sesión
Contenido:
. Demo en vivo ( min)
. Casos de uso ( min)
. Práctica guiada ( min)
. Q&A ( min)
Materiales:
- Slides con screenshots
- Video tutorial minutos
- Guía rápida PDF ( página)
- Contacto de soporte
---
 Canal de Adopción: Integración en Sistema Hawaii
Ventajas:
- Sin fricción (ya están logueados)
- Single Sign-On automático
- Acceso desde menú conocido
- Sin apps adicionales que instalar
Ubicación:
- Botón en `main_curso.php` (profesores)
- Botón en `horario.php` (estudiantes)
- Destacado visualmente (color verde)
---
 . 🤝 CUSTOMER RELATIONSHIPS (Relaciones con Clientes)
 Modelo: Asistencia Personal + Self-Service
Fase : Onboarding (Primeras semanas)
- Email de bienvenida con tutorial
- Taller presencial opcional
- Soporte prioritario vía email/ticket
Fase : Uso Regular
- FAQ online con respuestas comunes
- Videos tutoriales cortos
- Early adopters como "champions" (peer support)
Fase : Mejora Continua
- Encuestas semestrales de satisfacción
- Beta testing de nuevas features
- Comunidad de usuarios (si escala)
---
 . 💰 REVENUE STREAMS (Fuentes de Ingresos)
Modelo: Servicio Interno sin Monetización Directa
Valor Generado (No Monetizado):
. Ahorro de Tiempo Docente:
  - min/clase × profesores × cursos × clases/curso
  - = , minutos/semestre = horas/semestre
  - = , horas/año acad�mico
  - Valor: $,/año (a $/hora docente)
. Reducción de Fraude:
  - Estimado: casos/semestre evitados
  - Valor intangible: Integridad acad�mica
. Eficiencia Administrativa:
  - Reportes: horas → minutos
  - reportes/semestre × . horas ahorradas
  - = . horas/semestre = . horas/año
  - Valor: $,/año
Total Valor Generado: ~$,/año 
Inversión Año : $, 
ROI: % en primer año
---
 . 🏗️ KEY RESOURCES (Recursos Clave)
 Tecnológicos:
Stack Seleccionado:
- Backend: Fastify (x más rápido que Express)
- Frontend: Vite (build x más rápido que Webpack)
- Testing: Vitest (-x más rápido que Jest)
- Database: PostgreSQL (ya existente, compartida)
- Cache: Valkey/Redis (compatible con Redis)
Justificación T�cnica:
- Performance crítica: alumnos escaneando simultáneamente
- TypeScript nativo: Reduce bugs en producción
- Testing automatizado: + tests = confiabilidad
---
 Humaños:
Equipo Core:
- Desarrollador Full-Stack (Node.js + PHP + DevOps)
- Soporte TI UCN (infraestructura)
- Early Adopters (profesores beta testers)
Skills Clave:
- Domain-Driven Design (DDD)
- Event Storming
- Fastify + Vite ecosystem
- PostgreSQL optimization
- Testing automation
---
 Intangibles:
Conocimiento del Dominio:
- meses investigando proceso actual
- Entrevistas con profesores
- Observación de clases presenciales
- Análisis de sistema legacy Hawaii
Arquitectura:
- Event-Driven Design
- CQRS pattern (separación lectura/escritura)
- Bounded Contexts bien definidos
- Testing pyramid completo
---
 . 🚀 KEY ACTIVITIES (Actividades Clave)
 Desarrollo (Continuo):
- Sprint planning semanal
- Daily standups (self-retrospectiva)
- Code reviews automatizados (CI/CD)
- Refactoring incremental
 Soporte (Recurrente):
- Respuesta a tickets: < horas
- Monitoreo de logs: Diario
- Actualizaciones de seguridad: Mensual
- Bug fixes críticos: < horas
 Integración (Crítico):
- Sincronización con sistema legacy Hawaii
- Validación de esquema PostgreSQL compartido
- Testing de integración continuo
- Rollback plan actualizado
---
 . 🤝 KEY PARTNERSHIPS (Socios Clave)
 Escuela de Ingeniería UCN (Sponsor)
Rol: Financiamiento + Validación acad�mica 
Contribución:
- Presupuesto para desarrollo e infraestructura
- Acceso a profesores y estudiantes para testing
- Validación de requisitos normativos
- Promoción interna del sistema
---
 Dirección de TI UCN (Infraestructura)
Rol: Hosting + Seguridad 
Contribución:
- Servidores VPS en datacenter UCN
- Cloudflare Tunnel configurado
- Respaldos automáticos de base de datos
- Soporte en incidentes críticos
---
 Sistema Legacy Hawaii (Proveedor de Datos)
Rol: Fuente de verdad para cursos/estudiantes 
Dependencia Crítica:
- Esquema PostgreSQL compartido
- Sesiones PHP para autenticación
- Datos maestros (cursos, alumnos, profesores)
Riesgos:
- Cambios en legacy pueden romper integración
- Mitigación: Tests de integración + versionado
---
 . 💸 COST STRUCTURE (Estructura de Costos)
 Desglose Detallado:
Desarrollo Inicial (One-time):
```
Planificación:     horas × $ = $
Desarrollo Backend:  horas × $ = $,
Desarrollo Frontend:  horas × $ = $,
Testing PHP:      horas × $ = $
Integración:      horas × $ = $
           ─────────────────────
Total Desarrollo:          $,
```
Infraestructura (Anual):
```
Servidor VPS:     $/mes × = $
CDN/Storage:     $/mes × = $
           ───────────────────
Total Infraestructura:       $
```
Operación (Anual):
```
Soporte t�cnico:   h/mes × $ × = $,
Mantenimiento:    h/mes × $ × = $,
           ─────────────────────────
Total Operación:              $,
```
TOTAL AÑO : $, 
TOTAL AÑOS SIGUIENTES: $,
---
 📊 Análisis FODA (Fortalezas, Oportunidades, Debilidades, Amenazas)
 Fortalezas 💪
. Integración nativa con sistema legacy → sin fricción de adopción
. Performance superior (Fastify + Vite) → experiencia fluida
. Testing robusto (+ tests) → alta confiabilidad
. Costo bajo ($,/año) → ROI positivo en año 
 Oportunidades 🚀
. Escalamiento a otras facultades de UCN ( facultades totales)
. Expansión a otros campus (Antofagasta, Santiago)
. Analytics avanzado (predicción de ausencias con ML)
. Integración con sistema de notas y otras plataformas
 Debilidades ⚠️
. Dependencia de sistema legacy Hawaii (riesgo t�cnico)
. Equipo pequeño ( desarrollador) → posible cuello de botella
. Adopción voluntaria → requiere evangelización activa
. Sin app nativa → experiencia móvil limitada a web
 Amenazas 🔴
. Cambios en legacy pueden romper integración
. Rechazo de profesores conservadores (resistencia al cambio)
. Problemas de conectividad WiFi UCN en horas peak
. Sistemas comerciales con mayor presupuesto de marketing
---
 🎯 Estrategia de Go-to-Market
### Fase : Piloto Controlado (Enero )
- profesores early adopters
- cursos por profesor ( cursos totales)
- ~ estudiantes expuestos
- Feedback intensivo semanal
M�tricas de Éxito:
- ✅ >% adopción de profesores piloto
- ✅ >% estudiantes marcan exitosamente
- ✅ incidentes críticos
- ✅ NPS >/
---
### Fase : Expansión Escuela (Febrero-Marzo )
- Invitación a todos los profesores de Ingeniería ( personas)
- Talleres de capacitación quincenales
- Champions program (early adopters evangelizan)
M�tricas de Éxito:
- ✅ >% adopción en Escuela de Ingeniería
- ✅ >, registros de asistencia/semana
- ✅ <% tasa de tickets de soporte
---
### Fase : Escalamiento UCN (Abril +)
- Presentación a otras facultades
- Presupuesto para expansión de infraestructura
- Contratación de soporte adicional (si es necesario)
---
 📈 M�tricas Clave (KPIs)
 Adopción:
- % Profesores activos: Target >%
- % Estudiantes con al menos registro: Target >%
- Clases con sistema activo/total clases: Target >%
 Performance:
- Tiempo promedio de marca: Target < seg
- Success rate (primer intento): Target >%
- Uptime del sistema: Target >%
 Satisfacción:
- NPS Profesores: Target >/
- NPS Estudiantes: Target >/
- Tickets de soporte/mes: Target <
 Impacto:
- Tiempo ahorrado/clase: Target > min
- Fraude detectado: Target casos
- Reportes generados/mes: Target >
---
 🏆 Conclusión
Viabilidad del Modelo: ✅ ALTA
Justificación:
. Problema Real: Validado con profesores (p�rdida de tiempo confirmada)
. Solución T�cnica: Factible con stack moderno y probado
. ROI Positivo: $, valor generado vs. $, inversión = % ROI
. Escalabilidad: Modelo puede expandirse a facultades (x crecimiento)
. Sostenibilidad: Costos operativos bajos ($,/año) cubiertos por Escuela
Recomendación: PROCEDER con piloto controlado en Enero 
---
Creado por: Equipo de Desarrollo UCN Coquimbo 
Revisado por: Escuela de Ingeniería 
Fecha: de diciembre de  
Próxima Revisión: Post-piloto (Febrero )
