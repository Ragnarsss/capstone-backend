import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { config } from './shared/config';
import { ValkeyClient } from './shared/infrastructure/valkey/valkey-client';
import { WebSocketController } from './modules/qr-projection/presentation/websocket-controller';
import { EnrollmentController } from './modules/enrollment/presentation/enrollment-controller';
import { frontendPlugin } from './plugins/frontend-plugin';

/**
 * Application Bootstrap
 * Responsabilidad: Composición de módulos backend y registro de plugins
 *
 * Separación de Concerns:
 * - Infraestructura compartida (Valkey, logging, WebSocket)
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
  // 2. MÓDULOS BACKEND (rutas específicas)
  // ========================================
  const wsController = new WebSocketController();
  await wsController.register(fastify);

  const enrollmentController = new EnrollmentController();
  await enrollmentController.register(fastify);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // ========================================
  // 3. FRONTEND PLUGIN (catch-all, registrar último)
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
