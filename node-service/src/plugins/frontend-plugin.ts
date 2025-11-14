import { FastifyInstance, FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import { noCacheHeaders } from '../shared/middleware';

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

    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
    });

    // Ruta raiz: QR Host
    fastify.get('/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('qr-host/index.html');
    });

    // Ruta lector QR: QR Reader
    fastify.get('/lector', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('qr-reader/index.html');
    });

    fastify.get('/lector/', async (_request, reply) => {
      noCacheHeaders(reply);
      return reply.sendFile('qr-reader/index.html');
    });
  }

  fastify.log.info('[Frontend] Plugin registered successfully');
}
