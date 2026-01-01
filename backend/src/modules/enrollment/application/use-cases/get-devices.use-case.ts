import { DeviceRepository } from '../../infrastructure';
import type { Device } from '../../domain/entities';

/**
 * Input DTO para Get Devices
 */
export interface GetDevicesInput {
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
}

/**
 * Output DTO para Get Devices
 */
export interface GetDevicesOutput {
  deviceCount: number;
  devices: DeviceInfo[];
}

/**
 * Use Case: Obtener lista de dispositivos de un usuario
 * 
 * Retorna solo dispositivos activos con metadata basica.
 * Reemplaza la funcionalidad de listado de GetEnrollmentStatusUseCase.
 */
export class GetDevicesUseCase {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async execute(input: GetDevicesInput): Promise<GetDevicesOutput> {
    const { userId } = input;

    const devices = await this.deviceRepository.findByUserId(userId);

    const deviceInfos: DeviceInfo[] = devices.map((device: Device) => ({
      deviceId: device.deviceId,
      credentialId: device.credentialId,
      aaguid: device.aaguid,
      enrolledAt: device.enrolledAt,
      lastUsedAt: device.lastUsedAt,
    }));

    return {
      deviceCount: devices.length,
      devices: deviceInfos,
    };
  }
}
