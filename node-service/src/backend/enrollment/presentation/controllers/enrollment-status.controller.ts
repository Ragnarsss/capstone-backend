import type { FastifyRequest, FastifyReply } from 'fastify';
import { GetEnrollmentStatusUseCase } from '../../application/use-cases';

/**
 * Controller para GET /api/enrollment/status
 * Responsabilidad: Obtener estado de enrollment del usuario
 * 
 * STUB MODE: Configurable via ENROLLMENT_STUB_MODE=true
 * Cuando está activo, siempre retorna isEnrolled: true para permitir
 * desarrollo del flujo de asistencia sin enrollment real.
 */
export class EnrollmentStatusController {
  private readonly stubMode: boolean;

  constructor(private readonly useCase: GetEnrollmentStatusUseCase) {
    this.stubMode = process.env.ENROLLMENT_STUB_MODE === 'true';
    if (this.stubMode) {
      console.log('[EnrollmentStatusController] ⚠️  STUB MODE ACTIVO - Enrollment siempre retorna enrolled');
    }
  }

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Extraer usuario del JWT
      const user = request.user;
      if (!user) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // STUB MODE: Retornar siempre enrolled para desarrollo
      if (this.stubMode) {
        console.log(`[EnrollmentStatusController] STUB: Usuario ${user.userId} → enrolled=true`);
        reply.code(200).send({
          success: true,
          enrollment: {
            isEnrolled: true,
            deviceCount: 1,
            maxDevices: 5,
            canEnrollMore: true,
            devices: [{
              deviceId: 0,
              aaguid: 'stub-device',
              enrolledAt: new Date().toISOString(),
              lastUsedAt: null,
              isActive: true,
            }],
          },
        });
        return;
      }

      // Modo normal: Ejecutar use case real
      const output = await this.useCase.execute({
        userId: user.userId.toNumber(),
      });

      // Retornar estado de enrollment
      reply.code(200).send({
        success: true,
        enrollment: {
          isEnrolled: output.isEnrolled,
          deviceCount: output.deviceCount,
          maxDevices: output.maxDevices,
          canEnrollMore: output.canEnrollMore,
          devices: output.devices.map((device) => ({
            deviceId: device.deviceId,
            aaguid: device.aaguid,
            enrolledAt: device.enrolledAt.toISOString(),
            lastUsedAt: device.lastUsedAt?.toISOString() || null,
            isActive: device.isActive,
          })),
        },
      });
    } catch (error) {
      console.error('[EnrollmentStatusController] Error:', error);
      reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error al obtener estado de enrollment',
      });
    }
  }
}
