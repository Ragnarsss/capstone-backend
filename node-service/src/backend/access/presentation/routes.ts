import type { FastifyInstance } from 'fastify';
import { AccessStateController } from './controllers';
import { AccessGatewayService } from '../application/services';
import { DeviceQueryAdapter, SessionQueryAdapter, RestrictionQueryAdapter } from '../../enrollment/infrastructure/adapters';
import { DeviceRepository, SessionKeyRepository } from '../../enrollment/infrastructure';
import { RestrictionService } from '../../enrollment/domain/services/restriction.service';
import { AuthMiddleware } from '../../auth/presentation/auth-middleware';
import { AuthService } from '../../auth/application/auth.service';
import { JWTUtils } from '../../auth/domain/jwt-utils';
import { config } from '../../../shared/config';

/**
 * Registra las rutas de access
 */
export async function registerAccessRoutes(fastify: FastifyInstance): Promise<void> {
  // Instanciar repositorios y servicios de otros dominios
  const deviceRepository = new DeviceRepository();
  const sessionKeyRepository = new SessionKeyRepository();
  const restrictionService = new RestrictionService();

  // Crear adapters para lectura cross-domain
  const deviceQuery = new DeviceQueryAdapter(deviceRepository);
  const sessionQuery = new SessionQueryAdapter(sessionKeyRepository);
  const restrictionQuery = new RestrictionQueryAdapter(restrictionService);

  // Instanciar AccessGatewayService
  const accessGatewayService = new AccessGatewayService(
    deviceQuery,
    sessionQuery,
    restrictionQuery
  );

  // Instanciar controller
  const accessStateController = new AccessStateController(accessGatewayService);

  // Middleware de autenticación
  const jwtUtils = new JWTUtils({
    secret: config.jwt.secret,
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
  const authService = new AuthService(jwtUtils);
  const authMiddleware = new AuthMiddleware(authService);

  // Registrar rutas
  await fastify.register(async (accessRoutes) => {
    // Aplicar autenticación a todas las rutas de access
    accessRoutes.addHook('preHandler', authMiddleware.authenticate());

    // GET /api/access/state
    accessRoutes.get('/api/access/state', {
      handler: accessStateController.handle.bind(accessStateController),
    });
  });
}
