import type { FastifyInstance } from 'fastify';
import { createJWTAuthMiddleware } from '../../middleware';
import { config } from '../../shared/config';
import { JWTUtils } from '../auth/domain/jwt-utils';
import { logger } from '../../shared/infrastructure/logger';

/**
 * Rutas de ejemplo protegidas con JWT
 * 
 * Propósito: Demostrar integración JWT Bridge → Node.js Backend
 * 
 * Endpoints:
 * - GET /api/health - Health check (protegido con JWT)
 * - GET /api/profile - Obtener perfil del usuario autenticado
 * - GET /api/courses - Listar cursos del usuario (ejemplo)
 */
export async function registerProtectedRoutes(fastify: FastifyInstance) {
    // Crear instancia de JWTUtils con configuración compartida
    const jwtUtils = new JWTUtils(config.jwt);
    const jwtAuthMiddleware = createJWTAuthMiddleware(jwtUtils);

    /**
     * Health check protegido
     * Verifica que JWT esté correctamente validado
     */
    fastify.get(
        '/api/health',
        {
            preHandler: jwtAuthMiddleware,
        },
        async (request, reply) => {
            logger.info('[Protected] Health check accessed', {
                user: request.user,
            });

            return reply.send({
                success: true,
                message: 'Backend authenticated',
                user: {
                    userId: request.user!.userId,
                    username: request.user!.username,
                    rol: request.user!.rol,
                },
                timestamp: new Date().toISOString(),
            });
        }
    );

    /**
     * Obtener perfil del usuario autenticado
     */
    fastify.get(
        '/api/profile',
        {
            preHandler: jwtAuthMiddleware,
        },
        async (request, reply) => {
            const user = request.user!;

            logger.info('[Protected] Profile accessed', {
                userId: user.userId,
                username: user.username,
            });

            return reply.send({
                success: true,
                profile: {
                    userId: user.userId,
                    username: user.username,
                    rol: user.rol,
                    // En producción, aquí se consultaría la BD para datos adicionales
                    displayName: user.rol === 'profesor' ? user.username : `Estudiante ${user.userId}`,
                    permissions: user.rol === 'profesor' ? ['marcar_asistencia', 'ver_reportes'] : ['ver_asistencia'],
                },
            });
        }
    );

    /**
     * Listar cursos del usuario (ejemplo stub)
     */
    fastify.get(
        '/api/courses',
        {
            preHandler: jwtAuthMiddleware,
        },
        async (request, reply) => {
            const user = request.user!;

            logger.info('[Protected] Courses accessed', {
                userId: user.userId,
                rol: user.rol,
            });

            // Stub: En producción, consultar BD con userId
            const courses = user.rol === 'profesor'
                ? [
                    { id: 429, name: 'Ingeniería de Software', code: 'INF-3240' },
                    { id: 430, name: 'Base de Datos II', code: 'INF-3250' },
                ]
                : [
                    { id: 429, name: 'Ingeniería de Software', code: 'INF-3240', enrolled: true },
                ];

            return reply.send({
                success: true,
                courses,
            });
        }
    );

    logger.info('[ProtectedRoutes] Registered: /api/health, /api/profile, /api/courses');
}
