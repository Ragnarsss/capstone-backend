import type { FastifyInstance } from 'fastify';
import { LoginEcdhController } from './controllers/login-ecdh.controller';
import { LoginEcdhUseCase } from '../application/use-cases/login-ecdh.use-case';
import { SessionKeyRepository } from '../infrastructure/repositories/session-key.repository';
import { DeviceRepository } from '../../enrollment/infrastructure/repositories/device.repository';
import { EcdhService, HkdfService } from '../../enrollment/infrastructure/crypto';
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
 * Registra las rutas de session
 */
export async function registerSessionRoutes(fastify: FastifyInstance): Promise<void> {
  // Instanciar repositorios y servicios
  const sessionKeyRepository = new SessionKeyRepository();
  const deviceRepository = new DeviceRepository();
  const ecdhService = new EcdhService();
  const hkdfService = new HkdfService();

  // Instanciar use case
  const loginEcdhUseCase = new LoginEcdhUseCase(
    deviceRepository,
    sessionKeyRepository,
    ecdhService,
    hkdfService
  );

  // Middleware de autenticación
  const jwtUtils = new JWTUtils({
    secret: config.jwt.secret,
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
  const authService = new AuthService(jwtUtils);
  const authMiddleware = new AuthMiddleware(authService);

  // Rate limiter para login
  const loginRateLimit = createEndpointRateLimiter({
    max: 10,
    windowSeconds: 60,
    keyGenerator: userIdKeyGenerator,
    message: 'Too many login attempts, please try again later',
  });

  // Registrar rutas
  await fastify.register(async (sessionRoutes) => {
    // Aplicar autenticación
    sessionRoutes.addHook('preHandler', authMiddleware.authenticate());

    // POST /asistencia/api/session/login - ECDH key exchange
    sessionRoutes.post('/asistencia/api/session/login', {
      preHandler: [jsonOnly, loginRateLimit],
      handler: async (request, reply) => {
        try {
          const body = request.body as {
            credentialId: string;
            clientPublicKey: string;
          };

          const user = request.user;
          if (!user) {
            return reply.code(401).send({ error: 'Unauthorized' });
          }
          const userId = user.userId.toNumber();

          const result = await loginEcdhUseCase.execute({
            userId,
            credentialId: body.credentialId,
            clientPublicKey: body.clientPublicKey,
          });

          return reply.send(result);
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.startsWith('DEVICE_NOT_FOUND')) {
              return reply.code(404).send({ error: error.message });
            }
            if (error.message.startsWith('DEVICE_NOT_OWNED')) {
              return reply.code(403).send({ error: error.message });
            }
            if (error.message.startsWith('SESSION_NOT_ALLOWED')) {
              return reply.code(400).send({ error: error.message });
            }
          }
          throw error;
        }
      },
    });
  });
}
