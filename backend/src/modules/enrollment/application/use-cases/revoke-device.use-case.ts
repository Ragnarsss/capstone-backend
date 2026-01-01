import { DeviceRepository } from '../../infrastructure';
import { DeviceStateMachine } from '../../domain/state-machines';

/**
 * Input DTO para Revoke Device
 */
export interface RevokeDeviceInput {
  userId: number;
  deviceId: number;
  reason?: string;
}

/**
 * Output DTO para Revoke Device
 */
export interface RevokeDeviceOutput {
  success: true;
  deviceId: number;
  message: string;
}

/**
 * Use Case: Revocar un dispositivo enrolado
 * 
 * Flujo:
 * 1. Verificar que el dispositivo existe
 * 2. Verificar que pertenece al usuario
 * 3. Validar transicion de estado (enrolled -> revoked)
 * 4. Revocar el dispositivo (soft delete)
 * 5. Registrar en enrollment_history
 */
export class RevokeDeviceUseCase {
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async execute(input: RevokeDeviceInput): Promise<RevokeDeviceOutput> {
    const { userId, deviceId, reason } = input;

    // 1. Buscar el dispositivo
    const device = await this.deviceRepository.findById(deviceId);
    if (!device) {
      throw new Error('DEVICE_NOT_FOUND: Dispositivo no encontrado');
    }

    // 2. Verificar que pertenece al usuario
    if (device.userId !== userId) {
      throw new Error('DEVICE_NOT_OWNED: No tienes permiso para revocar este dispositivo');
    }

    // 3. Validar transicion de estado (enrolled -> revoked)
    DeviceStateMachine.assertTransition(device.status, 'revoked');

    // 4. Revocar el dispositivo (el repository registra en enrollment_history)
    await this.deviceRepository.revoke(deviceId, reason || 'Revocado por el usuario');

    return {
      success: true,
      deviceId,
      message: 'Dispositivo revocado exitosamente',
    };
  }
}
