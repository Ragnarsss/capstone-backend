import { DeviceRepository, EnrollmentChallengeRepository } from '../../infrastructure';
import type { Device } from '../../domain/entities';
import type { EnrollmentState } from '../../domain/models';
import { EnrollmentStateMachine } from '../../domain/state-machines';

/**
 * Input DTO para Get Enrollment Status
 */
export interface GetEnrollmentStatusInput {
  userId: number;
}

/**
 * Device info para respuesta
 */
export interface DeviceInfo {
  deviceId: number;
  credentialId: string;
  aaguid: string;
  enrolledAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
  status: EnrollmentState;
}

/**
 * Output DTO para Get Enrollment Status
 */
export interface GetEnrollmentStatusOutput {
  enrollmentState: EnrollmentState;
  isEnrolled: boolean;
  deviceCount: number;
  maxDevices: number;
  canEnrollMore: boolean;
  devices: DeviceInfo[];
}

/**
 * Use Case: Obtener estado de enrollment de un usuario
 * 
 * Política 1:1:
 * - maxDevices = 1 (un dispositivo por usuario)
 * - canEnrollMore = true siempre (el nuevo revocará el anterior)
 * 
 * Retorna:
 * - Si el usuario tiene dispositivos enrolados
 * - Cantidad de dispositivos (0 o 1 con política 1:1)
 * - Si puede enrolar más (siempre true, se auto-revoca)
 * - Lista de dispositivos con metadata básica
 */
export class GetEnrollmentStatusUseCase {
  /** Politica 1:1: maximo 1 dispositivo por usuario */
  private readonly MAX_DEVICES = 1;

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly challengeRepository?: EnrollmentChallengeRepository
  ) {}

  async execute(input: GetEnrollmentStatusInput): Promise<GetEnrollmentStatusOutput> {
    const { userId } = input;

    // Obtener todos los dispositivos del usuario (activos)
    const devices = await this.deviceRepository.findByUserId(userId);

    // Verificar si hay challenge pendiente
    let hasPendingChallenge = false;
    if (this.challengeRepository) {
      const challenge = await this.challengeRepository.findByUserId(userId);
      hasPendingChallenge = challenge !== null && Date.now() < challenge.expiresAt;
    }

    // Verificar dispositivos revocados (para inferir estado)
    const allDevices = await this.deviceRepository.findByUserIdIncludingInactive(userId);
    const hasRevokedDevice = allDevices.some((d: Device) => !d.isActive);
    const hasActiveDevice = devices.length > 0;

    // Inferir estado de enrollment usando state machine
    const enrollmentState = EnrollmentStateMachine.inferState({
      hasActiveDevice,
      hasRevokedDevice,
      hasPendingChallenge,
    });

    // Mapear a DeviceInfo (sin informacion sensible)
    const deviceInfos: DeviceInfo[] = devices.map((device: Device) => ({
      deviceId: device.deviceId,
      credentialId: device.credentialId,
      aaguid: device.aaguid,
      enrolledAt: device.enrolledAt,
      lastUsedAt: device.lastUsedAt,
      isActive: device.isActive,
      status: device.status,
    }));

    return {
      enrollmentState,
      isEnrolled: hasActiveDevice,
      deviceCount: devices.length,
      maxDevices: this.MAX_DEVICES,
      // Con politica 1:1, siempre puede enrolar (el nuevo revoca el anterior)
      canEnrollMore: true,
      devices: deviceInfos,
    };
  }
}
