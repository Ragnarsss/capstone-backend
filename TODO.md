# TODO - Sistema de Asistencia con QR Dinámico

> Última actualización: Enero 2025

## Estado General del Proyecto

El proyecto se encuentra en desarrollo activo con la **Fase 6 completada**. La arquitectura base está funcional con validación de QR, manejo de rounds/salones, y una nueva arquitectura de validación basada en pipeline.

---

## ✅ Fases Completadas

### Fase 1-5: Fundamentos (Completado)
- [x] Estructura base del proyecto
- [x] Configuración de contenedores (Podman/Docker)
- [x] Integración PHP/Node.js
- [x] Generación de QR dinámicos
- [x] Validación básica de asistencia

### Fase 6: Refactorización y Mejoras Arquitectónicas (Completado)

#### Fase 6.1: Manejo de Sesiones (Completado)
- [x] `SessionService` para gestión del ciclo de vida de sesiones
- [x] Endpoints `/api/session/start` y `/api/session/end`
- [x] Propagación de eventos via WebSocket

#### Fase 6.2: Round-Aware System (Completado)
- [x] Sistema multi-salón con rounds independientes
- [x] Máquina de estados para control de rounds
- [x] Gestión concurrente de múltiples sesiones

#### Fase 6.3: Sistema Multi-Salón (Completado)
- [x] `RoomSessionStore` con `RoomRoundTracker`
- [x] Validación de freshness del QR por salón
- [x] Estadísticas y eventos segregados por room

#### Fase 6.4: Refactor SoC - Validation Pipeline (Completado)
- [x] Patrón Pipeline para validación de escaneos
- [x] Stages puros y asíncronos separados
- [x] `ValidationContext` como unidad de datos
- [x] `ValidationPipelineRunner` para orquestación
- [x] 10 stages especializados:
  - `decryptPayloadStage`
  - `validateStructureStage`
  - `validateOwnershipStage`
  - `loadQrStateStage`
  - `validateQrExistsStage`
  - `validateQrNotConsumedStage`
  - `loadStudentStateStage`
  - `validateStudentNotDuplicateStage`
  - `validateStudentNotPausedStage`
  - `validateStudentNotCompletedStage`
  - `validateRoundMatchStage`
- [x] `ValidateScanUseCase` - validación pura sin efectos secundarios
- [x] `CompleteScanUseCase` - orquestación completa con side effects
- [x] `StatsCalculator` extraído a dominio
- [x] Adapters para inversión de dependencias
- [x] `ErrorMapper` para presentación HTTP
- [x] 20 tests unitarios para stages
- [x] Eliminación del legacy `AttendanceValidationService`

---

## 🔄 Fases Pendientes

### Fase 7: Persistencia PostgreSQL
**Estimado: 6-8 horas**

- [ ] Esquema de base de datos para sesiones y asistencias
- [ ] Repositorios con patrón Repository
- [ ] Migraciones SQL
- [ ] Persistencia de estados de round
- [ ] Recuperación ante reinicio del servicio

### Fase 8: QRs Falsos Adicionales
**Estimado: 2-4 horas**

- [ ] Generación de QR señuelo adicionales
- [ ] Estrategias de distribución de falsos
- [ ] Métricas de intentos de escaneo fraudulento

### Fase 9: FIDO2 + ECDH para Enrolamiento
**Estimado: 12-16 horas**

- [ ] Flujo de enrolamiento con WebAuthn
- [ ] Intercambio de claves ECDH
- [ ] Almacenamiento seguro de credenciales
- [ ] Validación biométrica en dispositivos

### Fase 10: Integración PHP Legacy
**Estimado: 4-6 horas**

- [ ] Endpoints de sincronización con PHP
- [ ] Autenticación delegada
- [ ] Mapeo de usuarios existentes
- [ ] Migración gradual de funcionalidades

---

## 📁 Estructura Actual del Backend (node-service)

```
src/backend/attendance/
├── application/
│   ├── index.ts                    # Barrel exports
│   ├── validate-scan.usecase.ts    # Validación pura
│   └── complete-scan.usecase.ts    # Flujo completo con side effects
├── domain/
│   ├── stats-calculator.ts         # Cálculo de estadísticas
│   └── validation-pipeline/
│       ├── context.ts              # ValidationContext
│       ├── runner.ts               # PipelineRunner
│       ├── stage.interface.ts      # Stage, SyncStage interfaces
│       └── stages/
│           ├── index.ts            # Barrel + factory
│           ├── decrypt-payload.stage.ts
│           ├── validate-structure.stage.ts
│           ├── validate-ownership.stage.ts
│           ├── load-qr-state.stage.ts
│           ├── validate-qr.stages.ts
│           ├── load-student-state.stage.ts
│           ├── validate-student.stages.ts
│           └── validate-round-match.stage.ts
├── infrastructure/
│   ├── index.ts
│   └── adapters/
│       ├── qr-state.adapter.ts
│       ├── student-state.adapter.ts
│       └── complete-scan-deps.adapter.ts
├── presentation/
│   ├── routes.ts                   # Rutas HTTP
│   └── error-mapper.ts             # Mapeo error→HTTP response
└── __tests__/
    └── stages.test.ts              # 20 tests unitarios
```

---

## 🧪 Testing

### Ejecutar Tests
```bash
# Dentro del contenedor
podman compose -f compose.yaml -f compose.dev.yaml exec node-service pnpm test

# Tests específicos de stages
podman compose -f compose.yaml -f compose.dev.yaml exec node-service pnpm test -- --test-name-pattern="Stage"
```

### Cobertura Actual
- ✅ 20 tests para stages de validación
- ⚠️ Pendiente: tests de integración para UseCases
- ⚠️ Pendiente: tests E2E para flujo completo

---

## 📝 Notas de Desarrollo

### Convenciones (ver daRulez.md)
- Commits incrementales y atómicos
- Ejecución siempre dentro de contenedores
- TypeScript estricto
- Inyección de dependencias via interfaces

### Rama Actual
`fase-6-4-refactor-soc-validation` - 12 commits de refactorización

### Próximo Paso Sugerido
Merge de la rama actual a `main` y planificación de Fase 7 (PostgreSQL).

---

## 📊 Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| Líneas eliminadas (legacy) | ~415 |
| Tests unitarios | 20 |
| Stages de validación | 10 |
| UseCases | 2 |
| Adapters | 3 |
