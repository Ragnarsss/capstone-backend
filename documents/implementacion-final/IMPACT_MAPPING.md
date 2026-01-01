# Impact Mapping - Sistema de Asistencia QR Criptográfico

**Institución:** Universidad Católica del Norte - Campus Coquimbo  
**Unidad:** Escuela de Ingeniería  
**Fecha:** 31 de diciembre de 2025  
**Técnica:** Mapeo de Impacto para producto de toma de asistencia

---

## 🎯 GOAL (Meta de Negocio)

### Objetivo Principal

> **"Reducir el tiempo de toma de asistencia en clases presenciales de ingeniería de 15-20 minutos a menos de 5 minutos, manteniendo precisión del 99%+ y eliminando fraude por suplantación"**

**Métricas de Éxito:**

- ⏱️ **Tiempo:** De 15 min → 5 min (reducción 67%)
- 🎯 **Precisión:** >99% registros correctos (sin errores de transcripción)
- 🛡️ **Fraude:** 0% suplantación (QR dinámico + IP validation)
- 📊 **Adopción:** >90% profesores activos en Escuela de Ingeniería
- 💰 **ROI:** Ahorro de 10 min/clase × 400 clases/semestre = 4,000 minutos recuperados

---

## 👥 ACTORS (Actores Clave)

### Actor 1: 👨‍🏫 Profesores de Ingeniería (30 profesores)

**¿Quiénes son?**

- Docentes de tiempo completo y adjuntos
- Dictan cursos como: Programación, Cálculo, Física, Estructuras de Datos
- Edad: 30-60 años
- Nivel tecnológico: Variable (desde usuarios básicos a expertos)

**Pain Points Actuales:**

- ⏰ Pierden 15-20 minutos tomando lista manualmente
- 📝 Planilla Excel propensa a errores de transcripción
- 🚫 Difícil detectar fraude (firmas falsas)
- 📊 Reportes finales requieren consolidación manual

**Motivaciones:**

- ✅ Maximizar tiempo efectivo de enseñanza
- ✅ Cumplir normativa universitaria de control de asistencia
- ✅ Tener datos precisos para evaluación
- ✅ Evitar reclamos de estudiantes ("sí asistí, no me marcaron")

---

### Actor 2: 👨‍🎓 Estudiantes de Ingeniería (~800 activos)

**¿Quiénes son?**

- Alumnos de Ingeniería Civil Informática, Mecánica, Industrial
- Edad: 18-25 años
- Nativos digitales: 100% tiene smartphone
- Cursan 5-7 ramos simultáneos

**Pain Points Actuales:**

- ⏰ Proceso de lista manual es lento y aburrido
- 😤 A veces olvidan firmar (llegaron pero no firmaron)
- 🔊 Interrupciones cuando profesor lee nombres en voz alta
- ❌ Sin feedback inmediato si fueron registrados

**Motivaciones:**

- ⚡ Proceso rápido que no interrumpa la clase
- ✅ Confirmación visual instantánea ("sí quedé registrado")
- 📱 Usar tecnología familiar (QR con celular)
- 🎓 Evitar problemas con el % mínimo de asistencia (75% en UCN)

---

### Actor 3: 👨‍💼 Administradores Académicos (5 personas)

**¿Quiénes son?**

- Jefes de carrera de Ingeniería Civil Informática, Mecánica, Industrial
- Secretarias académicas
- Coordinadores de docencia

**Pain Points Actuales:**

- 📊 Consolidar datos de asistencia de múltiples profesores es tedioso
- 📉 Identificar alumnos en riesgo académico (baja asistencia) es reactivo
- 🔍 Validar cumplimiento de normativa UCN toma tiempo
- 📈 Generar reportes para acreditación es manual

**Motivaciones:**

- 📊 Reportes automatizados en tiempo real
- 🚨 Alertas tempranas de alumnos con <75% asistencia
- ✅ Cumplimiento normativo automático
- 📈 Datos para acreditación de carreras

---

## 💥 IMPACTS (Impactos Deseados)

### Para Profesores → Impacto 1: ⏰ Recuperar 10 minutos por clase

**¿Cómo ayudamos?**

- Proceso de apertura de sesión en 30 segundos (3 clics)
- QR proyectado automáticamente (no requiere configuración)
- Alumnos marcan en paralelo mientras profesor inicia clase
- Cierre automático tras TTL (no requiere acción del profesor)

**Medición:**

- Tiempo promedio de apertura: <1 minuto
- % de profesores que usan el sistema: >90%
- NPS de profesores: >8/10

**Evidencia de Impacto:**

- Survey post-implementación
- Logs de tiempos de sesión
- Entrevistas a profesores early adopters

---

### Para Profesores → Impacto 2: 🛡️ Eliminar fraude por suplantación

**¿Cómo ayudamos?**

- QR dinámico cambia cada 10 segundos → foto no sirve
- Validación IP requiere estar en red UCN Coquimbo
- Timestamp de marca registrado → detector de anomalías

**Medición:**

- Intentos de marca con IP externa (bloqueados)
- Comparativa: asistencia registrada vs. observación visual del profesor
- Reporte de anomalías (ej: alumno marcó a las 08:00 pero llegó 08:30)

**Evidencia de Impacto:**

- 0 reportes de fraude en primer semestre
- Dashboard de anomalías para revisión

---

### Para Estudiantes → Impacto 3: ⚡ Proceso rápido (<20 segundos)

**¿Cómo ayudamos?**

- Modal de escaneo abre en 2 segundos
- Cámara activa automáticamente
- Escaneo ZXing optimizado (reconoce en 3-5 seg)
- Confirmación visual inmediata con nombre del alumno

**Medición:**

- Tiempo promedio de marca: <20 segundos (medido en logs)
- % de éxito en primer intento: >95%
- Tasa de abandono: <5%

**Evidencia de Impacto:**

- Logs de performance frontend
- Encuesta de satisfacción estudiantil
- Métricas de UX (tiempo de interacción)

---

### Para Estudiantes → Impacto 4: ✅ Feedback inmediato de registro

**¿Cómo ayudamos?**

- Mensaje de éxito muestra: "✅ Asistencia registrada - [Nombre Estudiante]"
- Color verde + ícono check
- Timestamp visible: "08:03:45"
- Nombre del curso: "Programación Avanzada"

**Medición:**

- % de estudiantes que reportan "no sé si quedé registrado": <5%
- Encuesta post-clase: "¿Te sentiste seguro de que tu asistencia quedó registrada?"
- Reducción de consultas a profesor: "¿quedé presente?"

**Evidencia de Impacto:**

- Encuesta semestral
- Conteo de tickets de soporte

---

### Para Administradores → Impacto 5: 📊 Reportes automáticos en tiempo real

**¿Cómo ayudamos?**

- Dashboard con sesiones activas del día
- Reporte de asistencia por curso/alumno en asist_lista.php
- Exportación a Excel con un clic
- Estadísticas agregadas: % promedio de asistencia por curso

**Medición:**

- Tiempo de generación de reporte: De 2 horas → 5 minutos
- % de administradores que usan reportes automáticos: >80%
- Reducción de emails solicitando datos: 70%

**Evidencia de Impacto:**

- Survey a jefes de carrera
- Conteo de reportes generados/mes
- Tiempo registrado en tareas administrativas

---

## 🚀 DELIVERABLES (Entregables que Generan Impacto)

### Para lograr Impacto 1 (Recuperar 10 minutos):

#### ✅ Deliverable 1.1: Botón "Nuevo Sistema de Asistencia" en main_curso.php

**Prioridad:** CRÍTICA  
**Esfuerzo:** 2 días  
**Dependencias:** JWT generation funcional  
**Validación:**

- [ ] Botón visible solo para profesores autorizados
- [ ] Clic abre modal en <500ms
- [ ] Iframe carga features/qr-host/ con token

#### ✅ Deliverable 1.2: Generación automática de QR dinámico

**Prioridad:** CRÍTICA  
**Esfuerzo:** 3 días  
**Dependencias:** TOTP library (otplib), WebSocket  
**Validación:**

- [ ] QR cambia cada 10 segundos exactos
- [ ] Payload incluye código, TOTP, timestamp
- [ ] WebSocket mantiene conexión estable

#### ✅ Deliverable 1.3: Cierre automático de sesión tras TTL

**Prioridad:** ALTA  
**Esfuerzo:** 1 día  
**Dependencias:** Validación backend de fechahora_termino  
**Validación:**

- [ ] Sesión expira exactamente al cumplir TTL
- [ ] Intentos post-expiración retornan HTTP 410
- [ ] Frontend muestra "Sesión finalizada"

---

### Para lograr Impacto 2 (Eliminar fraude):

#### ✅ Deliverable 2.1: TOTP criptográfico con ventana de 10 segundos

**Prioridad:** CRÍTICA  
**Esfuerzo:** 2 días  
**Dependencias:** Algoritmo HMAC-SHA1  
**Validación:**

- [ ] TOTP válido solo dentro de ventana de 30 seg
- [ ] TOTP de hace 1 minuto rechazado
- [ ] Test automatizado de generación/validación

#### ✅ Deliverable 2.2: Validación de IP por red UCN

**Prioridad:** ALTA  
**Esfuerzo:** 1 día  
**Dependencias:** Configuración de rangos IP UCN  
**Validación:**

- [ ] IP 200.14.84.\* (UCN Coquimbo) permitida
- [ ] IP externa rechazada con HTTP 403
- [ ] Configurable por curso (acepta_origen_ip: UCN/ALL)

#### ✅ Deliverable 2.3: Registro de timestamp de marca

**Prioridad:** MEDIA  
**Esfuerzo:** 0.5 días  
**Dependencias:** Campo hora_marca en alumno_asistencia  
**Validación:**

- [ ] hora_marca registra timestamp exacto
- [ ] Dashboard muestra hora de marca por alumno
- [ ] Detector de anomalías (marca vs. observación visual)

---

### Para lograr Impacto 3 (Proceso rápido):

#### ✅ Deliverable 3.1: Botón "Tomar Asistencia" en horario.php

**Prioridad:** CRÍTICA  
**Esfuerzo:** 1 día  
**Dependencias:** JWT generation para estudiantes  
**Validación:**

- [ ] Botón visible solo para estudiantes (id == -1)
- [ ] Modal abre lector QR en <2 seg
- [ ] Cámara activa automáticamente

#### ✅ Deliverable 3.2: Lector QR optimizado con ZXing

**Prioridad:** CRÍTICA  
**Esfuerzo:** 2 días  
**Dependencias:** @zxing/browser library  
**Validación:**

- [ ] Reconocimiento en 3-5 segundos
- [ ] Funciona con cámaras de 5MP+ (smartphones comunes)
- [ ] Feedback visual mientras escanea

#### ✅ Deliverable 3.3: Validaciones backend en <500ms

**Prioridad:** ALTA  
**Esfuerzo:** 2 días  
**Dependencias:** Índices PostgreSQL, conexión pool  
**Validación:**

- [ ] 4 validaciones (TOTP, TTL, IP, duplicado) en <500ms
- [ ] Response time p95 <1 segundo
- [ ] Concurrencia: 40 requests simultáneos sin degradación

---

### Para lograr Impacto 4 (Feedback inmediato):

#### ✅ Deliverable 4.1: Mensaje de éxito personalizado

**Prioridad:** ALTA  
**Esfuerzo:** 0.5 días  
**Dependencias:** Response incluye nombre del estudiante  
**Validación:**

- [ ] Muestra: "✅ Asistencia registrada - [Nombre]"
- [ ] Incluye curso, timestamp, bloque
- [ ] Color verde + animación de check

#### ✅ Deliverable 4.2: Redirección a encuesta post-asistencia

**Prioridad:** MEDIA  
**Esfuerzo:** 1 día  
**Dependencias:** asist0.php legacy  
**Validación:**

- [ ] Auto-redirect en 2 segundos
- [ ] URL correcta: asist0.php?c={codigo}
- [ ] Encuesta carga sin reautenticación

---

### Para lograr Impacto 5 (Reportes automáticos):

#### ⚠️ Deliverable 5.1: Dashboard de sesiones activas

**Prioridad:** BAJA (Post-MVP)  
**Esfuerzo:** 5 días  
**Dependencias:** WebSocket server-to-server  
**Validación:**

- [ ] Muestra sesiones activas en tiempo real
- [ ] Contador de alumnos registrados
- [ ] Tiempo restante de cada sesión

#### ✅ Deliverable 5.2: Exportación a Excel desde asist_lista.php

**Prioridad:** MEDIA  
**Esfuerzo:** 3 días (ya implementado en sistema legacy)  
**Dependencias:** PHPExcel library  
**Validación:**

- [ ] Botón "Exportar" genera Excel en <10 seg
- [ ] Columnas: RUT, Nombre, Fecha, Bloque, Estado
- [ ] Formato compatible con sistemas UCN

---

## 📊 Impact Map - Resumen Visual

```
                                 🎯 GOAL
                    Reducir tiempo asistencia 67%
                          (15min → 5min)
                                  |
         ┌────────────────────────┼────────────────────────┐
         |                        |                        |
    👨‍🏫 Profesores          👨‍🎓 Estudiantes        👨‍💼 Administradores
         |                        |                        |
    ┌────┴────┐            ┌─────┴─────┐           ┌─────┴─────┐
    |         |            |           |           |           |
⏰ Recuperar 🛡️ Eliminar  ⚡ Proceso  ✅ Feedback  📊 Reportes 🚨 Alertas
 10 minutos   fraude      rápido     inmediato   automáticos  tempranas
    |         |            |           |           |           |
    |         |            |           |           |           |
 [Botón] [TOTP]    [Lector QR] [Mensaje]  [Excel]    [Dashboard]
 [QR Auto] [IP]    [<20seg]   [Nombre]   [5min]     [<75%]
 [TTL Auto] [Log]  [ZXing]    [✅]       [Click]    [Email]
```

---

## 🎯 Priorización de Impactos (MoSCoW)

### 🔴 MUST HAVE (Críticos para MVP)

1. ⏰ **Impacto 1:** Recuperar 10 minutos por clase
2. 🛡️ **Impacto 2:** Eliminar fraude por suplantación
3. ⚡ **Impacto 3:** Proceso rápido (<20 segundos)
4. ✅ **Impacto 4:** Feedback inmediato de registro

**Justificación:** Sin estos 4, el sistema no cumple la promesa de valor principal

### 🟡 SHOULD HAVE (Importantes, Sprint 2)

5. 📊 **Impacto 5:** Reportes automáticos (parcial - Excel ya existe)

**Justificación:** Mejora operativa pero no bloquea adopción

### 🟢 COULD HAVE (Deseables, Post-MVP)

6. 🚨 Alertas tempranas de alumnos en riesgo
7. 📊 Dashboard de sesiones activas en tiempo real
8. 📈 Analytics de tendencias de asistencia

**Justificación:** Aportan valor pero requieren inversión mayor

### ⚪ WON'T HAVE (Fuera de scope actual)

- Integración con sistema de notas
- App móvil nativa (web responsive suficiente)
- Reconocimiento facial como alternativa
- Notificaciones push a estudiantes

---

## 📈 Métricas de Validación de Impacto

### Antes del Sistema (Baseline)

- ⏱️ Tiempo promedio toma de lista: **15-20 minutos**
- 🚫 Fraude reportado: **~10 casos/semestre** (estimado)
- 😤 Satisfacción estudiantes: **6.5/10** (encuesta informal)
- 😓 Satisfacción profesores: **5/10** (proceso tedioso)
- 📊 Tiempo generación reportes: **2 horas/reporte**

### Después del Sistema (Target Enero 2025)

- ⏱️ Tiempo promedio toma de lista: **<5 minutos** ✅
- 🛡️ Fraude reportado: **0 casos** ✅
- 😊 Satisfacción estudiantes: **>8/10** ✅
- 😄 Satisfacción profesores: **>8/10** ✅
- 📊 Tiempo generación reportes: **5 minutos** ✅

### Cómo Mediremos (Instrumentación)

1. **Logs backend:** Tiempo de sesión (apertura → primer registro → último registro)
2. **Encuesta post-clase:** Google Forms a muestra de alumnos (n=100)
3. **Entrevistas:** 5 profesores early adopters (feedback cualitativo)
4. **Logs de seguridad:** Intentos de marca con IP externa (bloqueados)
5. **Analytics:** Contador de reportes Excel generados/mes

---

## 🏆 Assumptions & Risks

### Asunciones Clave

✅ **Asunción 1:** 95%+ estudiantes tienen smartphone con cámara

- **Validación:** Encuesta pre-implementación confirmó 98%

✅ **Asunción 2:** Red WiFi UCN soporta 40 conexiones simultáneas

- **Validación:** Test de carga en sala L-201 exitoso

⚠️ **Asunción 3:** Profesores aceptarán proyectar QR (no ven pérdida de control)

- **Riesgo:** Resistencia al cambio
- **Mitigación:** Capacitación + early adopters como champions

⚠️ **Asunción 4:** Sistema legacy (Hawaii) se mantiene estable

- **Riesgo:** Cambios en legacy rompen integración
- **Mitigación:** Tests de integración + versionado de API

### Riesgos de Impacto

🔴 **Riesgo Alto:** Sincronización de tiempo entre servidores

- **Impacto:** TOTP inválido → alumnos no pueden marcar
- **Mitigación:** NTP configurado + ventana de tolerancia 30 seg

🟡 **Riesgo Medio:** Proyector/pantalla falla en sala

- **Impacto:** QR no visible → proceso se detiene
- **Mitigación:** Profesor puede compartir código manual (6 chars)

🟢 **Riesgo Bajo:** Alumnos sin teléfono (estimado <2%)

- **Impacto:** Necesitan proceso manual
- **Mitigación:** Marca manual post-clase por profesor

---

## 🚀 Roadmap de Impactos

### Fase 1: MVP (Enero 2025) - 80% del Valor

- ✅ Impactos 1, 2, 3, 4 (críticos)
- ✅ 7 requisitos funcionales validados
- ✅ Desplegado en producción (mantochrisal.cl)

### Fase 2: Mejoras (Febrero-Marzo 2025) - 15% del Valor

- 📊 Dashboard de sesiones activas
- 🚨 Alertas tempranas (<75% asistencia)
- 📈 Reportes avanzados (tendencias)

### Fase 3: Escalamiento (Abril 2025+) - 5% del Valor

- 🏢 Expansión a otras escuelas de UCN Coquimbo
- 📱 Optimizaciones móviles
- 🔗 Integración con sistema de notas

---

**Creado por:** Equipo de Desarrollo UCN Coquimbo  
**Revisado por:** Escuela de Ingeniería  
**Fecha:** 31 de diciembre de 2025  
**Próxima Revisión:** Post-despliegue (Enero 2025)
