import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { config } from './shared/config';
import { ValkeyClient } from './shared/infrastructure/valkey/valkey-client';
import {
  securityHeadersMiddleware,
  corsMiddleware,
  requestLoggerMiddleware,
} from './shared/middleware';
import { WebSocketController } from './backend/qr-projection/presentation/websocket-controller';
import { EnrollmentController } from './backend/enrollment/presentation/enrollment-controller';
import { EnrollmentService } from './backend/enrollment/application/enrollment.service';
import { EnrollmentChallengeRepository } from './backend/enrollment/infrastructure/enrollment-challenge.repository';
import { SessionKeyRepository } from './backend/enrollment/infrastructure/session-key.repository';
import { frontendPlugin } from './plugins/frontend-plugin';
import { JWTUtils } from './backend/auth/domain/jwt-utils';
import { AuthService } from './backend/auth/application/auth.service';
import { AuthMiddleware } from './backend/auth/presentation/auth-middleware';
import { QRProjectionService } from './backend/qr-projection/application/qr-projection.service';
import { WebSocketAuthGuard } from './backend/qr-projection/presentation/websocket-auth.guard';
import { QRMetadataRepository } from './backend/qr-projection/infrastructure/qr-metadata.repository';
import { ProjectionQueueRepository } from './backend/qr-projection/infrastructure/projection-queue.repository';

/**
 * Application Bootstrap
 * Responsabilidad: Composición de módulos backend y registro de plugins
 *
 * Separación de Concerns:
 * - Infraestructura compartida (Valkey, logging, WebSocket)
 * - Middlewares globales (seguridad, CORS, logging)
 * - Módulos de dominio backend (QR Projection, Enrollment)
 * - Plugin de frontend (desarrollo/producción) - registrado último
 */
export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // ========================================
  // 1. INFRAESTRUCTURA COMPARTIDA
  // ========================================
  await fastify.register(fastifyWebSocket);

  const valkeyClient = ValkeyClient.getInstance();
  await valkeyClient.ping();

  // ========================================
  // 2. MIDDLEWARES GLOBALES
  // ========================================
  securityHeadersMiddleware(fastify);
  corsMiddleware(fastify, { isDevelopment: config.env.isDevelopment });
  requestLoggerMiddleware(fastify);

  // ========================================
  // 3. DEPENDENCY INJECTION - Composition Root
  // ========================================
  // Crear instancias de servicios compartidos con configuración inyectada
  const jwtUtils = new JWTUtils(config.jwt);
  const authService = new AuthService(jwtUtils);
  const authMiddleware = new AuthMiddleware(authService);

  // QR Projection repositories
  const qrMetadataRepository = new QRMetadataRepository();
  const projectionQueueRepository = new ProjectionQueueRepository();

  const qrProjectionService = new QRProjectionService(
    config.qr,
    qrMetadataRepository,
    projectionQueueRepository
  );
  const wsAuthGuard = new WebSocketAuthGuard(jwtUtils, 5000);

  // ========================================
  // 4. MÓDULOS BACKEND (rutas específicas)
  // ========================================
  const wsController = new WebSocketController(qrProjectionService, wsAuthGuard);
  await wsController.register(fastify);

  // Enrollment repositories
  const enrollmentChallengeRepository = new EnrollmentChallengeRepository();
  const sessionKeyRepository = new SessionKeyRepository();

  const enrollmentService = new EnrollmentService(
    enrollmentChallengeRepository,
    sessionKeyRepository
  );

  const enrollmentController = new EnrollmentController(enrollmentService, authMiddleware);
  await enrollmentController.register(fastify);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // ========================================
  // 5. FRONTEND PLUGIN (catch-all, registrar último)
  // ========================================
  await fastify.register(frontendPlugin, {
    isDevelopment: config.env.isDevelopment,
    viteUrl: config.frontend.viteUrl,
    vitePath: config.frontend.vitePath,
    staticPath: config.frontend.staticPath,
  });

  // Shutdown graceful
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`[Server] Recibido ${signal}, cerrando...`);
      await valkeyClient.close();
      await fastify.close();
      process.exit(0);
    });
  });

  return fastify;
}

export async function startServer() {
  const fastify = await createApp();

  try {
    await fastify.listen({
      host: config.server.host,
      port: config.server.port,
    });
    console.log(`[Server] Corriendo en http://${config.server.host}:${config.server.port}`);
  } catch (error) {
    console.error('[Server] Error al iniciar:', error);
    process.exit(1);
  }
}
