/**
 * Validation Middleware
 * 
 * Middleware para validación de schemas usando Zod.
 * Valida request body, params, query y headers.
 * 
 * Nota: Zod se instalará como dependencia en package.json
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ValidationError } from './errors/index.js';

// Type-only imports para evitar errores si Zod no está instalado
type ZodSchema = any;
type ZodError = any;

/**
 * Opciones de validación
 */
interface ValidationOptions {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}

/**
 * Resultado de validación
 */
interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: Array<{
    path: string[];
    message: string;
    code: string;
  }>;
}

/**
 * Crea un middleware de validación para un endpoint específico
 * 
 * @example
 * ```typescript
 * import { z } from 'zod';
 * 
 * const createUserSchema = z.object({
 *   username: z.string().min(3),
 *   email: z.string().email(),
 * });
 * 
 * fastify.post('/users', {
 *   preHandler: validateRequest({ body: createUserSchema }),
 *   handler: createUserHandler,
 * });
 * ```
 */
export function validateRequest(schemas: ValidationOptions) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Validar body si existe schema
      if (schemas.body && request.body) {
        const result = await validateWithZod(schemas.body, request.body, 'body');
        if (!result.success) {
          throw new ValidationError('Invalid request body', result.errors);
        }
        // Sobrescribir con datos validados y parseados
        request.body = result.data;
      }

      // Validar params si existe schema
      if (schemas.params && request.params) {
        const result = await validateWithZod(schemas.params, request.params, 'params');
        if (!result.success) {
          throw new ValidationError('Invalid request params', result.errors);
        }
        request.params = result.data;
      }

      // Validar query si existe schema
      if (schemas.query && request.query) {
        const result = await validateWithZod(schemas.query, request.query, 'query');
        if (!result.success) {
          throw new ValidationError('Invalid query parameters', result.errors);
        }
        (request as any).query = result.data;
      }

      // Validar headers si existe schema
      if (schemas.headers && request.headers) {
        const result = await validateWithZod(schemas.headers, request.headers, 'headers');
        if (!result.success) {
          throw new ValidationError('Invalid request headers', result.errors);
        }
      }
    } catch (error) {
      // Si ya es ValidationError, relanzarlo para que lo capture el error handler
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // Cualquier otro error
      throw new ValidationError('Validation failed', { originalError: error });
    }
  };
}

/**
 * Valida datos con un schema de Zod
 */
async function validateWithZod(
  schema: ZodSchema,
  data: unknown,
  context: string
): Promise<ValidationResult> {
  try {
    // Intentar importar Zod dinámicamente
    // TODO: Instalar Zod: npm install zod (dentro del contenedor)
    // const { z } = await import('zod');
    
    // Por ahora, asumir que el schema ya tiene el método safeParse
    // (como los schemas manuales en validation-schemas.ts)
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }
    
    // Formatear errores
    const errors = result.error.errors.map((err: any) => ({
      path: err.path,
      message: err.message,
      code: err.code,
    }));
    
    return {
      success: false,
      errors,
    };
  } catch (error) {
    // Si Zod no está instalado, el schema manual funcionará
    // Si hay otro error, relanzarlo
    throw error;
  }
}

/**
 * Helper para crear schemas de validación comunes
 */
export const CommonSchemas = {
  /**
   * Validación de ID numérico positivo
   */
  positiveId: () => {
    // Retorna una función que crea el schema cuando Zod esté disponible
    return {
      safeParse: (data: any) => {
        if (typeof data !== 'number' || data <= 0 || !Number.isInteger(data)) {
          return {
            success: false,
            error: {
              errors: [{
                path: ['id'],
                message: 'ID must be a positive integer',
                code: 'invalid_type',
              }],
            },
          };
        }
        return { success: true, data };
      },
    };
  },

  /**
   * Validación de UUID v4
   */
  uuid: () => {
    return {
      safeParse: (data: any) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (typeof data !== 'string' || !uuidRegex.test(data)) {
          return {
            success: false,
            error: {
              errors: [{
                path: ['uuid'],
                message: 'Invalid UUID format',
                code: 'invalid_string',
              }],
            },
          };
        }
        return { success: true, data };
      },
    };
  },

  /**
   * Validación de email
   */
  email: () => {
    return {
      safeParse: (data: any) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof data !== 'string' || !emailRegex.test(data)) {
          return {
            success: false,
            error: {
              errors: [{
                path: ['email'],
                message: 'Invalid email format',
                code: 'invalid_string',
              }],
            },
          };
        }
        return { success: true, data };
      },
    };
  },
};
