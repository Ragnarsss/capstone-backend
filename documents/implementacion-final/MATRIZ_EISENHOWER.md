# Matriz de Eisenhower - Sistema de Asistencia Hawaii
Fecha de Creacion: de diciembre de  
Periodo: - de enero de  
Leyenda: Critico | Importante | Completado
---
## Cuadrante : URGENTE + IMPORTANTE (Hacer YA)
Prioridad maxima - Bloquean el proyecto
 Dia : Separacion Arquitectonica Backend/Frontend ( horas)
- Urgente: Proyecto backend en Vite es arquitecturalmente incorrecto
- Importante: Bloquea despliegue independiente y escalabilidad
- Impacto: CRITICO - Debe completarse antes de cualquier otra tarea
- Riesgos: Fallos de build, confusion en CI/CD, deployments complejos
- Entregables:
 - [ ] Crear estructura `backend/` y `frontend/` separadas
 - [ ] Migrar c贸digo backend (modulos, shared, middleware)
 - [ ] Migrar c贸digo frontend (features, shared, types)
 - [ ] Actualizar Containerfiles independientes
 - [ ] Actualizar compose.yaml con servicios
 - [ ] Validar funcionamiento post-refactor
 Dia -: Testing PHP - + Tests (>% cobertura)
- Urgente: tests implementados en modulo PHP critico
- Importante: Sin tests, imposible validar integraci贸n JWT
- Impacto: ALTO - Requisito de calidad para produccion
- Componentes:
 - [ ] JWT.php: tests (encode, decode, expiry, signature)
 - [ ] AuthenticationService: tests (generacion JWT profesor/alumno)
 - [ ] LegacySessionAdapter: tests (sesiones PHP, distincion roles)
 - [ ] NodeServiceClient: tests (mocks HTTP, headers, errores)
 - [ ] Controladores API: tests (UserData, CourseData, Enrollment)
 - [ ] Router: tests (mapeo rutas, CORS, )
 - [ ] Tests integraci贸n: tests
 Dia : Migraci贸n Endpoint `api_get_asistencia_token.php`
- Urgente: Endpoint legacy duplica logica y crea inconsistencias
- Importante: Centralizar generacion JWT en un solo lugar
- Impacto: ALTO - Simplifica mantenimiento, evita bugs
- Tareas:
 - [ ] Actualizar horario.php lineas ~-
 - [ ] Cambiar URL a `/asistencia-node-integration/api/token`
 - [ ] Verificar propiedades respuesta (success, token, expiresIn, userId, username)
 - [ ] Deprecar archivo legacy con comentario
 - [ ] Testing manual en ambos flujos (profesor/alumno)
 Dia -: Validacion Requisitos Funcionales
- Urgente: Son los objetivos contractuales del proyecto
- Importante: Sin validaci贸n formal, no se puede desplegar
- Impacto: CRITICO - Condicion de aceptacion
- Checklist:
 - [ ] Req : Sistema aislado (health checks, logs sin errores )
 - [ ] Req : Opcion estudiante (boton visible, modal funcional)
 - [ ] Req : Opcion profesor (boton visible, QR din谩mico)
 - [ ] Req : Registro exitoso (TOTP valido, insercion BD)
 - [ ] Req : Encuestas (redirect, guardado en comentarios_clase)
 - [ ] Req : Pantalla general (asist_lista.php muestra registros)
 - [ ] Req : Duracion QR (TTL configurable, expiracion validada)
---
## Cuadrante : NO URGENTE + IMPORTANTE (Planificar)
Inversion a futuro - Previenen problemas
 Dia : CI/CD - GitHub Actions Workflow
- No urgente: Tests se pueden correr manualmente temporalmente
- Importante: Automatizacion evita errores huma帽os y acelera desarrollo
- Impacto: MEDIO - Mejora velocidad y confianza
- Tareas:
 - [ ] Crear `.github/workflows/test.yml`
 - [ ] Job test-php: PHP ., composer, phpunit
 - [ ] Job test-node: Node , npm, vitest
 - [ ] Configurar linting: PHP CS Fixer + ESLint
 - [ ] Badge de estado en README
 Dia : Tests EE Automatizados (Playwright)
- No urgente: Tests manuales cubren funcionalidad inicialmente
- Importante: Previenen regresiones en flujos criticos
- Impacto: MEDIO-ALTO - Seguridad a largo plazo
- Tests:
 - [ ] Test JWT: Profesor obtiene token valido
 - [ ] Test QR Host: Proyeccion dinamica cada s
 - [ ] Test QR Reader: Escaneo y registro completo
 Dia : Documentacion de Despliegue
- No urgente: Despliegue es dia , hay tiempo para preparar
- Importante: Documentacion previene errores criticos en produccion
- Impacto: ALTO - Reduce riesgo de despliegue
- Documentos:
 - [ ] DEPLOYMENT.md: Procedimiento paso a paso
 - [ ] PRE_DEPLOY_CHECKLIST.md: Validaciones previas
 - [ ] Scripts: deploy.sh, rollback.sh, backup.sh
 - [ ] Validacion de secrets (JWT_SECRET sincronizado)
 Dia : Optimizaciones de Performance
- No urgente: Performance actual es aceptable
- Importante: Mejora experiencia de usuario y escalabilidad
- Impacto: MEDIO - Mejora percepcion de calidad
- Optimizaciones:
 - [ ] Indices en `alumno_asistencia(rut, fecha, bloque)`
 - [ ] Pool de conexiones PostgreSQL optimizado
 - [ ] Compresion gzip en Apache
 - [ ] Cache de consultas frecuentes en Valkey
 - [ ] Lazy loading de modulos frontend
 Dia : Logging y Monitoreo
- No urgente: Sistema funciona sin observabilidad avanzada
- Importante: Facilita debugging y deteccion de problemas
- Impacto: MEDIO - Mejora operabilidad
- Implementaciones:
 - [ ] Winston logger en backend (levels: error, warn, info, debug)
 - [ ] Structured logging con JSON
 - [ ] M胻ricas basicas: response time, error rate
 - [ ] Dashboard simple con logs en tiempo real
### Fase Post-Proyecto: Clusterizacion con Kubernetes
- No urgente: Sistema funciona correctamente con Podman/Docker Compose
- Importante: Escalabilidad horizontal, alta disponibilidad, despliegue profesional
- Impacto: MEDIO-BAJO - Beneficioso para produccion de alto trafico
- Justificacion: Implementar DESPUES de validaci贸n completa (+ dias en produccion)
- Prerequisitos:
 - [ ] Sistema estable en produccion por + semanas
 - [ ] M胻ricas de carga y uso recopiladas
 - [ ] Cluster Kubernetes disponible (local o cloud)
 - [ ] Equipo capacitado en Kubernetes basico
- Implementacion:
 - [ ] Manifiestos Ks: Deployments, Services, ConfigMaps, Secrets
 - [ ] Namespace: `asistencia-ucn`
 - [ ] HorizontalPodAutoscaler para escalado automatico
 - [ ] Ingress con certificados SSL/TLS (cert-manager)
 - [ ] PersistentVolumes para PostgreSQL y Valkey
 - [ ] Helm charts para simplificar despliegues
 - [ ] CI/CD integrado con kubectl/Helm
 - [ ] Health checks y readiness probes
 - [ ] Rolling updates con zero downtime
 - [ ] Backup automatico de datos
- Arquitectura Ks:
 ```
 Namespace: asistencia-ucn
 +-- Deployment: backend ( replicas)
 |  +-- Service: backend-svc (ClusterIP)
 +-- Deployment: frontend ( replicas)
 |  +-- Service: frontend-svc (ClusterIP)
 +-- StatefulSet: postgres ( replica)
 |  +-- PVC: postgres-data (Gi)
 |  +-- Service: postgres-svc (ClusterIP)
 +-- StatefulSet: valkey ( replica)
 |  +-- PVC: valkey-data (Gi)
 |  +-- Service: valkey-svc (ClusterIP)
 +-- Ingress: asistencia-ingress
   +-- Rules: mantochrisal.cl/asistencia -> frontend-svc
 ```
- Prioridad: BAJA (despues de Fase - Expansion)
- Tiempo Estimado: - dias con cluster existente, - dias desde cero
---
## Cuadrante : URGENTE + NO IMPORTANTE (Delegar/Minimizar)
Aparentan urgencia pero bajo impacto real
 Dia : Tests Manuales Exhaustivos
- Urgente: Se sienten necesarios para "estar seguros"
- No importante: Tests automatizados ya cubren casos criticos
- Estrategia: Limitar a checklist de horas en lugar de dia completo
- Justificacion: Dia - ya incluyen validaci贸n formal
 Ajustes Esteticos de UI
- Urgente: "Se ve feo" genera presion de usuarios
- No importante: Funcionalidad es prioridad sobre estetica
- Estrategia: Crear backlog para post-lanzamiento
- Ejemplos:
 - Animaciones de modal
 - Mensajes de error m谩s "bonitos"
 - Iconos personalizados
 Documentacion de Codigo Inline Completa
- Urgente: "Buenas practicas dicen que hay que documentar todo"
- No importante: Codigo TypeScript es auto-documentado en gran medida
- Estrategia: Documentar solo interfaces publicas y logica compleja
- Diferir: Documentacion exhaustiva a Sprint (post-produccion)
---
## Cuadrante : NO URGENTE + NO IMPORTANTE (Eliminar)
Actividades que no aportan valor - EVITAR
 Refactoring "Perfeccionista"
- Riesgo: Reescribir c贸digo funcional "porque podria ser mejor"
- Impacto: Introduce bugs, consume tiempo sin valor
- Accion: ELIMINAR - Solo refactorizar si bloquea funcionalidad
 Soporte de Navegadores Antiguos
- Contexto: IE, Chrome <
- Justificacion: Universidad tiene equipos actualizados, no es requisito
- Accion: ELIMINAR - No agregar polyfills innecesarios
 Testing de Cobertura %
- Riesgo: Crear tests triviales para alcanzar %
- Impacto: Tests de bajo valor, mantenimiento costoso
- Accion: ELIMINAR - Meta es >% PHP, >% Node en c贸digo critico
 Multiples Estrategias de Autenticacion
- Idea: OAuth, SAML, etc.
- Justificacion: Sistema legacy usa sesiones PHP, es suficiente
- Accion: ELIMINAR - JWT actual cubre necesidades
 Internacionalizacion (in)
- Contexto: Sistema solo se usa en UCN Chile (espa帽ol)
- Justificacion: No hay requisito de multiples idiomas
- Accion: ELIMINAR - No implementar in ahora
 Generacion Automatica de Reportes PDF Avanzados
- Idea: Graficos, estadisticas detalladas
- Justificacion: asist_lista.php ya proporciona datos suficientes
- Accion: ELIMINAR - Diferir a fase si se solicita
---
 Resumen Ejecutivo por Dia
| Dia    | Cuadrante (Hacer YA)                 | Cuadrante (Planificar)   | Tiempo Critico | Tiempo Estrategico |
| --------- | ------------------------------------------------------ | ----------------------------- | -------------- | ------------------ |
|   | Separacion arquitectonica (h) + Testing PHP base (h) | -               | h       | h         |
|   | Testing PHP avanzado (h)               | -               | h       | h         |
|   | Migraci贸n endpoint (.h)               | CI/CD setup (.h)      | .h      | .h        |
|   | -                           | Tests manuales reducidos (h) | h       | h         |
|   | -                           | Tests EE Playwright (h)   | h       | h         |
|   | Validacion requisitos - (h)             | -               | h       | h         |
|   | Validacion requisitos - (.h)            | Ajustes (.h)        | .h      | .h        |
|   | -                           | Documentacion despliegue (h) | h       | h         |
|   | Despliegue staging (h)                | -               | h       | h         |
|   | Tests staging (h)                   | Optimizaciones (h)      | h       | h         |
|   | -                           | Logging + monitoreo (h)   | h       | h         |
|   | Despliegue produccion (h)               | -               | h       | h         |
| Total | h (.%)                    | h (.%)        | h    | h      |
---
 Criterios de Decision Rapida
Esta tarea es realmente urgente?
- SI: Bloquea validaci贸n de requisitos o despliegue
- SI: Hay tests y el c贸digo va a produccion
- SI: Arquitectura actual causa errores o imposibilita deploy
- NO: "Seria bueno tener", "Algun dia lo necesitaremos", "Por si acaso"
Esta tarea es realmente importante?
- SI: Afecta alguno de los requisitos funcionales
- SI: Previene caidas de sistema o perdida de datos
- SI: Mejora significativamente la mantenibilidad a largo plazo
- NO: Solo mejora estetica o conveniencia menor
Regla de Oro: Si una tarea no es ni urgente ni importante segun estos criterios, NO la hagas en este sprint.
---
 Indicadores de Exito
## Cuadrante (Critico)
- [ ] / requisitos validados con evidencia
- [ ] + tests PHP implementados (>% cobertura)
- [ ] Endpoint legacy migrado y deprecado
- [ ] errores en logs de staging
- [ ] Sistema funcionando en mantochrisal.cl
## Cuadrante (Estrategico)
- [ ] CI/CD pipeline ejecutandose (verde)
- [ ] + tests EE automatizados con Playwright
- [ ] DEPLOYMENT.md completo y validado
- [ ] Performance: Response time <ms (p)
- [ ] Logging estructurado implementado
## Cuadrantes y (Evitados)
- [ ] horas gastadas en refactoring no esencial
- [ ] horas en features no solicitadas
- [ ] tests triviales para alcanzar cobertura artificial
- [ ] Scope creep contenido a %
---
Ultima Actualizacion: de diciembre de  
Pr贸xima Revision: de enero de (inicio Sprint )
