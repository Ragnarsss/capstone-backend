import { DeviceRepository } from '../../infrastructure';
import type { Device } from '../../domain/entities';

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
  aaguid: string;
  enrolledAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
}

/**
 * Output DTO para Get Enrollment Status
 */
export interface GetEnrollmentStatusOutput {
  isEnrolled: boolean;
  deviceCount: number;
  maxDevices: number;
  canEnrollMore: boolean;
  devices: DeviceInfo[];
}

/**
 * Use Case: Obtener estado de enrollment de un usuario
 * 
 * Retorna:
 * - Si el usuario tiene dispositivos enrolados
 * - Cantidad de dispositivos
 * - Si puede enrolar más
 * - Lista de dispositivos con metadata básica
 */
export class GetEnrollmentStatusUseCase {
  private readonly MAX_DEVICES = 5;

  constructor(private readonly deviceRepository: DeviceRepository) {}

  async execute(input: GetEnrollmentStatusInput): Promise<GetEnrollmentStatusOutput> {
    const { userId } = input;

    // Obtener todos los dispositivos del usuario
    const devices = await this.deviceRepository.findByUserId(userId);

    // Mapear a DeviceInfo (sin información sensible)
    const deviceInfos: DeviceInfo[] = devices.map((device: Device) => ({
      deviceId: device.deviceId,
      aaguid: device.aaguid,
      enrolledAt: device.enrolledAt,
      lastUsedAt: device.lastUsedAt,
      isActive: device.isActive,
    }));

    return {
      isEnrolled: devices.length > 0,
      deviceCount: devices.length,
      maxDevices: this.MAX_DEVICES,
      canEnrollMore: devices.length < this.MAX_DEVICES,
      devices: deviceInfos,
    };
  }
}
