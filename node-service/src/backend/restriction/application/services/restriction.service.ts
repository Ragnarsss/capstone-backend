import type { RestrictionResult } from '../../domain/models';

/**
 * RestrictionService (STUB)
 *
 * Marcador de posicion para verificacion externa de restricciones.
 * Sera implementado para integrarse con modulo PHP para:
 * - Horarios de clase
 * - Suspensiones de usuarios
 * - Bloqueos temporales
 *
 * Implementacion actual: Siempre retorna { blocked: false }
 * Futuro: Llamara servicio PHP via HTTP o cola de mensajes
 */

/**
 * Interfaz del servicio de restricciones
 * Permite inyeccion de dependencias y mocking
 */
export interface IRestrictionService {
  checkRestrictions(userId: number): Promise<RestrictionResult>;
}

/**
 * RestrictionService (Implementacion Stub)
 *
 * TODO: Implementar integracion con modulo PHP de restricciones
 * Ver: documents/03-especificaciones-tecnicas/flujo-automata-enrolamiento.md
 *
 * Implementacion futura:
 * 1. Llamar endpoint PHP: GET /api/restrictions/{userId}
 * 2. Parsear respuesta para restricciones activas
 * 3. Retornar RestrictionResult apropiado
 */
export class RestrictionService implements IRestrictionService {
  /**
   * Verifica si usuario tiene restricciones activas
   *
   * STUB: Siempre retorna { blocked: false }
   *
   * @param userId - Usuario a verificar
   * @returns RestrictionResult - Siempre permite acceso (stub)
   */
  async checkRestrictions(userId: number): Promise<RestrictionResult> {
    // STUB: Sin restricciones implementadas aun
    // Sera reemplazado con integracion real a PHP
    return {
      blocked: false,
    };
  }
}
