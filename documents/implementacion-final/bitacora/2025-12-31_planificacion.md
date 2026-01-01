 Bitacora de Desarrollo - Sistema de Asistencia Hawaii
 Fecha: de diciembre de 
Sprint: Pre-Sprint (Planificacion) 
Dia: (Preparacion) 
Horas Trabajadas: horas 
Estado General: Planificacion Completa
---
 Objetivos del Dia
. Crear plan de implementaci贸n profesional para per铆odo - enero 
. Documentar arquitectura del proyecto (separacion backend/frontend)
. Validar decision de framework de testing (Vitest)
. Definir matriz de trazabilidad requisitos -> tests -> evidencias
. Crear matriz de Eisenhower para priorizacion de tareas
. Establecer estructura de bitacora de desarrollo
---
 Actividades Realizadas
 . Plan de Implementacion (PLAN_IMPLEMENTACION_ENERO_.md)
Tiempo: horas 
Estado: Completado
Contenido creado:
- Contexto y alcance del proyecto
- requisitos funcionales a validar
- Matriz de trazabilidad (Requisitos -> Componentes -> Tests -> Evidencias)
- Diagnostico tecnico completo
 - Estado actual: tests Node.js, tests PHP
 - brechas identificadas ( criticas, importantes)
- Estrategia de implementaci贸n: sprints de dias
- Sprint (Dias -): Testing y refactoring arquitectonico
- Sprint (Dias -): Integracion y despliegue
- Carta Gantt detallada por dia (:-:)
- Plan de validaci贸n por requisito con:
 - Criterios SMART especificos
 - casos de prueba detallados
 - tipos de evidencia requeridos
 - Queries SQL de ejemplo
 - Tests automatizados
- Escenarios de error y manejo de excepciones ( escenarios)
- Plan de rollback por componente con scripts automatizados
- An谩lisis de riesgos ( riesgos con mitigaciones)
- Entregables finales y metricas de exito
Hallazgos clave:
- GAP CRITICO : Backend incorrectamente contenido en proyecto Vite
 - Solucion: Separar en `backend/` y `frontend/` independientes
 - Prioridad: DIA ( horas de trabajo)
- GAP CRITICO : tests PHP implementados (+ requeridos)
- GAP CRITICO : Endpoint legacy `api_get_asistencia_token.php` duplica logica
M胻ricas planificadas:
- Tests PHP: -> + (>% cobertura)
- Tests Node: (mantener)
- Tests EE: -> + (Playwright)
- Tiempo total: horas ( dias x h)
---
 . Documentacion de Arquitectura Fastify
Tiempo: hora 
Estado: Completado
Documento creado: `FASTIFY-PROJECT-STRUCTURE.md`
Contenido:
- Comparacion Express vs Fastify (performance, TypeScript, plugins)
- Inicializacion paso a paso de proyecto Fastify backend
- Estructura recomendada DDD (Domain-Driven Design)
- Configuracion TypeScript + Vitest
- Ejemplos de c贸digo:
 - `index.ts` - Entry point
 - `app.ts` - Configuracion Fastify
 - `config/index.ts` - Variables de entorno
 - Controladores por modulo
- Comparacion visual "Current (Incorrect)" vs "Correct (Separated)"
- Guia de migraci贸n desde estructura mixta
Justificacion t胏nica:
- Usuario pregunto: "?Cual deberia ser la estructura correcta de Fastify?"
- Clarifico como inicializar proyecto backend independiente (similar a Express)
- Documento que Vite NO debe contener c贸digo de servidor
---
 . Justificacion de Vitest para Backend
Tiempo: hora 
Estado: Completado
Documento creado: `VITEST-BACKEND-JUSTIFICATION.md`
Contenido:
- Desmitificacion: "Vitest NO es solo para frontend"
- Tabla comparativa: Vitest vs Jest vs Mocha
 - Velocidad: Vitest -x m谩s r谩pido que Jest
 - TypeScript/ESM: Soporte nativo sin configuraci贸n
 - API: Compatible con Jest (migraci贸n facil)
- Benchmarks reales:
 - Jest: tests en - segundos
 - Vitest: tests en - segundos
- Configuracion especifica para backend Node.js/Fastify
- Ejemplos de tests:
 - Tests unitarios de servicios
 - Tests de integraci贸n con base de datos
 - Mocking de dependencias externas
- Respuestas a preocupaciones comunes:
 - Madurez: Vitest + a帽os, amplia adopcion
 - Recursos: Documentacion oficial completa
 - Migraci贸n desde Jest: Minimos cambios requeridos
Contexto:
- Usuario pregunto: "?Es correcto hacer el test del backend con Vitest?"
- Preocupacion: Percepcion de que Vitest es solo para frontend
- Respuesta: SI, Vitest es EXCELENTE para backend
 - Confirma decision de tests existentes
 - NO requiere Vite (es independiente)
 - Velocidad es ventaja critica en desarrollo
---
 . Matriz de Eisenhower
Tiempo: . horas 
Estado: Completado
Documento creado: `MATRIZ_EISENHOWER.md`
Estructura:
## Cuadrante : URGENTE + IMPORTANTE (Hacer YA) - horas (.%)
- Separacion arquitectonica backend/frontend (h)
- Testing PHP + tests (h)
- Migraci贸n endpoint legacy (.h)
- Validacion requisitos funcionales (.h)
- Despliegue staging y produccion (h)
## Cuadrante : NO URGENTE + IMPORTANTE (Planificar) - horas (.%)
- CI/CD GitHub Actions (.h)
- Tests EE Playwright (h)
- Documentacion de despliegue (h)
- Optimizaciones de performance (h)
- Logging y monitoreo (h)
## Cuadrante : URGENTE + NO IMPORTANTE (Minimizar)
- Tests manuales exhaustivos -> Reducir a h
- Ajustes esteticos UI -> Diferir post-lanzamiento
- Documentacion inline completa -> Solo APIs publicas
## Cuadrante : NO URGENTE + NO IMPORTANTE (Eliminar)
- Refactoring perfeccionista
- Soporte navegadores antiguos (IE)
- Testing cobertura % artificial
- Multiples estrategias autenticacion
- Internacionalizacion (in)
- Reportes PDF avanzados
Criterios de decision rapida:
- Urgente: ?Bloquea requisitos o despliegue? tests en c贸digo productivo?
- Importante: ?Afecta los requisitos?Previene caidas? ?Mejora mantenibilidad?
Resumen ejecutivo por dia:
- Tabla con distribucion tiempo critico vs estrategico
- Balance: .% tareas criticas, .% inversion futura
---
 . Estructura de Bitacora
Tiempo: . horas 
Estado: Completado
Acciones:
- Creada carpeta `/documents/bitacora/`
- Establecido formato estandar de entradas
- Primera entrada: `--_planificacion.md` (este documento)
Formato definido:
```
 Bitacora de Desarrollo
 Fecha
Sprint, Dia, Horas, Estado
 Objetivos del Dia
Lista de objetivos con checkboxes
 Actividades Realizadas
Descripci贸n detallada con tiempos
 Decisiones T胏nicas
Decisiones importantes tomadas
 Bloqueadores y Resoluciones
Problemas encontrados y soluciones
 M胻ricas del Dia
Tests, cobertura, commits
 Aprendizajes
Lecciones aprendidas
 Proximos Pasos
Plan para siguiente dia
```
---
 Decisiones T胏nicas
 Decision : Separar Backend y Frontend
Contexto: Usuario identifico que backend Fastify dentro de proyecto Vite es incorrecto 
An谩lisis:
- Vite es bundler de frontend, no maneja servidores Node.js
- Mezcla genera confusion en build, deploy y CI/CD
- Dificulta escalado y mantenimiento independiente
Decision: Separar en proyectos independientes
- `backend/` -> Fastify puro con Vitest
- `frontend/` -> Vite puro con Vitest
- `php-service/` -> Modulo PHP de integraci贸n
Implementacion: Dia del sprint ( horas)
Impacto:
- Builds independientes y m谩s r谩pidos
- Despliegues independientes
- Claridad arquitectonica
- Testing simplificado
- Requiere actualizar compose.yaml ( servicios)
Estado: APROBADO - Prioridad DIA 
---
 Decision : Vitest como Framework de Testing Backend
Contexto: Usuario pregunto si Vitest es apropiado para backend 
Alternativas evaluadas:
- Jest: M谩s maduro, pero lento (-s para tests)
- Mocha + Chai: Flexible, pero requiere m谩s configuraci贸n
- Vitest: R谩pido (-s para tests), TypeScript nativo
Decision: Mantener Vitest para backend
- Ya tenemos tests funcionando
- Velocidad -x superior a Jest
- TypeScript/ESM nativo sin configuraci贸n
- API compatible con Jest (familiaridad)
Justificacion:
- Mito desmitificado: "Vitest NO es solo frontend"
- Vitest es independiente de Vite
- Usado por proyectos backend grandes (Nuxt, VitePress)
Impacto:
- esfuerzo de migraci贸n (ya implementado)
- Tests -x m谩s r谩pidos (mejor DX)
- TypeScript sin `ts-jest` o `ts-node`
- Watch mode ultrarr谩pido (HMR para tests)
Estado: CONFIRMADO - No cambiar a Jest
---
 Decision : Priorizacion con Matriz Eisenhower
Contexto: horas de trabajo, necesidad de enfoque claro 
Problema: Riesgo de scope creep y tareas de bajo valor
Decision: Usar matriz Eisenhower para filtrar tareas
- Cuadrante : h (.%) - Tareas criticas
- Cuadrante : h (.%) - Inversion estrategica
- Cuadrante : Minimizar a h
- Cuadrante : Eliminar completamente
Criterios estrictos:
- Urgente: ?Bloquea requisitos/despliegue? tests en prod?
- Importante: ?Afecta requisitos?Previene caidas?
Rechazos explicitos (Cuadrante ):
- Cobertura % artificial
- Soporte IE
- in (no requerido)
- OAuth/SAML (sesiones PHP suficientes)
- Reportes PDF avanzados
Impacto:
- Enfoque en valor real
- Previene gold plating
- .% tiempo en trabajo critico
- % scope creep
Estado: IMPLEMENTADO - Guia de decisiones del sprint
---
 Bloqueadores y Resoluciones
 Bloqueador : Incertidumbre Arquitectonica
Problema: Usuario no tenia claro si estructura actual era correcta 
Impacto: Riesgo de continuar con arquitectura defectuosa 
Sintomas:
- Backend mezclado con Vite
- Confusion sobre como inicializar Fastify
- Duda sobre apropiacion de Vitest para backend
Resoluci贸n:
. Confirmada observacion del usuario: mezcla backend/Vite es incorrecta
. Creado `FASTIFY-PROJECT-STRUCTURE.md` con guia completa
. Creado `VITEST-BACKEND-JUSTIFICATION.md` confirmando decision
. Agregada seccion . en plan con soluci贸n detallada
. Priorizada separacion como tarea DIA ( horas)
Estado: RESUELTO - Claridad arquitectonica lograda
---
 Bloqueador : Falta de Plan de Validacion Formal
Problema: requisitos sin criterios medibles 
Impacto: Riesgo de interpretacion subjetiva de "completado"
Resoluci贸n:
- Creada Matriz de Trazabilidad (Seccion .)
- Agregado Plan de Validacion por Requisito (Seccion .):
 - criterios SMART especificos
 - casos de prueba detallados
 - tipos de evidencia con ejemplos
 - queries SQL para verificacion
- Estructura de carpeta de evidencias (`evidencias/req--sistema-aislado/`, etc.)
- Template de resumen con tabla de estado
Estado: RESUELTO - Criterios objetivos definidos
---
 Bloqueador : Sin Plan de Contingencia
Problema: Qu茅 hacer si algo falla en produccion 
Impacto: Riesgo de downtime prolongado
Resoluci贸n:
- Agregada seccion .: Escenarios de Error ( escenarios)
 - Deteccion especifica por requisito
 - Soluciones documentadas
 - Rollback por escenario
- Agregada seccion .: Plan de Rollback
 - Tabla de componentes con tiempos
 - Script `rollback.sh` completo ( pasos)
 - Estrategia de backups
Estado: RESUELTO - Procedimientos de emergencia definidos
---
 M胻ricas del Dia
 Documentacion
- Archivos creados: 
## . `PLAN_IMPLEMENTACION_ENERO_.md` ( lineas)
## . `FASTIFY-PROJECT-STRUCTURE.md` (~ lineas)
## . `VITEST-BACKEND-JUSTIFICATION.md` (~ lineas)
## . `MATRIZ_EISENHOWER.md` ( lineas)
- Carpetas creadas: (`bitacora/`)
- Bitacoras creadas: (este archivo)
 Planificacion
- Dias planificados: (- enero)
- Sprints definidos: 
- Tareas identificadas: 
- Horas planificadas: h ( dias x h)
- Distribucion:
 - Criticas (C): h (.%)
 - Estrategicas (C): h (.%)
 - Eliminadas (C+C): ~h potenciales ahorradas
 Calidad
- Requisitos documentados: 
- Criterios SMART: 
- Casos de prueba: 
- Escenarios de error: 
- Queries SQL ejemplo: 
- Scripts automatizados: (deploy.sh, rollback.sh, backup.sh)
 Tests Planificados
- Tests PHP: -> + (target >% cobertura)
- Tests Node: (mantener)
- Tests EE: -> + (Playwright)
- Total tests esperados: +
---
 Aprendizajes
 Aprendizaje : Arquitectura Mixta es Anti-patron
Contexto: Backend Fastify dentro de proyecto Vite 
Leccion:
- Vite es para bundling de frontend, no para servidores
- Mezclar crea confusion en:
 - Builds (?que se compila?)
 - Deploys (?que se despliega?)
 - CI/CD (?que se testea?)
- Separacion clara mejora mantenibilidad y escalabilidad
Aplicacion futura:
- Siempre inicializar backend y frontend como proyectos separados
- Monorepo es aceptable (pnpm workspaces), pero proyectos deben ser independientes
- Fastify se inicializa igual que Express (no necesita Vite)
---
 Aprendizaje : Vitest es Universal, No Solo Frontend
Contexto: Percepcion erronea por nombre "Vite-st" 
Leccion:
- Vitest es independiente de Vite (no lo requiere)
- Ventaja principal: velocidad (-x vs Jest)
- Soporte TypeScript/ESM nativo es critico para DX
- API compatible con Jest facilita adopcion
Aplicacion futura:
- Considerar Vitest como primera opcion para nuevos proyectos Node.js
- No asumir que herramienta de ecosistema = solo ese uso
- Velocidad de tests afecta directamente productividad
---
 Aprendizaje : Matriz de Eisenhower Previene Scope Creep
Contexto: horas, muchas "buenas ideas" 
Leccion:
- Sin filtro riguroso, facil gastar tiempo en tareas de bajo valor
- Cuadrante (no urgente + no importante) es trampa comun:
 - "Seria bueno tener X"
 - "Algun dia necesitaremos Y"
 - "Por si acaso Z"
- Eliminar explicitamente es liberador
Aplicacion futura:
- Crear matriz Eisenhower al inicio de cada sprint
- Revisar diariamente: ?Esta tarea sigue en C o C?
- Mantener lista de "Eliminados" para justificar rechazos
---
 Aprendizaje : Criterios SMART Eliminan Ambiguedad
Contexto: "Sistema funcionando" es subjetivo 
Leccion:
- Criterios vagos -> interpretaciones diferentes
- Criterios SMART (Specific, Measurable, Achievable, Relevant, Time-bound):
 - " errores en logs durante hora" vs "sin errores"
 - "Modal abre en <ms" vs "modal r谩pido"
 - "Query retorna en <s" vs "query eficiente"
Aplicacion futura:
- Siempre definir metricas numericas y verificables
- Incluir queries SQL de ejemplo para validaci贸n
- Crear checklists binarios (si/no) en lugar de escalas subjetivas
---
 Aprendizaje : Plan de Rollback es Tan Importante Como Plan de Deploy
Contexto: Foco comun solo en despliegue exitoso 
Leccion:
- Fallos en produccion son inevitables
- Sin plan de rollback, panico y downtime prolongado
- Script automatizado reduce rollback de horas a minutos
- Documentar escenarios de fallo especificos mejora respuesta
Aplicacion futura:
- Crear `rollback.sh` junto con `deploy.sh` (no despu茅s)
- Practicar rollback en staging antes de produccion
- Documentar tiempos esperados por componente
- Incluir validaci贸n post-rollback en script
---
 Proximos Pasos
 Manana: de enero de (Dia - Sprint )
Estado: Preparado para comenzar 
Objetivo: Separacion arquitectonica + Testing PHP base
Tareas prioritarias ( horas):
. :-: - Kick-off sprint , revision de entorno
  - Verificar PostgreSQL, Valkey, Apache
  - Clonar repositorio si es necesario
  - Validar acceso a base de datos
. :-: - Crear estructura backend/frontend separados
  - `mkdir -p backend/src/{modules,shared,middleware}`
  - `mkdir -p frontend/src/{features,shared,types}`
. :-: - Migrar c贸digo backend a proyecto independiente
  - Copiar modulos de `node-service/src/backend/`
  - Crear `package.json` con dependencias Fastify
  - Crear `tsconfig.json` y `vitest.config.ts`
. :-: - Migrar c贸digo frontend a proyecto independiente
  - Copiar features de `node-service/src/frontend/`
  - Crear `package.json` con dependencias Vite
  - Actualizar `vite.config.ts`
. :-: - Actualizar Containerfiles y compose.yaml
  - Crear `backend/Containerfile`
  - Crear `frontend/Containerfile`
  - Actualizar `compose.yaml` con servicios
. :-: - Validar funcionamiento post-separacion
  - `cd backend && npm run dev` -> Health check
  - `cd frontend && npm run dev` -> Interfaz carga
  - Tests existentes siguen pasando
. :-: - Instalacion PHPUnit en php-service
  - `composer require --dev phpunit/phpunit`
  - Crear `phpunit.xml`
. :-: - Tests unitarios JWT.php (inicio)
  - Crear `tests/lib/crypto/JWTTest.php`
  - Implementar primeros tests
Criterios de exito del dia:
- [ ] Proyectos backend y frontend separados y funcionales
- [ ] Health checks respondiendo correctamente
- [ ] tests Node.js siguen pasando
- [ ] PHPUnit instalado y configurado
- [ ] Al menos tests PHP creados
Riesgos a monitorear:
- Dependencias faltantes tras migraci贸n
- Paths relativos rotos en imports
- Variables de entorno no migradas
- Tests fallando por cambios de estructura
---
 Esta Semana (Dias -)
Sprint : Testing y Refactoring
Entreables esperados:
- [ ] Backend y frontend separados (Dia )
- [ ] + tests PHP (>% cobertura) (Dias -)
- [ ] Endpoint legacy migrado (Dia )
- [ ] CI/CD basico con GitHub Actions (Dia )
- [ ] + tests EE con Playwright (Dia )
Daily standup: : AM (auto-retrospectiva en bitacora)
---
 Pr贸xima Semana (Dias -)
Sprint : Validacion y Despliegue
Entreables esperados:
- [ ] requisitos validados con evidencia (Dias -)
- [ ] Documentacion de despliegue completa (Dia )
- [ ] Despliegue staging exitoso (Dia )
- [ ] Optimizaciones y logging (Dias -)
- [ ] Despliegue produccion (Dia )
---
 Notas Adicionales
 Recursos Preparados
- Plan de implementaci贸n detallado ( lineas)
- Guia de estructura Fastify
- Justificacion Vitest
- Matriz de Eisenhower
- Estructura de bitacora
- Scripts de rollback (documentados, no ejecutados aun)
 Repositorio
- Branch: `main` (estable)
- No se han hecho commits de c贸digo aun (solo planificacion)
- Primer commit esperado: Dia (separacion arquitectonica)
 Coordinacion
- Trabajo individual (:-:)
- Sin dependencias externas identificadas
- Acceso a servidor: Verificar dia 
 Ambiente de Desarrollo
- Local: `/var/www/html/hawaii/asistencia/node-service`
- Staging: `mantochrisal.cl` (a configurar dia )
- Produccion: `mantochrisal.cl` (a configurar dia )
---
 Checklist Pre-Sprint
Documentacion:
- [x] Plan de implementaci贸n completo
- [x] Arquitectura documentada
- [x] Justificacion t胏nica Vitest
- [x] Matriz de priorizacion
- [x] Estructura de bitacora
Herramientas:
- [ ] Acceso a repositorio (verificar dia )
- [ ] PostgreSQL accesible (verificar dia )
- [ ] Valkey/Redis accesible (verificar dia )
- [ ] Apache configurado (verificar dia )
- [ ] Node.js + instalado (verificar dia )
- [ ] PHP .+ instalado (verificar dia )
- [ ] Composer instalado (verificar dia )
Claridad:
- [x] requisitos entendidos
- [x] Arquitectura target clara
- [x] Prioridades establecidas
- [x] Plan de contingencia definido
---
Firmado: GitHub Copilot 
Pr贸xima bitacora: -- (Dia - Sprint ) 
Estado: LISTO PARA COMENZAR
---
 Reflexion Final del Dia
Hoy fue un dia de planificacion exhaustiva pero necesaria. La identificacion temprana del problema arquitectonico (backend en Vite) potencialmente ahorro dias de problemas futuros. La creacion de la matriz de Eisenhower proporciono claridad sobre que NO hacer, lo cual es tan valioso como saber que hacer.
El equipo (yo) esta preparado para comenzar el sprint con confianza, criterios claros de exito, y un plan de contingencia robusto.
Confianza en el plan: Alta (/) 
Preparacion t胏nica: Alta (/) 
Claridad de requisitos: Alta (/)
!Que comience el desarrollo! ?
