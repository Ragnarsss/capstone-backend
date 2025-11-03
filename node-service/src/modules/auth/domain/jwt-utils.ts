import jwt from 'jsonwebtoken';
import { config } from '../../../shared/config';
import type { JWTPayload } from './models';

/**
 * Domain service: JWT utilities
 * Responsabilidad: Validación y generación de JWT
 */
export class JWTUtils {
  verify(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
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
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
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
