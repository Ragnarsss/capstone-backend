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
    // Modo desarrollo: Rutas directas + Proxy a Vite para assets
    fastify.log.info('[Frontend] Development mode: serving HTML + proxying assets to Vite');
    fastify.log.info(`[Frontend] Vite URL: ${viteUrl}${vitePath}`);

    // Rutas HTML directas (302 redirect a URLs de Vite)
    fastify.get('/', async (_request, reply) => {
      return reply.redirect(302, `${viteUrl}${vitePath}features/qr-host/`);
    });

    fastify.get('/lector', async (_request, reply) => {
      return reply.redirect(302, `${viteUrl}${vitePath}features/qr-reader/`);
    });

    fastify.get('/lector/', async (_request, reply) => {
      return reply.redirect(302, `${viteUrl}${vitePath}features/qr-reader/`);
    });

    // Proxy solo para assets (js, css, etc)
    await fastify.register(fastifyHttpProxy, {
      upstream: viteUrl,
      prefix: '/',
      rewritePrefix: vitePath,
      http2: false,
      websocket: false,
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

    // Ruta raiz: QR Host
    fastify.get('/', async (_request, reply) => {
      sendNoCache(reply);
      return reply.sendFile('qr-host/index.html');
    });

    // Ruta lector QR: QR Reader
    fastify.get('/lector', async (_request, reply) => {
      sendNoCache(reply);
      return reply.sendFile('qr-reader/index.html');
    });

    fastify.get('/lector/', async (_request, reply) => {
      sendNoCache(reply);
      return reply.sendFile('qr-reader/index.html');
    });
  }

  fastify.log.info('[Frontend] Plugin registered successfully');
}
