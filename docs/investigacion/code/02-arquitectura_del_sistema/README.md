# Código de Arquitectura del Sistema

Este directorio contiene todos los bloques de código extraídos del documento [02-arquitectura_del_sistema.md](../../files/02-arquitectura_del_sistema.md).

## Mapeo Código ↔ Documentación

### Sección 2.3 - Sistema Dual TOTP

#### 2.3.1 TOTPu (TOTP de Usuario)

- **[2.3.1-totpu-generation.ts](2.3.1-totpu-generation.ts)**
  - Generación de TOTPu
  - Documentación: Sección 2.3.1 - Características

- **[2.3.1-device-id-generation.ts](2.3.1-device-id-generation.ts)**
  - Generación de deviceId en el cliente
  - Documentación: Sección 2.3.1 - Generación de deviceId

#### 2.3.2 TOTPs (TOTP de Servidor)

- **[2.3.2-totps-generation.ts](2.3.2-totps-generation.ts)**
  - Generación de TOTPs
  - Documentación: Sección 2.3.2 - Características

#### 2.3 Validación Conjunta

- **[2.3-validate-attendance.ts](2.3-validate-attendance.ts)**
  - Función de validación conjunta de TOTPu y TOTPs
  - Documentación: Sección 2.3 - Validación conjunta en servidor

---

### Sección 2.4 - Precisiones Arquitectónicas de Implementación

#### 2.4.1 Enrolamiento vs Login

- **[2.4.1-derive-handshake-secret.ts](2.4.1-derive-handshake-secret.ts)**
  - Derivación de handshake secret usando HKDF
  - Documentación: Sección 2.4.1 - Key Derivation (HKDF)

#### 2.4.2 Arquitectura de Stack Tecnológico

- **[2.4.2-qr-generation.php](2.4.2-qr-generation.php)**
  - Generación de códigos QR usando bacon/bacon-qr-code
  - Acceso a BitMatrix
  - Documentación: Sección 2.4.2 - Biblioteca recomendada para QR en PHP

#### 2.4.3 Flujo de Captura y Decodificación

- **[2.4.3-attendance-scanner.ts](2.4.3-attendance-scanner.ts)**
  - Clase AttendanceScanner completa
  - Interceptación de frames de video
  - Inyección de fragmentos
  - Encriptación con handshake
  - Documentación: Sección 2.4.3 - Flujo de Captura y Decodificación Inmediata

#### 2.4.4 Validación Estadística

- **[2.4.4-attendance-validator.php](2.4.4-attendance-validator.php)**
  - Clase AttendanceValidator
  - Cálculo de certeza por múltiples factores
  - Umbrales de validación (CONFIRMED, LIKELY, UNCERTAIN, etc.)
  - Documentación: Sección 2.4.4 - Validación por Umbral Estadístico

#### 2.4.5 Timestamps y Anti-Replay

- **[2.4.5-qr-projection-manager.php](2.4.5-qr-projection-manager.php)**
  - Clase QRProjectionManager
  - Gestión de timestamps de proyección
  - Validación de timing para prevenir replay attacks
  - Documentación: Sección 2.4.5 - Timestamps del Servidor para Anti-Replay

#### 2.4.6 Criterios de Finalización

- **[2.4.6-attendance-session-manager.php](2.4.6-attendance-session-manager.php)**
  - Clase AttendanceSessionManager
  - Lógica de finalización de ciclo de proyección
  - Cálculo de duración máxima de sesión
  - Documentación: Sección 2.4.6 - Criterios de Finalización del Ciclo

---

## Estructura de Archivos

```
02-arquitectura_del_sistema/
├── README.md (este archivo)
├── 2.3.1-totpu-generation.ts
├── 2.3.1-device-id-generation.ts
├── 2.3.2-totps-generation.ts
├── 2.3-validate-attendance.ts
├── 2.4.1-derive-handshake-secret.ts
├── 2.4.2-qr-generation.php
├── 2.4.3-attendance-scanner.ts
├── 2.4.4-attendance-validator.php
├── 2.4.5-qr-projection-manager.php
└── 2.4.6-attendance-session-manager.php
```

## Tecnologías

### TypeScript/JavaScript
- `@noble/hashes/hkdf` - Derivación de claves
- `html5-qrcode` - Escaneo de QR
- `jsqr` - Decodificación de QR
- Web Crypto API - Encriptación AES-GCM

### PHP
- `bacon/bacon-qr-code` - Generación de códigos QR
- `spomky-labs/otphp` - Sistema TOTP dual

## Notas de Implementación

1. **Fragmentos de código conceptuales**: Algunos archivos (`.ts` con pseudo-código) son representaciones conceptuales y requieren adaptación para producción.

2. **Dependencias**: Instalar las librerías necesarias antes de usar los ejemplos.

3. **Seguridad**: Todos los ejemplos asumen el uso de variables de entorno para secretos (`SERVER_MASTER_SECRET`, etc.).

4. **Tipos TypeScript**: Algunos archivos requieren definiciones de tipos adicionales (`AttendanceRequest`, `ValidationResult`, etc.).

5. **Métodos auxiliares**: Algunos métodos referenciados (como `detectQRLocation`, `extractModules`, etc.) están simplificados y requieren implementación completa.

---

**Fecha de extracción**: 2025-10-25
**Documento fuente**: [02-arquitectura_del_sistema.md](../../files/02-arquitectura_del_sistema.md)
