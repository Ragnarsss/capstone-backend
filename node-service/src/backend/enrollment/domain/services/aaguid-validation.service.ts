import { logger } from '../../../../shared/infrastructure/logger';
import { config } from '../../../../shared/config';

/**
 * Servicio de validacion de AAGUID (Authenticator Attestation GUID)
 *
 * Proposito: Rechazar enrollment de dispositivos FIDO2 no autorizados
 * validando el AAGUID contra una whitelist configurable.
 *
 * Segun fase 22.3, este servicio implementa la cuarta capa de proteccion
 * anti-compartir documentada en Caracterizacion.md seccion 4.1
 *
 * AAGUIDs conocidos de autenticadores de plataforma:
 * - Windows Hello: varios modelos de TPM
 * - Google Password Manager: Android devices
 * - Apple: iCloud Keychain, Apple Passwords
 * - Samsung Pass: dispositivos Samsung
 */

/**
 * Whitelist de AAGUIDs autorizados para enrollment
 *
 * Fuente: https://github.com/passkeydeveloper/passkey-authenticator-aaguids
 *
 * IMPORTANTE: Esta lista debe actualizarse cuando se agreguen nuevos
 * dispositivos autorizados. Para agregar un nuevo AAGUID:
 * 1. Identificar el modelo de autenticador
 * 2. Obtener el AAGUID de la fuente oficial
 * 3. Agregar entrada a este objeto con comentario descriptivo
 * 4. Reiniciar el servicio
 */
const AUTHORIZED_AAGUIDS: Record<string, string> = {
  // === Windows Hello (TPM) ===
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',

  // === Google Password Manager (Android) ===
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',

  // === Apple (iOS/macOS) ===
  'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain (Managed)',
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'Apple Passwords',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',

  // === Samsung ===
  '53414d53-554e-4700-0000-000000000000': 'Samsung Pass',

  // === Thales (SDK biometrico) ===
  '66a0ccb3-bd6a-191f-ee06-e375c50b9846': 'Thales Bio iOS SDK',
  '8836336a-f590-0921-301d-46427531eee6': 'Thales Bio Android SDK',
};

/**
 * AAGUID especial que indica "sin attestation"
 * Algunos navegadores/dispositivos retornan este valor cuando no hay attestation
 */
const NULL_AAGUID = '00000000-0000-0000-0000-000000000000';

export interface AaguidValidationResult {
  valid: boolean;
  authenticatorName?: string;
  reason?: string;
}

export class AaguidValidationService {
  private readonly enabled: boolean;
  private readonly allowNullAaguid: boolean;
  private readonly authorizedAaguids: Map<string, string>;

  constructor() {
    // Usar configuracion centralizada
    this.enabled = config.aaguid.validationEnabled;
    this.allowNullAaguid = config.aaguid.allowNull;

    // Cargar whitelist en memoria para busqueda O(1)
    this.authorizedAaguids = new Map(Object.entries(AUTHORIZED_AAGUIDS));

    logger.info('[AaguidValidationService] Inicializado', {
      enabled: this.enabled,
      allowNullAaguid: this.allowNullAaguid,
      authorizedCount: this.authorizedAaguids.size,
    });
  }

  /**
   * Valida si un AAGUID esta autorizado para enrollment
   *
   * @param aaguid - AAGUID del dispositivo en formato UUID
   * @returns Resultado de validacion con nombre del autenticador si es valido
   */
  validate(aaguid: string): AaguidValidationResult {
    // Si la validacion esta deshabilitada, siempre permitir
    if (!this.enabled) {
      logger.debug('[AaguidValidationService] Validacion deshabilitada, permitiendo', { aaguid });
      return {
        valid: true,
        authenticatorName: 'Validacion deshabilitada',
      };
    }

    // Normalizar a minusculas para comparacion consistente
    const normalizedAaguid = aaguid.toLowerCase();

    // Caso especial: AAGUID nulo (sin attestation)
    // En produccion esto deberia rechazarse, pero se puede configurar
    if (normalizedAaguid === NULL_AAGUID) {
      if (this.allowNullAaguid) {
        logger.warn('[AaguidValidationService] AAGUID nulo permitido por configuracion');
        return {
          valid: true,
          authenticatorName: 'Sin attestation (permitido)',
        };
      }

      logger.warn('[AaguidValidationService] AAGUID nulo rechazado', { aaguid });
      return {
        valid: false,
        reason: 'Dispositivo sin attestation no permitido',
      };
    }

    // Buscar en whitelist
    const authenticatorName = this.authorizedAaguids.get(normalizedAaguid);

    if (authenticatorName) {
      logger.info('[AaguidValidationService] AAGUID autorizado', {
        aaguid: normalizedAaguid,
        authenticator: authenticatorName,
      });
      return {
        valid: true,
        authenticatorName,
      };
    }

    // AAGUID no encontrado en whitelist
    logger.warn('[AaguidValidationService] AAGUID rechazado - no autorizado', {
      aaguid: normalizedAaguid,
    });
    return {
      valid: false,
      reason: `Dispositivo con AAGUID ${normalizedAaguid} no esta en la lista de autenticadores autorizados`,
    };
  }

  /**
   * Retorna si la validacion esta habilitada
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Retorna lista de AAGUIDs autorizados (para debugging/admin)
   */
  getAuthorizedAaguids(): Array<{ aaguid: string; name: string }> {
    return Array.from(this.authorizedAaguids.entries()).map(([aaguid, name]) => ({
      aaguid,
      name,
    }));
  }
}
