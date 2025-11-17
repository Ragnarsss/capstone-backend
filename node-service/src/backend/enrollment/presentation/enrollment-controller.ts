import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EnrollmentService } from '../application/enrollment.service';
import { AuthMiddleware } from '../../auth/presentation/auth-middleware';
import {
  createEndpointRateLimiter,
  userIdKeyGenerator,
  InternalServerError,
  validateRequest,
  jsonOnly,
} from '../../../middleware';
import {
  startEnrollmentSchema,
  finishEnrollmentSchema,
  loginECDHSchema,
} from './validation-schemas';
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
    // Rate limiters específicos para enrollment (más restrictivos)
    const enrollmentRateLimit = createEndpointRateLimiter({
      max: 5, // 5 intentos por minuto
      windowSeconds: 60,
      keyGenerator: userIdKeyGenerator,
      message: 'Too many enrollment attempts, please try again later',
    });

    const loginRateLimit = createEndpointRateLimiter({
      max: 10, // 10 intentos de login por minuto
      windowSeconds: 60,
      keyGenerator: userIdKeyGenerator,
      message: 'Too many login attempts, please try again later',
    });

    await fastify.register(async (enrollmentRoutes) => {
      enrollmentRoutes.addHook('preHandler', this.authMiddleware.authenticate());

      // Aplicar Content-Type, rate limiting y validación específica a cada endpoint
      enrollmentRoutes.post('/api/enrollment/start', {
        preHandler: [
          jsonOnly,
          enrollmentRateLimit,
          validateRequest({ body: startEnrollmentSchema }),
        ],
        handler: this.startEnrollment.bind(this),
      });

      enrollmentRoutes.post('/api/enrollment/finish', {
        preHandler: [
          jsonOnly,
          enrollmentRateLimit,
          validateRequest({ body: finishEnrollmentSchema }),
        ],
        handler: this.finishEnrollment.bind(this),
      });

      enrollmentRoutes.post('/api/enrollment/login', {
        preHandler: [
          jsonOnly,
          loginRateLimit,
          validateRequest({ body: loginECDHSchema }),
        ],
        handler: this.loginECDH.bind(this),
      });

      enrollmentRoutes.get('/api/enrollment/status', this.checkEnrollmentStatus.bind(this));
    });
  }

  private async startEnrollment(
    request: FastifyRequest<{ Body: StartEnrollmentRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
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
  }

  private async finishEnrollment(
    request: FastifyRequest<{ Body: FinishEnrollmentRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
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
  }

  private async loginECDH(
    request: FastifyRequest<{ Body: LoginECDHRequestDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.user!;
    const { publicKey, assertion } = request.body;

    const result = await this.service.performECDHLogin(user.userId.toNumber(), publicKey, assertion);

    const response: LoginECDHResponseDTO = {
      success: true,
      serverPublicKey: result.serverPublicKey,
      TOTPu: result.TOTPu,
    };

    reply.send(response);
  }

  private async checkEnrollmentStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.user!;

    const result = await this.service.checkEnrollmentStatus(user.userId.toNumber());

    const response: EnrollmentStatusResponseDTO = {
      success: true,
      enrolled: result.enrolled,
      deviceCount: result.deviceCount,
      message: 'Usuario no enrolado (stub)',
    };

    reply.send(response);
  }
}
