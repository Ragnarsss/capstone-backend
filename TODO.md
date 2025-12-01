# Estado del Proyecto y Próximos Pasos

## Resumen de Progreso Reciente (Completado)

1.  **Limpieza y Reestructuración Documental**:
    *   Se limpió el directorio raíz, moviendo documentación técnica a `documents/` y scripts de prueba a `scripts/`.
    *   Se eliminaron archivos obsoletos (`flujo.md`, planes antiguos) que no reflejaban la arquitectura actual.

2.  **Modernización de Planes de Implementación**:
    *   Se reescribieron `PLAN-4-a` (Infraestructura), `PLAN-4-b` (Attendance Backend), `PLAN-4-c` (Enrollment) y `PLAN-4-d` (Frontend) para alinearlos con la arquitectura "Modular Monolith" y el uso de Valkey/Redis.
    *   Se actualizó `daRulez.md` con nuevas reglas de flujo de trabajo incremental.

3.  **Backend Fase 6 (Lógica de Negocio)**:
    *   Implementada la validación de Rondas y Intentos en el backend (`AttendanceService`).
    *   Integración con Valkey para persistencia efímera de estado.
    *   Validado mediante 22 tests unitarios y de integración.

---

## Próximos Pasos: Fase 6 - Integración Frontend

### Fase 6.1: Frontend Crypto Integration (EN CURSO)
**Objetivo:** Dotar al cliente (navegador) de la capacidad de desencriptar los QRs generados por el backend y respetar la lógica de "1 intento por ronda".

**Tareas Detalladas:**

1.  **Infraestructura Criptográfica (Web Crypto API)**:
    *   Crear `node-service/src/frontend/shared/crypto/aes-gcm.ts`.
    *   Implementar función `decryptQR(encryptedBase64, key)` usando `window.crypto.subtle`.
    *   Crear `node-service/src/frontend/shared/crypto/mock-keys.ts` con las claves estáticas de desarrollo (deben coincidir con las del backend).

2.  **Lógica de Escaneo Inteligente (`qr-scan.service.ts`)**:
    *   Modificar el callback de detección de QR.
    *   **Paso 1:** Capturar string crudo del scanner.
    *   **Paso 2:** Intentar desencriptar usando `aes-gcm.ts`. Si falla, ignorar (ruido o QR inválido).
    *   **Paso 3:** Parsear JSON y extraer `round_number`.
    *   **Paso 4:** Validar contra el estado local (`lastProcessedRound`). Si `round_number <= lastProcessedRound`, ignorar para evitar envíos duplicados en la misma ronda.
    *   **Paso 5:** Si es válido -> **Pausar Cámara** -> Enviar a API.

3.  **Manejo de Respuestas API (`attendance-api.client.ts`)**:
    *   Actualizar cliente HTTP para manejar códigos de estado específicos de la lógica de negocio:
        *   `200 OK`: Asistencia registrada.
        *   `403 Forbidden`: Intento fallido (ej. fuera de tiempo, pero ronda válida).
        *   `429 Too Many Requests`: Usuario bloqueado temporalmente o intento duplicado.

### Fase 6.2: UI Feedback & State Management
**Objetivo:** Informar al usuario de lo que está pasando (no solo "escanear", sino "procesando", "esperando siguiente ronda").

**Tareas Detalladas:**

1.  **Estados de la UI**:
    *   Implementar máquina de estados simple en `camera-view.component.ts`:
        *   `IDLE`: Cámara apagada.
        *   `SCANNING`: Buscando QR.
        *   `PROCESSING`: QR detectado, desencriptando/enviando (Spinner).
        *   `SUCCESS`: Check verde, mensaje de éxito.
        *   `ERROR`: Cruz roja, mensaje de error (ej. "Intento fallido").
        *   `COOLDOWN`: Cuenta regresiva para la siguiente ronda.

2.  **Bloqueo Visual**:
    *   Durante `PROCESSING` y `COOLDOWN`, el escáner debe estar visualmente desactivado (overlay) para evitar ansiedad del usuario.

### Fase 6.3: Integración Final
**Objetivo:** Verificar el flujo completo Backend <-> Frontend.

1.  Ejecutar `test-integration.sh` con el frontend conectado.
2.  Verificar que los QRs generados por el script de prueba sean leídos correctamente por el navegador.
