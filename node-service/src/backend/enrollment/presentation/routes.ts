import type { FastifyInstance } from 'fastify';
import { StartEnrollmentController, FinishEnrollmentController, EnrollmentStatusController, LoginEcdhController, RevokeDeviceController } from './controllers';
import { StartEnrollmentUseCase, FinishEnrollmentUseCase, GetEnrollmentStatusUseCase, LoginEcdhUseCase, RevokeDeviceUseCase } from '../application/use-cases';
import { Fido2Service, DeviceRepository, EnrollmentChallengeRepository, HkdfService, SessionKeyRepository, EcdhService } from '../infrastructure';
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
  const sessionKeyRepository = new SessionKeyRepository();
  const hkdfService = new HkdfService();
  const ecdhService = new EcdhService();

  // Instanciar use cases
  const startEnrollmentUseCase = new StartEnrollmentUseCase(
    fido2Service,
    deviceRepository,
    challengeRepository
  );

  const finishEnrollmentUseCase = new FinishEnrollmentUseCase(
    fido2Service,
    deviceRepository,
    challengeRepository,
    hkdfService
  );

  const getEnrollmentStatusUseCase = new GetEnrollmentStatusUseCase(deviceRepository);

  const loginEcdhUseCase = new LoginEcdhUseCase(
    deviceRepository,
    sessionKeyRepository,
    ecdhService,
    hkdfService,
    fido2Service
  );

  const revokeDeviceUseCase = new RevokeDeviceUseCase(deviceRepository);

  // Instanciar controllers
  const startEnrollmentController = new StartEnrollmentController(startEnrollmentUseCase);
  const finishEnrollmentController = new FinishEnrollmentController(finishEnrollmentUseCase);
  const enrollmentStatusController = new EnrollmentStatusController(getEnrollmentStatusUseCase);
  const loginEcdhController = new LoginEcdhController(loginEcdhUseCase);
  const revokeDeviceController = new RevokeDeviceController(revokeDeviceUseCase);

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

  // Rate limiter para login (más permisivo)
  const loginRateLimit = createEndpointRateLimiter({
    max: 10, // 10 intentos por minuto
    windowSeconds: 60,
    keyGenerator: userIdKeyGenerator,
    message: 'Too many login attempts, please try again later',
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

    // POST /api/enrollment/finish
    enrollmentRoutes.post('/api/enrollment/finish', {
      preHandler: [jsonOnly, enrollmentRateLimit],
      handler: finishEnrollmentController.handle.bind(finishEnrollmentController),
    });

    // GET /api/enrollment/status
    enrollmentRoutes.get('/api/enrollment/status', {
      handler: enrollmentStatusController.handle.bind(enrollmentStatusController),
    });

    // POST /api/enrollment/login - ECDH key exchange
    enrollmentRoutes.post('/api/enrollment/login', {
      preHandler: [jsonOnly, loginRateLimit],
      handler: loginEcdhController.handle.bind(loginEcdhController),
    });

    // DELETE /api/enrollment/devices/:deviceId - Revocar dispositivo
    enrollmentRoutes.delete('/api/enrollment/devices/:deviceId', {
      handler: revokeDeviceController.handle.bind(revokeDeviceController),
    });
  });
}
