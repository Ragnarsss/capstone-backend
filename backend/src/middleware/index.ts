/**
 * Shared Middleware Exports
 * Responsabilidad: Punto central de exportación de middlewares
 */

export { securityHeadersMiddleware } from './security-headers.middleware';
export { corsMiddleware } from './cors.middleware';
export { cacheControlMiddleware, noCacheHeaders } from './cache-control.middleware';
export { requestLoggerMiddleware } from './request-logger.middleware';
export {
  rateLimitMiddleware,
  createEndpointRateLimiter,
  userIdKeyGenerator,
  ipEndpointKeyGenerator,
} from './rate-limit.middleware';
export {
  errorHandlerMiddleware,
  setupGlobalErrorHandlers,
} from './error-handler.middleware';
export {
  validateRequest,
  CommonSchemas,
} from './validation.middleware';
export {
  contentTypeMiddleware,
  validateContentType,
  ContentType,
  jsonOnly,
  jsonOrForm,
  multipartOnly,
} from './content-type.middleware';
export { createJWTAuthMiddleware } from './jwt-auth.middleware';

// Error classes and utilities
export * from './errors/index';
