import type { FastifyInstance } from 'fastify';
import { AccessStateController } from './controllers';
import { AccessGatewayService } from '../application/services';
import { EnrollmentFlowOrchestrator } from '../../enrollment/application/orchestrators';
import { DeviceRepository } from '../../enrollment/infrastructure';
import { OneToOnePolicyService } from '../../enrollment/domain/services';
import { SessionQueryAdapter } from '../../session/infrastructure/adapters';
import { SessionKeyRepository } from '../../session/infrastructure/repositories';
import { RestrictionQueryAdapter } from '../../restriction/infrastructure/adapters';
import { RestrictionService } from '../../restriction/application/services/restriction.service';
import { AuthMiddleware } from '../../auth/presentation/auth-middleware';
import { AuthService } from '../../auth/application/auth.service';
import { JWTUtils } from '../../auth/domain/jwt-utils';
import { config } from '../../../shared/config';

/**
 * Registra las rutas de access
 *
 * Arquitectura delegada (segun spec-architecture.md):
 * - Access Gateway NO implementa logica de enrollment
 * - Delega a EnrollmentFlowOrchestrator (automata CheckEnrolado + EvaluarUnoAUno)
 * - Solo coordina restricciones, sesion y presentacion de estado
 */
export async function registerAccessRoutes(fastify: FastifyInstance): Promise<void> {
  // Repositorios e inyecciones del dominio Enrollment
  const deviceRepository = new DeviceRepository();
  const policyService = new OneToOnePolicyService(deviceRepository);

  // Instanciar EnrollmentFlowOrchestrator (automata de enrollment)
  const enrollmentOrchestrator = new EnrollmentFlowOrchestrator(
    deviceRepository,
    policyService
  );

  // Sesion y Restriction
  const sessionKeyRepository = new SessionKeyRepository();
  const restrictionService = new RestrictionService();

  const sessionQuery = new SessionQueryAdapter(sessionKeyRepository);
  const restrictionQuery = new RestrictionQueryAdapter(restrictionService);

  // Instanciar AccessGatewayService (delegando enrollment al orchestrator)
  const accessGatewayService = new AccessGatewayService(
    enrollmentOrchestrator,
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

    // GET /asistencia/api/access/state?deviceFingerprint={fingerprint}
    accessRoutes.get('/asistencia/api/access/state', {
      handler: accessStateController.handle.bind(accessStateController),
    });
  });
}
