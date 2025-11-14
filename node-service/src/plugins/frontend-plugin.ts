import { FastifyInstance, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';

/**
 * Frontend Plugin
 * Responsabilidad: Servir frontend según entorno (desarrollo o producción)
 *
 * Desarrollo: Proxy a Vite dev server para HMR y transpilación TypeScript
 * Producción: Servir archivos estáticos compilados por Vite
 */

interface FrontendPluginOptions {
  isDevelopment: boolean;
  viteUrl?: string;
  vitePath?: string;
  staticPath?: string;
}

export async function frontendPlugin(
  fastify: FastifyInstance,
  options: FrontendPluginOptions
): Promise<void> {
  const {
    isDevelopment,
    viteUrl = 'http://localhost:5173',
    vitePath = '/asistencia/',
    staticPath = process.cwd() + '/dist/frontend'
  } = options;

  if (isDevelopment) {
    // Modo desarrollo: Proxy a Vite dev server
    fastify.log.info('[Frontend] Development mode: proxying to Vite dev server');
    fastify.log.info(`[Frontend] Vite URL: ${viteUrl}${vitePath}`);

    await fastify.register(fastifyHttpProxy, {
      upstream: viteUrl,
      prefix: '/',
      rewritePrefix: vitePath,
      http2: false,
      websocket: false, // WebSocket manejado por módulo backend
    });
  } else {
    // Modo producción: Servir archivos estáticos compilados
    fastify.log.info('[Frontend] Production mode: serving static files');
    fastify.log.info(`[Frontend] Static path: ${staticPath}`);

    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
    });

    const sendNoCache = (reply: FastifyReply) => {
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');
    };

    // Ruta raíz
    fastify.get('/', async (_request, reply) => {
      sendNoCache(reply);
      return reply.sendFile('index.html');
    });

    // Ruta lector QR
    fastify.get('/lector', async (_request, reply) => {
      sendNoCache(reply);
      return reply.sendFile('lector/index.html');
    });

    fastify.get('/lector/', async (_request, reply) => {
      sendNoCache(reply);
      return reply.sendFile('lector/index.html');
    });
  }

  fastify.log.info('[Frontend] Plugin registered successfully');
}
