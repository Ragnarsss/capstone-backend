import type { IDeviceQuery, ISessionQuery, IRestrictionQuery } from '../../../shared/ports';

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
 * Principios:
 * - IDEMPOTENTE: Mismo resultado para mismo estado
 * - NO MUTA: Solo lee de los dominios
 * - DESACOPLADO: No conoce logica interna de cada dominio
 *
 * Logica basada en spec-enrollment.md seccion "Access Gateway"
 */
export class AccessGatewayService {
  constructor(
    private readonly deviceQuery: IDeviceQuery,
    private readonly sessionQuery: ISessionQuery,
    private readonly restrictionQuery: IRestrictionQuery,
  ) {}

  /**
   * Obtiene el estado agregado del usuario
   *
   * Flujo:
   * 1. Verificar restricciones
   * 2. Verificar enrollment
   * 3. Verificar sesion
   *
   * @param userId - ID del usuario
   * @returns Estado agregado del sistema
   */
  async getState(userId: number): Promise<AccessState> {
    // 1. Verificar restricciones
    const restriction = await this.restrictionQuery.isBlocked(userId);
    if (restriction.blocked) {
      return {
        state: 'BLOCKED',
        action: null,
        message: restriction.reason,
      };
    }

    // 2. Verificar enrollment
    const device = await this.deviceQuery.getActiveDevice(userId);
    if (!device) {
      return {
        state: 'NOT_ENROLLED',
        action: 'enroll',
      };
    }

    // 3. Verificar sesion
    const hasSession = await this.sessionQuery.hasActiveSession(userId);
    if (!hasSession) {
      return {
        state: 'ENROLLED_NO_SESSION',
        action: 'login',
        device,
      };
    }

    return {
      state: 'READY',
      action: 'scan',
      device,
    };
  }
}
