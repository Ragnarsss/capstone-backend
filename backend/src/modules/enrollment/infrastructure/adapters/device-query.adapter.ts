import type { IDeviceQuery } from '../../../shared/ports';
import type { DeviceRepository } from '../repositories/device.repository';

/**
 * Adapter para DeviceQuery
 * Wrappea DeviceRepository para implementar IDeviceQuery
 * Responsabilidad: Proporcionar interfaz read-only para Access Gateway
 */
export class DeviceQueryAdapter implements IDeviceQuery {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async getActiveDevice(userId: number): Promise<{
    credentialId: string;
    deviceId: number;
  } | null> {
    const devices = await this.deviceRepository.findByUserId(userId);

    if (devices.length === 0) {
      return null;
    }

    // Retornar el dispositivo mas reciente (primero en el array)
    const device = devices[0];
    return {
      credentialId: device.credentialId,
      deviceId: device.deviceId,
    };
  }
}
