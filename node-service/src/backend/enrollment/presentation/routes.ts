import type { FastifyInstance } from 'fastify';
import { StartEnrollmentController, FinishEnrollmentController, RevokeDeviceController } from './controllers';
import { StartEnrollmentUseCase, FinishEnrollmentUseCase, GetDevicesUseCase, RevokeDeviceUseCase } from '../application/use-cases';
import { Fido2Service, DeviceRepository, EnrollmentChallengeRepository, HkdfService, PenaltyService } from '../infrastructure';
import { AuthMiddleware } from '../../auth/presentation/auth-middleware';
import { AuthService } from '../../auth/application/auth.service';
import { JWTUtils } from '../../auth/domain/jwt-utils';
import { config } from '../../../shared/config';
import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';
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
  const hkdfService = new HkdfService();
  
  // Servicio de penalizaciones (usa Valkey para contadores)
  const valkeyClient = ValkeyClient.getInstance();
  const penaltyService = new PenaltyService(valkeyClient);

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

  const getDevicesUseCase = new GetDevicesUseCase(deviceRepository);

  const revokeDeviceUseCase = new RevokeDeviceUseCase(deviceRepository);

  // Instanciar controllers
  const startEnrollmentController = new StartEnrollmentController(startEnrollmentUseCase);
  const finishEnrollmentController = new FinishEnrollmentController(finishEnrollmentUseCase);
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

  // Rate limiter para enrollment
  const enrollmentRateLimit = createEndpointRateLimiter({
    max: 100,
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

    // POST /api/enrollment/finish
    enrollmentRoutes.post('/api/enrollment/finish', {
      preHandler: [jsonOnly, enrollmentRateLimit],
      handler: finishEnrollmentController.handle.bind(finishEnrollmentController),
    });

    // GET /api/enrollment/devices - Listar dispositivos
    enrollmentRoutes.get('/api/enrollment/devices', {
      handler: async (request, reply) => {
        const userId = request.user?.userId;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const result = await getDevicesUseCase.execute({ userId: userId.toNumber() });
        return reply.code(200).send(result);
      },
    });

    // DELETE /api/enrollment/devices/:deviceId - Revocar dispositivo
    enrollmentRoutes.delete('/api/enrollment/devices/:deviceId', {
      handler: revokeDeviceController.handle.bind(revokeDeviceController),
    });

    // POST /api/enrollment/client-log - Recibir logs del frontend
    enrollmentRoutes.post('/api/enrollment/client-log', {
      preHandler: [jsonOnly],
      handler: async (request, reply) => {
        const body = request.body as { logs?: Array<{ level: string; message: string; data?: unknown; timestamp: string }> };
        const userId = (request as unknown as { userId?: number }).userId ?? 'unknown';
        const userAgent = request.headers['user-agent'] ?? 'unknown';
        
        console.log('\n========== CLIENT LOGS ==========');
        console.log(`User: ${userId} | UA: ${userAgent.substring(0, 50)}...`);
        
        if (body.logs && Array.isArray(body.logs)) {
          for (const log of body.logs) {
            const prefix = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : log.level === 'success' ? '✅' : 'ℹ️';
            console.log(`${prefix} [${log.timestamp}] ${log.message}`);
            if (log.data) {
              console.log('   Data:', JSON.stringify(log.data, null, 2));
            }
          }
        }
        console.log('=================================\n');
        
        return reply.send({ received: true });
      },
    });
  });
}
