/**
 * Modelos de dominio del modulo Access
 *
 * Define los tipos y estructuras que representan el estado agregado
 * del sistema de acceso. Estos tipos son inmutables y representan
 * la vista consolidada de multiples dominios.
 */

/**
 * Estados posibles del sistema de acceso
 *
 * - NOT_ENROLLED: Usuario no tiene dispositivo activo
 * - ENROLLED_NO_SESSION: Dispositivo activo pero sin session_key
 * - READY: Listo para escanear QR
 * - BLOCKED: Restriccion activa (suspension, horario, etc.)
 */
export type AccessStateType = 'NOT_ENROLLED' | 'ENROLLED_NO_SESSION' | 'READY' | 'BLOCKED';

/**
 * Acciones disponibles segun el estado
 *
 * - enroll: Redirigir a flujo de enrollment
 * - login: Iniciar sesion ECDH
 * - scan: Habilitar lector QR
 * - null: Sin accion disponible (bloqueado)
 */
export type AccessAction = 'enroll' | 'login' | 'scan' | null;

/**
 * Informacion minima del dispositivo activo
 */
export interface AccessDeviceInfo {
  readonly credentialId: string;
  readonly deviceId: number;
}

/**
 * Estado agregado del sistema de acceso
 *
 * Este tipo representa la vista consolidada del estado de un usuario
 * combinando informacion de multiples dominios:
 * - Enrollment: estado del dispositivo
 * - Session: existencia de session_key
 * - Restriction: bloqueos activos
 */
export interface AccessState {
  readonly state: AccessStateType;
  readonly action: AccessAction;
  readonly device?: AccessDeviceInfo;
  readonly message?: string;
}
