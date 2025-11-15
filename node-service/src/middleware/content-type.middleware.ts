/**
 * Content-Type Validation Middleware
 * 
 * Protección contra ataques de tipo MIME y validación de Content-Type.
 * Asegura que los endpoints solo acepten los tipos de contenido apropiados.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UnsupportedMediaTypeError } from './errors/index.js';

/**
 * Tipos de contenido soportados
 */
export enum ContentType {
  JSON = 'application/json',
  FORM_URLENCODED = 'application/x-www-form-urlencoded',
  FORM_DATA = 'multipart/form-data',
  TEXT_PLAIN = 'text/plain',
  TEXT_HTML = 'text/html',
}

/**
 * Opciones de validación de Content-Type
 */
interface ContentTypeOptions {
  /** Tipos de contenido permitidos */
  allowed: ContentType[];
  /** Requerir charset UTF-8 */
  requireUtf8?: boolean;
  /** Mensaje de error personalizado */
  message?: string;
}

/**
 * Middleware global para validar Content-Type en métodos que envían body
 */
export function contentTypeMiddleware(fastify: FastifyInstance): void {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Solo validar en métodos que típicamente envían body
    const methodsWithBody = ['POST', 'PUT', 'PATCH'];
    if (!methodsWithBody.includes(request.method)) {
      return;
    }

    // Skip si no hay Content-Type header (será manejado por otros middlewares)
    const contentType = request.headers['content-type'];
    if (!contentType) {
      // Para POST/PUT/PATCH sin Content-Type, rechazar
      throw new UnsupportedMediaTypeError(
        'Content-Type header is required for POST/PUT/PATCH requests'
      );
    }

    // Por defecto, la mayoría de endpoints API deben ser JSON
    // Excepciones serán manejadas por validateContentType específico
    const baseContentType = parseContentType(contentType);
    
    // Validar que sea JSON por defecto (a menos que el endpoint tenga validación específica)
    // Esto se puede personalizar por ruta usando validateContentType
  });
}

/**
 * Crea un middleware de validación de Content-Type para un endpoint específico
 * 
 * @example
 * ```typescript
 * fastify.post('/api/users', {
 *   preHandler: validateContentType({ 
 *     allowed: [ContentType.JSON],
 *     requireUtf8: true,
 *   }),
 *   handler: createUser,
 * });
 * ```
 */
export function validateContentType(options: ContentTypeOptions) {
  const { allowed, requireUtf8 = true, message } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const contentTypeHeader = request.headers['content-type'];

    // Si no hay Content-Type y el request tiene body, rechazar
    if (!contentTypeHeader) {
      const methodsWithBody = ['POST', 'PUT', 'PATCH'];
      if (methodsWithBody.includes(request.method)) {
        throw new UnsupportedMediaTypeError(
          message || 'Content-Type header is required'
        );
      }
      return;
    }

    // Parsear Content-Type (puede incluir charset, boundary, etc)
    const { mediaType, charset, parameters } = parseContentTypeDetailed(contentTypeHeader);

    // Verificar si el tipo está permitido
    const isAllowed = allowed.some(allowedType => {
      // Comparación case-insensitive
      return mediaType.toLowerCase() === allowedType.toLowerCase();
    });

    if (!isAllowed) {
      const allowedList = allowed.join(', ');
      throw new UnsupportedMediaTypeError(
        message || `Content-Type must be one of: ${allowedList}. Received: ${mediaType}`,
        { received: mediaType, allowed: allowedList }
      );
    }

    // Validar charset UTF-8 si es requerido
    if (requireUtf8 && charset && charset.toLowerCase() !== 'utf-8') {
      throw new UnsupportedMediaTypeError(
        `Charset must be UTF-8. Received: ${charset}`,
        { received: charset, expected: 'UTF-8' }
      );
    }

    // Para multipart/form-data, validar que tenga boundary
    if (mediaType.toLowerCase() === ContentType.FORM_DATA) {
      if (!parameters.boundary) {
        throw new UnsupportedMediaTypeError(
          'multipart/form-data requires boundary parameter'
        );
      }
    }
  };
}

/**
 * Parsea Content-Type header y extrae el media type base
 */
function parseContentType(contentType: string): string {
  // Content-Type puede ser "application/json; charset=utf-8"
  const parts = contentType.split(';');
  return parts[0].trim();
}

/**
 * Parsea Content-Type header con detalles (charset, boundary, etc)
 */
interface ContentTypeDetails {
  mediaType: string;
  charset?: string;
  parameters: Record<string, string>;
}

function parseContentTypeDetailed(contentType: string): ContentTypeDetails {
  const parts = contentType.split(';').map(p => p.trim());
  const mediaType = parts[0];
  const parameters: Record<string, string> = {};
  let charset: string | undefined;

  // Parsear parámetros adicionales
  for (let i = 1; i < parts.length; i++) {
    const [key, value] = parts[i].split('=').map(p => p.trim());
    if (key && value) {
      // Remover comillas si existen
      const cleanValue = value.replace(/^["']|["']$/g, '');
      parameters[key.toLowerCase()] = cleanValue;
      
      if (key.toLowerCase() === 'charset') {
        charset = cleanValue;
      }
    }
  }

  return { mediaType, charset, parameters };
}

/**
 * Validación específica para endpoints JSON
 */
export const jsonOnly = validateContentType({
  allowed: [ContentType.JSON],
  requireUtf8: true,
  message: 'This endpoint only accepts application/json',
});

/**
 * Validación para endpoints que aceptan JSON o form-urlencoded
 */
export const jsonOrForm = validateContentType({
  allowed: [ContentType.JSON, ContentType.FORM_URLENCODED],
  requireUtf8: true,
});

/**
 * Validación para endpoints de upload
 */
export const multipartOnly = validateContentType({
  allowed: [ContentType.FORM_DATA],
  requireUtf8: false,
  message: 'This endpoint only accepts multipart/form-data for file uploads',
});
