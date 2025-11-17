<?php
/**
 * Environment Variables Template
 * 
 * Copiar este archivo como .env y configurar valores apropiados
 * 
 * IMPORTANTE: No commitear archivo .env con secrets reales
 */

// Habilitar/deshabilitar módulo
putenv('NODE_MODULE_ENABLED=true');

// Entorno: development, production
putenv('NODE_ENV=production');

// Secrets JWT (CAMBIAR EN PRODUCCIÓN)
putenv('JWT_SECRET=your-super-secret-key-min-32-chars');
putenv('JWT_SECRET_INTERNAL=your-internal-secret-key-min-32-chars');

// TTL del token en segundos (default: 300 = 5 minutos)
putenv('JWT_TTL=300');

// URL del servicio Node (interno)
putenv('NODE_SERVICE_URL=http://node-service:3000');

// Timeout para requests a Node (segundos)
putenv('NODE_TIMEOUT=5');

// Habilitar logging (solo en desarrollo)
putenv('ENABLE_LOGGING=false');
