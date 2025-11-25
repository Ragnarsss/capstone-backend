import type { FastifyRequest, FastifyReply } from 'fastify';
import { GetEnrollmentStatusUseCase } from '../../application/use-cases';

/**
 * Controller para GET /api/enrollment/status
 * Responsabilidad: Obtener estado de enrollment del usuario
 */
export class EnrollmentStatusController {
  constructor(private readonly useCase: GetEnrollmentStatusUseCase) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Extraer usuario del JWT
      const user = request.user;
      if (!user) {
        reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // Ejecutar use case
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
