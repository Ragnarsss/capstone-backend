# INFORME DE ORQUESTACIÓN: PLAN DE ACCIÓN CRÍTICO

## RESUMEN EJECUTIVO

Los dos análisis confirman una arquitectura sólida (8.7/10) pero identifican **desviaciones críticas** en Separation of Concerns que deben corregirse antes de escalamiento. Las vulnerabilidades principales son:

- **Acoplamiento técnico en domain layer** (QRGenerator depende de librería externa)

- **Lógica de negocio en presentation layer** (orquestación de countdown en controller)

- **Violación de Dependency Inversion** (instanciación concreta en application layer)

Estos problemas no son cosméticos: dificultan testing, incrementan costo de cambio y erosionan los límites modulares. El roadmap prioriza corregir violaciones de principios sobre mejoras opcionales.

---

## CRITERIOS DE ATOMICIDAD

Cada tarea cumple:

- **Integridad funcional**: El sistema despliega y opera igual o mejor que antes

- **Rollback posible**: Los cambios son reversibles sin afectar otros módulos

- **Test coverage mantenido**: Los tests existentes pasan o son refactorizados en el mismo ciclo

- **Sin deuda técnica incremental**: No se introducen nuevas violaciones para corregir las actuales

- **NO INCLUIR EMOJIS NI EMOTICONES**

---

## TAREAS ORGANIZADAS POR DIFICULTAD

### DIFICULTAD BAJA

#### Tarea 1.1: Encapsulación de autenticación WebSocket

- **Descripción**: Extraer la lógica de verificación JWT del `WebSocketController` a un guard/middleware dedicado en la misma capa de presentación.

- **Impacto**: Reduce la responsabilidad del controller, mejora reutilización y testabilidad del handshake WS.

- **Criterio de finalización**: El controller delega 100% de la lógica de autenticación; se mantiene comportamiento de handshake; tests de conexión WS pasan.

- **Riesgo**: Mínimo. Cambio localizado en presentation layer.

#### Tarea 1.2: Inyección de configuración estática

- **Descripción**: Reemplazar imports directos de `shared/config` con paso de configuración via constructor en `JWTUtils` y `QRProjectionService`.

- **Impacto**: Elimina acoplamiento oculto a módulo compartido; facilita tests unitarios con configuración mock.

- **Criterio de finalización**: Ambos servicios reciben config en constructor; `app.ts` pasa config explícitamente; sin referencias directas a `shared/config` desde domain/application.

- **Riesgo**: Bajo. Impacta solo firmas de constructor y composition root.

#### Tarea 1.3: Creación de Value Objects básicos

- **Descripción**: Convertir tipos primitivos críticos (`userId: number`, `sessionId: string`) a Value Objects en domain layer de cada módulo.

- **Impacto**: Mejora type safety y validación centralizada de identificadores.

- **Criterio de finalización**: Dominio compila; se validan reglas básicas (ej: userId > 0); ningún cambio funcional en comportamiento.

- **Riesgo**: Mínimo. Cambios localizados a modelos de dominio.

---

### DIFICULTAD MEDIA

#### Tarea 2.1: Abstracción de QRGenerator

- **Descripción**: Crear interfaz `QRCodeRenderer` en domain layer de `qr-projection` y migrar implementación concreta (uso de librería `qrcode`) a nueva clase en infrastructure layer.

- **Impacto**: **CRÍTICO**. Elimina violación de SoC estricto; desacopla lógica de negocio de detalle técnico; permite cambiar librería sin modificar domain.

- **Criterio de finalización**: `QRGenerator` domain service depende de interfaz; implementación concreta existe en infrastructure; `app.ts` inyecta implementación; generación de QR funciona idénticamente.

- **Riesgo**: Medio. Requiere modificar tres capas (domain, infrastructure, composition root) pero dentro de un único módulo vertical.

- **Dependencias**: Blocking para Tarea 2.3 (DI completo).

#### Tarea 2.2: Migración de orquestación de countdown

- **Descripción**: Mover lógica de `setInterval`, `sleep` y fases de countdown desde `WebSocketController` a `QRProjectionService` en application layer.

- **Impacto**: **CRÍTICO**. Restaura SoC: el controller solo coordina entrada/salida; el servicio maneja ciclo de vida del caso de uso.

- **Criterio de finalización**: Controller delega a servicio; servicio expone métodos `startRotation()`/`stopRotation()`; WebSocket publica eventos correctamente; comportamiento de rotación de QR preservado.

- **Riesgo**: Medio-Alto. Requiere diseñar nueva API de servicio sin romper protocolo WS. Necesita testing de integración WS completo.

- **Dependencias**: Blocking para Tarea 2.3 (DI completo).

#### Tarea 2.3: Implementación de Dependency Injection para repositorios

- **Descripción**: Modificar `QRProjectionService` y `EnrollmentService` para recibir instancias de repositorios via constructor en lugar de instanciarlos internamente. Actualizar `app.ts` como composition root.

- **Impacto**: **CRÍTICO**. Habilita testabilidad sin mocks complejos; cumple Dependency Inversion Principle; desacopla application de infrastructure.

- **Criterio de finalización**: Servicios no importan clases de infrastructure; repositories se pasan en constructor; `app.ts` crea e inyecta todas las dependencias; contenedor aún no necesario (inyección manual).

- **Riesgo**: Medio. Afecta múltiples servicios y el bootstrap. Requiere revisar que el ciclo de vida de repositorios sea correcto (singleton vs scoped).

- **Dependencias**: Requiere que Tarea 2.1 esté completa (para poder inyectar QR renderer).

---

### DIFICULTAD ALTA

#### Tarea 3.1: Reestructuración frontend con vertical slicing

- **Descripción**: Replicar arquitectura backend en `src/frontend/modules/{auth|enrollment|qr-projection}/` con subcarpetas `application`, `domain`, `infrastructure`, `presentation`.

- **Impacto**: Mejora coherencia end-to-end; facilita mantenimiento frontend a medida que crece complejidad.

- **Criterio de finalización**: Frontend compila y funciona idénticamente; módulos frontend tienen límites claros; se elimina código duplicado cross-module.

- **Riesgo**: Alto. Es refactoring masivo de frontend; requiere tiempo significativo; riesgo de regresión UI/UX; necesita testing manual exhaustivo.

- **Nota**: Esta tarea es **opcional y postergable**. El frontend funciona actualmente. Prioridad baja comparada con violaciones de SoC en backend.

---

## ROADMAP SECUENCIAL RECOMENDADO

### FASE 1: CORRECCIÓN CRÍTICA DE SoC (Sprint 1-2)

**Orden**: 1.2 → 1.1 → 2.1 → 2.2 → 2.3

**Justificación**:

- 1.2 (config injection) desbloquea testabilidad para las demás
- 1.1 (auth encapsulation) es quick win que reduce complejidad del controller
- 2.1 (QRGenerator abstraction) es prerequisito técnico para 2.3
- 2.2 (countdown migration) debe hacerse ANTES de 2.3 para no mezclar responsabilidades en el nuevo servicio DI
- 2.3 (DI) es el cierre: solo se puede inyectar abstracciones ya creadas

**Entregable**: Backend con SoC estricto, tests unitarios e integración verdes, sin funcionalidad rota.

### FASE 2: MEJORAS DE CALIDAD DE CÓDIGO (Sprint 3)

**Orden**: 1.3 → 3.1 (si se prioriza)

**Justificación**:

- Value Objects (1.3) son independientes y aprovechan el dominio ya limpio
- Frontend (3.1) es opcional y requiere estabilidad previa en backend

---

## CRITERIOS DE ACEPTACIÓN GLOBALES

1. **Coverage**: Cada tarea incluye test unitarios/integración que pasan CI/CD
2. **Documentación**: Se actualiza DA-001 si se modifican límites modulares
3. **No drift**: Se añade un linter rule para prohibir imports directos de `shared/config` desde domain/application
4. **Revisión**: Cada PR debe validar que no se introducen nuevas violaciones de SoC mediante inspección manual de imports

---

## RIESGOS Y MITIGACIONES

- **Riesgo**: La Tarea 2.2 puede introducir regresiones en timing del WebSocket si no se maneja correctamente el ciclo de vida de intervalos.
  - **Mitigación**: Implementar tests de integración WS con clientes reales antes del merge. Validar cleanup en `onClose`.

- **Riesgo**: La Tarea 2.3 puede romper singleton pattern de ValkeyClient si se inyectan instancias incorrectas.
  - **Mitigación**: Inyectar `ValkeyClient.getInstance()` explícitamente en `app.ts` y documentar ciclo de vida. No usar contenedor DI automático por ahora.

- **Riesgo**: Postergar Tarea 3.1 puede causar divergencia arquitectónica frontend-backend.
  - **Mitigación**: Si se posterga, documentar decisión en ADR y establecer guardrails (ej: máximo 3 archivos por módulo frontend antes de reestructurar).
