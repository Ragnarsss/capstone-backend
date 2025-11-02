> **Navegación:** [← 00 Index](00-index.md) | [Índice](00-index.md) | [02 Arquitectura →](02-arquitectura.md)

---

# 1. Introducción

---

## Análisis Técnico: Sistema de Asistencia con QR Fragmentado Rotativo

**Fecha:** 2025-10-23
**Versión:** 2.1
**Estado:** Diseño Arquitectónico Detallado - Implementación Específica
**Actualización:** Sistema clarificado con:

- Fragmentación de encoded data únicamente
- Sistema dual TOTP con WebAuthn/FIDO2
- Validación por umbral estadístico (no booleana)
- Arquitectura WebAssembly + PHP
- Encriptación con keys derivadas de handshake

---

## 1.1 Concepto General

Sistema de asistencia que utiliza **códigos QR fragmentados y rotativos** proyectados en pantalla para validar la presencia física de múltiples participantes simultáneamente.

**Principio fundamental:**
Cada usuario recibe al inicio de sesión una representación de la **zona de datos codificados (encoded data)** de su QR personal. El servidor genera un QR "truncado" (en la zona de datos se elimina una porcion) que proyecta en rotación. Solo cuando el usuario combina su porción almacenada con el QR proyectado puede decodificar el mensaje completo.

**Características clave:**

- **Fragmentación de encoded data únicamente**: Solo la región de datos del QR se fragmenta, respetando los patrones funcionales (finder, timing, alignment, format, version info)
- **Distribución en login**: Cada usuario recibe su porción de encoded data al iniciar sesión (representación matricial de puntos negros)
- **QR rotativo "truncado"**: La pantalla proyecta QRs que carecen de la porción de datos del usuario correspondiente
- **Reconstrucción local**: El cliente combina su porción + QR proyectado → decodifica payload encriptado
- **Doble TOTP**:
  - **TOTPu** (Usuario): Token único por sesión-dispositivo, con penalización por cambio de dispositivo
  - **TOTPs** (Servidor): Token temporal por cada QR generado, similar a códigos SMS
- **Validación multi-ronda**: Desde X intentos por sesión, con confirmación progresiva del servidor.

## 1.2 Componentes del Sistema QR

El sistema manipula únicamente la región de **encoded data**, preservando:

```text
┌──────────────────────────────────────────────────────────────────┐
│QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ│
│QQ██████████  FF████████████████████████████VVVVVVVV  ██████████QQ│
│QQ██      ██  FF████████████████████████████VVVVVVVV  ██      ██QQ│
│QQ██  ██  ██  FF████████████████████████████VVVVVVVV  ██  ██  ██QQ│
│QQ██  ██  ██  FF████████████████████████████VVVVVVVV  ██  ██  ██QQ│
│QQ██      ██  FF████████████████████████████VVVVVVVV  ██      ██QQ│
│QQ██████████  TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT  ██████████QQ│
│QQ            FF████████████████████████████████████            QQ│
│QQFFFFFFFFTTFFFF████████████████████████████████████FFFFFFFFFFFFQQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQ████████TT████████████████████████████████████████████████████QQ│
│QQVVVVVVVVTT████████████████████████████████████████████████████QQ│
│QQVVVVVVVVTT██████████████████████████████████AAAAAAAAAA████████QQ│
│QQVVVVVVVVTT██████████████████████████████████AA      AA████████QQ│
│QQ            FF██████████████████████████████AA  AA  AA████████QQ│
│QQ██████████  FF██████████████████████████████AA      AA████████QQ│
│QQ██      ██  FF██████████████████████████████AAAAAAAAAA████████QQ│
│QQ██  ██  ██  FF████████████████████████████████████████████████QQ│
│QQ██  ██  ██  FF████████████████████████████████████████████████QQ│
│QQ██      ██  FF████████████████████████████████████████████████QQ│
│QQ██████████  FF████████████████████████████████████████████████QQ│
│QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ│
└──────────────────────────────────────────────────────────────────┘
```

**Zonas NO modificadas (necesarias para detección y lectura):**
- **Finder Patterns** (3 esquinas): Detección y orientación del QR
- **Timing Patterns (T)**: Sincronización de la matriz de bits
- **Alignment Patterns (A)**: Corrección de distorsión (QR grandes)
- **Format Information (F)**: Nivel de ECC y patrón de máscara
- **Version Information (V)**: Tamaño del QR (versiones ≥7)
- **Encoded Data (█)**: Región que contiene el payload codificado (fragmentada)

## 1.3 Objetivos de Seguridad

1. **Anti-screenshot**: Un QR capturado en foto carece de la zona de datos completa, inútil sin la porción del usuario
2. **Anti-retransmisión**: Sistema dual TOTP (TOTPu + TOTPs) previene reutilización de códigos
3. **Presencia física requerida**: Solo quien esté presente ve la rotación de su QR específico
4. **Anti-compartir sesión**: TOTPu con penalización por cambio de dispositivo desalienta compartir credenciales
5. **Resistencia a colusión**: Cada porción de datos es única por usuario y por sesión
6. **Validación progresiva**: Hasta 3 rondas de validación con confirmación incremental

