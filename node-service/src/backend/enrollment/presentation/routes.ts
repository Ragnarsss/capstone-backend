import type { FastifyInstance } from 'fastify';
import { StartEnrollmentController } from './controllers';
import { StartEnrollmentUseCase } from '../application/use-cases';
import { Fido2Service, DeviceRepository, EnrollmentChallengeRepository } from '../infrastructure';
import { AuthMiddleware } from '../../auth/presentation/auth-middleware';
import { AuthService } from '../../auth/application/auth.service';
import { JWTUtils } from '../../auth/domain/jwt-utils';
import { config } from '../../../shared/config';
import { 
  createEndpointRateLimiter, 
  userIdKeyGenerator,
  jsonOnly,
} from '../../../middleware';

/**
 * Registra las rutas de enrollment
 */
export async function registerEnrollmentRoutes(fastify: FastifyInstance): Promise<void> {
  // Instanciar servicios y repositorios
  const fido2Service = new Fido2Service();
  const deviceRepository = new DeviceRepository();
  const challengeRepository = new EnrollmentChallengeRepository();

  // Instanciar use cases
  const startEnrollmentUseCase = new StartEnrollmentUseCase(
    fido2Service,
    deviceRepository,
    challengeRepository
  );

  // Instanciar controllers
  const startEnrollmentController = new StartEnrollmentController(startEnrollmentUseCase);

  // Middleware de autenticación
  const jwtUtils = new JWTUtils({
    secret: config.jwt.secret,
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
  const authService = new AuthService(jwtUtils);
  const authMiddleware = new AuthMiddleware(authService);

  // Rate limiter para enrollment (más restrictivo)
  const enrollmentRateLimit = createEndpointRateLimiter({
    max: 5, // 5 intentos por minuto
    windowSeconds: 60,
    keyGenerator: userIdKeyGenerator,
    message: 'Too many enrollment attempts, please try again later',
  });

  // Registrar rutas
  await fastify.register(async (enrollmentRoutes) => {
    // Aplicar autenticación a todas las rutas de enrollment
    enrollmentRoutes.addHook('preHandler', authMiddleware.authenticate());

    // POST /api/enrollment/start
    enrollmentRoutes.post('/api/enrollment/start', {
      preHandler: [jsonOnly, enrollmentRateLimit],
      handler: startEnrollmentController.handle.bind(startEnrollmentController),
    });

    // TODO: Agregar más rutas en las siguientes fases
    // - POST /api/enrollment/finish
    // - POST /api/enrollment/login
    // - GET /api/enrollment/status
  });
}
