import jwt, { type Secret } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import type { JWTPayload } from './models';

/**
 * Configuración requerida por JWTUtils
 */
export interface JWTConfig {
  secret: Secret;
  expiresIn: StringValue | number;
  issuer: string;
  audience: string;
}

/**
 * Domain service: JWT utilities
 * Responsabilidad: Validación y generación de JWT
 */
export class JWTUtils {
  private readonly config: JWTConfig;

  constructor(config: JWTConfig) {
    this.config = config;
  }

  verify(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as JWTPayload;

      if (!decoded.userId || !decoded.username) {
        throw new Error('JWT payload inválido: falta userId o username');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expirado');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Token inválido');
      } else {
        throw error;
      }
    }
  }

  generate(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.expiresIn,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  extractFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new Error('Header Authorization no proporcionado');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Formato de Authorization inválido. Esperado: "Bearer <token>"');
    }

    return parts[1];
  }
}
