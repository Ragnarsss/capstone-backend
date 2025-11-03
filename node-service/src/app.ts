import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { config } from './shared/config';
import { ValkeyClient } from './shared/infrastructure/valkey/valkey-client';
import { WebSocketController } from './modules/qr-projection/presentation/websocket-controller';
import { EnrollmentController } from './modules/enrollment/presentation/enrollment-controller';

/**
 * Application Bootstrap
 * Responsabilidad: Composición de módulos y configuración de servidor
 */
export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Registrar plugin de WebSocket
  await fastify.register(fastifyWebSocket);

  // Registrar plugin de archivos estáticos para frontend
  const frontendPath = process.cwd() + '/src/frontend';
  console.log('[Server] Frontend path:', frontendPath);
  await fastify.register(fastifyStatic, {
    root: frontendPath,
    prefix: '/frontend/',
  });

  // Inicializar infraestructura compartida
  const valkeyClient = ValkeyClient.getInstance();
  await valkeyClient.ping();

  // Registrar módulos backend
  const wsController = new WebSocketController();
  await wsController.register(fastify);

  const enrollmentController = new EnrollmentController();
  await enrollmentController.register(fastify);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Página principal (servir index.html modular)
  fastify.get('/', async (request, reply) => {
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    return reply.sendFile('app/index.html');
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
