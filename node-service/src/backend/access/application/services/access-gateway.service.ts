import type { ISessionQuery, IRestrictionQuery } from '../../../shared/ports';
import { EnrollmentFlowOrchestrator, AccessResult } from '../../../enrollment/application/orchestrators';

/**
 * Estado agregado del sistema de acceso
 */
export interface AccessState {
  state: 'NOT_ENROLLED' | 'ENROLLED_NO_SESSION' | 'READY' | 'BLOCKED';
  action: 'enroll' | 'login' | 'scan' | null;
  device?: { credentialId: string; deviceId: number };
  message?: string;
}

/**
 * AccessGatewayService
 *
 * Responsabilidad unica: Leer estado agregado de todos los dominios
 *
 * Arquitectura delegada:
 * - Enrollment (CheckEnrolado + EvaluarUnoAUno): EnrollmentFlowOrchestrator.attemptAccess()
 * - Sesion (VerificaSessionKey): sessionQuery.hasActiveSession()
 * - Restricciones: restrictionQuery.isBlocked()
 *
 * Principios:
 * - IDEMPOTENTE: Mismo resultado para mismo estado
 * - NO MUTA: Solo lee de los dominios
 * - DESACOPLADO: Delega logica a cada dominio segun SoC
 *
 * Flujo (segun spec-architecture.md):
 * 1. Verificar restricciones (restriction domain)
 * 2. Verificar enrollment + politica 1:1 (enrollment domain via orchestrator)
 * 3. Verificar sesion (session domain)
 *
 * Logica basada en spec-architecture.md seccion "Access Gateway"
 */
export class AccessGatewayService {
  constructor(
    private readonly orchestrator: EnrollmentFlowOrchestrator,
    private readonly sessionQuery: ISessionQuery,
    private readonly restrictionQuery: IRestrictionQuery,
  ) {}

  /**
   * Obtiene el estado agregado del usuario
   *
   * @param userId - ID del usuario
   * @param deviceFingerprint - Huella del dispositivo actual para validacion 1:1
   * @returns Estado agregado del sistema
   */
  async getState(userId: number, deviceFingerprint: string): Promise<AccessState> {
    // 1. Verificar restricciones (primera linea de defensa)
    const restriction = await this.restrictionQuery.isBlocked(userId);
    if (restriction.blocked) {
      return {
        state: 'BLOCKED',
        action: null,
        message: restriction.reason,
      };
    }

    // 2. Verificar enrollment + politica 1:1 via orchestrator (automata)
    const enrollmentResult = await this.orchestrator.attemptAccess(userId, deviceFingerprint);

    if (enrollmentResult.result === AccessResult.REQUIRES_ENROLLMENT) {
      return {
        state: 'NOT_ENROLLED',
        action: 'enroll',
      };
    }

    if (enrollmentResult.result === AccessResult.REQUIRES_REENROLLMENT) {
      return {
        state: 'NOT_ENROLLED',
        action: 'enroll',
        message: 'Dispositivo ya esta registrado en otra sesion. Re-enrolement requerido.',
      };
    }

    // ACCESS_GRANTED: Usuario esta enrolado y cumple politica 1:1
    // 3. Verificar sesion activa
    const hasSession = await this.sessionQuery.hasActiveSession(userId);
    if (!hasSession) {
      return {
        state: 'ENROLLED_NO_SESSION',
        action: 'login',
        device: enrollmentResult.device ? {
          credentialId: enrollmentResult.device.credentialId,
          deviceId: enrollmentResult.device.deviceId,
        } : undefined,
      };
    }

    return {
      state: 'READY',
      action: 'scan',
      device: enrollmentResult.device ? {
        credentialId: enrollmentResult.device.credentialId,
        deviceId: enrollmentResult.device.deviceId,
      } : undefined,
    };
  }
}
