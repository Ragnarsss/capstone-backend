import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EnrollmentService } from '../application/enrollment.service';
import { AuthMiddleware } from '../../auth/presentation/auth-middleware';
import type {
  StartEnrollmentRequestDTO,
  StartEnrollmentResponseDTO,
  FinishEnrollmentRequestDTO,
  FinishEnrollmentResponseDTO,
  LoginECDHRequestDTO,
  LoginECDHResponseDTO,
  EnrollmentStatusResponseDTO,
} from './types';

/**
 * Controller para Enrollment endpoints
 * Responsabilidad: Manejo de HTTP requests para enrollment FIDO2
 */
export class EnrollmentController {
  private service: EnrollmentService;
  private authMiddleware: AuthMiddleware;

  constructor(enrollmentService: EnrollmentService, authMiddleware: AuthMiddleware) {
    this.service = enrollmentService;
    this.authMiddleware = authMiddleware;
  }

  async register(fastify: FastifyInstance): Promise<void> {
    await fastify.register(async (enrollmentRoutes) => {
      enrollmentRoutes.addHook('preHandler', this.authMiddleware.authenticate());

      enrollmentRoutes.post('/api/enrollment/start', this.startEnrollment.bind(this));
      enrollmentRoutes.post('/api/enrollment/finish', this.finishEnrollment.bind(this));
      enrollmentRoutes.post('/api/enrollment/login', this.loginECDH.bind(this));
      enrollmentRoutes.get('/api/enrollment/status', this.checkEnrollmentStatus.bind(this));
    });
  }

  private async startEnrollment(
    request: FastifyRequest<{ Body: StartEnrollmentRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user!;
      const { displayName } = request.body || {};

      const result = await this.service.createEnrollmentChallenge(
        user.userId.toNumber(),
        user.username,
        displayName || user.nombreCompleto
      );

      const response: StartEnrollmentResponseDTO = {
        success: true,
        challenge: result.challenge,
        options: result.options,
      };

      reply.send(response);
    } catch (error) {
      request.log.error({ error }, 'Error en startEnrollment');
      const response: StartEnrollmentResponseDTO = {
        success: false,
        error: 'SERVICE_ERROR',
        message: 'Error al iniciar enrolamiento',
      };
      reply.status(500).send(response);
    }
  }

  private async finishEnrollment(
    request: FastifyRequest<{ Body: FinishEnrollmentRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user!;
      const { credential } = request.body;

      const result = await this.service.verifyAndCompleteEnrollment(user.userId.toNumber(), credential);

      const response: FinishEnrollmentResponseDTO = {
        success: true,
        deviceId: result.deviceId,
        aaguid: result.aaguid,
        message: 'Dispositivo enrolado exitosamente',
      };

      reply.send(response);
    } catch (error) {
      request.log.error({ error }, 'Error en finishEnrollment');
      const response: FinishEnrollmentResponseDTO = {
        success: false,
        error: 'SERVICE_ERROR',
        message: 'Error al finalizar enrolamiento',
      };
      reply.status(500).send(response);
    }
  }

  private async loginECDH(
    request: FastifyRequest<{ Body: LoginECDHRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user!;
      const { publicKey, assertion } = request.body;

      const result = await this.service.performECDHLogin(user.userId.toNumber(), publicKey, assertion);

      const response: LoginECDHResponseDTO = {
        success: true,
        serverPublicKey: result.serverPublicKey,
        TOTPu: result.TOTPu,
      };

      reply.send(response);
    } catch (error) {
      request.log.error({ error }, 'Error en loginECDH');
      const response: LoginECDHResponseDTO = {
        success: false,
        error: 'SERVICE_ERROR',
        message: 'Error en login ECDH',
      };
      reply.status(500).send(response);
    }
  }

  private async checkEnrollmentStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const user = request.user!;

      const result = await this.service.checkEnrollmentStatus(user.userId.toNumber());

      const response: EnrollmentStatusResponseDTO = {
        success: true,
        enrolled: result.enrolled,
        deviceCount: result.deviceCount,
        message: 'Usuario no enrolado (stub)',
      };

      reply.send(response);
    } catch (error) {
      request.log.error({ error }, 'Error en checkEnrollmentStatus');
      const response: EnrollmentStatusResponseDTO = {
        success: false,
        error: 'SERVICE_ERROR',
        message: 'Error al verificar estado de enrolamiento',
      };
      reply.status(500).send(response);
    }
  }
}
