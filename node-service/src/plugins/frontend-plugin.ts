import { FastifyInstance, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import { noCacheHeaders } from '../middleware';

/**
 * Frontend Plugin
 * Responsabilidad: Servir frontend segun entorno (desarrollo o produccion)
 *
 * Rutas unificadas:
 *   /asistencia/host/   -> Proyector QR (profesor)
 *   /asistencia/reader/ -> Lector QR (alumno)
 *   /asistencia/ws      -> WebSocket
 *
 * Desarrollo: Proxy a Vite dev server
 * Produccion: Archivos estaticos compilados
 * 
 * IMPORTANTE: Las rutas /asistencia/api/* y /asistencia/ws se registran
 * ANTES de este plugin en app.ts, por lo que tienen prioridad sobre el proxy.
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
    // Desarrollo: Rutas especificas + Proxy a Vite para HMR
    fastify.log.info('[Frontend] Development mode: proxying to Vite');
    fastify.log.info(`[Frontend] Vite URL: ${viteUrl}`);

    // Rutas especificas redirigen a los HTMLs de cada feature
    fastify.get('/asistencia/host', async (_request, reply) => {
      return reply.redirect('/asistencia/features/qr-host/index.html');
    });

    fastify.get('/asistencia/host/', async (_request, reply) => {
      return reply.redirect('/asistencia/features/qr-host/index.html');
    });

    fastify.get('/asistencia/reader', async (_request, reply) => {
      return reply.redirect('/asistencia/features/qr-reader/index.html');
    });

    fastify.get('/asistencia/reader/', async (_request, reply) => {
      return reply.redirect('/asistencia/features/qr-reader/index.html');
    });

    // Proxy general a Vite para assets, HMR, etc.
    // Las rutas de API (/asistencia/api/*) y WebSocket (/asistencia/ws)
    // se registran ANTES de este plugin en app.ts y tienen prioridad.
    await fastify.register(fastifyHttpProxy, {
      upstream: viteUrl,
      prefix: '/',
      http2: false,
      websocket: false, // WebSocket manejado por WebSocketController
    });
  } else {
    // Produccion: Servir archivos estaticos
    fastify.log.info('[Frontend] Production mode: static files');
    fastify.log.info(`[Frontend] Path: ${staticPath}`);

    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/asistencia/',
      decorateReply: false,
    });

    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
    });

    // Host: Proyector QR (profesor)
    fastify.get('/asistencia/host', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-host/index.html');
    });

    fastify.get('/asistencia/host/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-host/index.html');
    });

    // Reader: Lector QR (alumno)
    fastify.get('/asistencia/reader', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-reader/index.html');
    });

    fastify.get('/asistencia/reader/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-reader/index.html');
    });

    // Compatibilidad: ruta raiz redirige a host
    fastify.get('/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-host/index.html');
    });

    fastify.get('/asistencia', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.redirect('/asistencia/host/');
    });

    fastify.get('/asistencia/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.redirect('/asistencia/host/');
    });
  }

  fastify.log.info('[Frontend] Plugin registered');
}
