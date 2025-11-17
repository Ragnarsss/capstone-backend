import { FastifyInstance, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import { noCacheHeaders } from '../middleware';

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
    // Modo desarrollo: Proxy a Vite preservando el path completo
    // Apache: /asistencia/* -> Fastify :3000/*
    // Fastify: /* -> Vite :5173/* (conserva el path completo)
    // Vite tiene base: '/asistencia/' y transforma las rutas en el HTML
    fastify.log.info('[Frontend] Development mode: proxying to Vite dev server');
    fastify.log.info(`[Frontend] Vite URL: ${viteUrl}`);

    // Registrar proxy en la raíz para capturar todo
    await fastify.register(fastifyHttpProxy, {
      upstream: viteUrl,
      prefix: '/',
      http2: false,
      websocket: false,
    });
  } else {
    // Modo producción: Servir archivos estáticos compilados
    fastify.log.info('[Frontend] Production mode: serving static files');
    fastify.log.info(`[Frontend] Static path: ${staticPath}`);

    // Servir assets con prefijo /asistencia/ para que coincida con base de Vite
    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/asistencia/',
      decorateReply: false,
    });

    // También servir en raíz para compatibilidad
    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
    });

    // Rutas compatibles con proxy Apache que preserva el prefijo /asistencia/
    // Sirven los mismos archivos estáticos en ambas rutas para evitar 404
    fastify.get('/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-host/index.html');
    });

    fastify.get('/asistencia', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-host/index.html');
    });

    fastify.get('/asistencia/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-host/index.html');
    });

    // Ruta lector QR: QR Reader (compatibilidad con y sin prefijo)
    fastify.get('/lector', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-reader/index.html');
    });

    fastify.get('/asistencia/lector', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-reader/index.html');
    });

    fastify.get('/asistencia/lector/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('features/qr-reader/index.html');
    });
  }

  fastify.log.info('[Frontend] Plugin registered successfully');
}
