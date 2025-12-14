import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { config } from './shared/config';
import { ValkeyClient } from './shared/infrastructure/valkey/valkey-client';
import { PostgresPool } from './shared/infrastructure/database';
import { logger } from './shared/infrastructure/logger';
import {
  securityHeadersMiddleware,
  corsMiddleware,
  requestLoggerMiddleware,
  WebSocketAuthMiddleware,
  rateLimitMiddleware,
  errorHandlerMiddleware,
} from './middleware';
import { WebSocketController } from './backend/qr-projection/presentation/websocket-controller';
import { registerEnrollmentRoutes } from './backend/enrollment/presentation/routes';
import { registerSessionModule } from './backend/session/session.module';
import { registerAccessRoutes } from './backend/access/presentation/routes';
import { registerAttendanceRoutes } from './backend/attendance/presentation/routes';
import { frontendPlugin } from './plugins/frontend-plugin';
import { JWTUtils } from './backend/auth/domain/jwt-utils';
import { QRProjectionService } from './backend/qr-projection/application/qr-projection.service';

/**
 * Application Bootstrap
 * Responsabilidad: Composición de módulos backend y registro de plugins
 *
 * Separación de Concerns:
 * - Infraestructura compartida (Valkey, logging, WebSocket)
 * - Middlewares globales (seguridad, CORS, logging, WebSocket auth)
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

  const postgresPool = PostgresPool.getInstance();
  const isPostgresHealthy = await postgresPool.ping();
  if (!isPostgresHealthy) {
    logger.error('[PostgreSQL] No se pudo conectar a la base de datos');
    throw new Error('PostgreSQL connection failed');
  }
  logger.info('[PostgreSQL] Conectado exitosamente');

  // ========================================
  // 2. MIDDLEWARES GLOBALES
  // ========================================
  // Error handler debe registrarse primero
  errorHandlerMiddleware(fastify);
  
  securityHeadersMiddleware(fastify);
  corsMiddleware(fastify, { isDevelopment: config.env.isDevelopment });
  requestLoggerMiddleware(fastify);

  // Rate limiting global: 100 requests por minuto por IP
  await rateLimitMiddleware(fastify, {
    max: 100,
    windowSeconds: 60,
    message: 'Too many requests from this IP, please try again later',
  });

  // ========================================
  // 3. DEPENDENCY INJECTION - Composition Root
  // ========================================
  // Crear instancias de servicios compartidos con configuración inyectada
  const jwtUtils = new JWTUtils(config.jwt);

  // QR Projection - ahora usa constructor simplificado
  // Los servicios internos (PoolBalancer, QREmitter) se crean con defaults
  const qrProjectionService = new QRProjectionService(config.qr);
  const wsAuthMiddleware = new WebSocketAuthMiddleware(jwtUtils, 5000);

  // ========================================
  // 4. MÓDULOS BACKEND (rutas específicas)
  // ========================================
  const wsController = new WebSocketController(qrProjectionService, wsAuthMiddleware);
  await wsController.register(fastify);

  // Enrollment module - registro de dispositivos FIDO2
  await registerEnrollmentRoutes(fastify);

  // Session module - ECDH key exchange y login
  await registerSessionModule(fastify);

  // Access module - estado agregado de acceso
  await registerAccessRoutes(fastify);

  // Attendance module - validación de payloads QR
  await registerAttendanceRoutes(fastify);

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
      logger.info(`[Server] Recibido ${signal}, cerrando...`);
      await valkeyClient.close();
      await postgresPool.close();
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
    logger.info(`[Server] Corriendo en http://${config.server.host}:${config.server.port}`);
  } catch (error) {
    logger.error('[Server] Error al iniciar:', error);
    process.exit(1);
  }
}
