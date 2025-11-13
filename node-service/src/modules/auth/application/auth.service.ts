import { JWTUtils } from '../domain/jwt-utils';
import type { AuthenticatedUser, JWTPayload } from '../domain/models';

/**
 * Application Service para Authentication
 * Responsabilidad: Orquestar casos de uso de autenticación
 */
export class AuthService {
  private jwtUtils: JWTUtils;

  constructor(jwtUtils: JWTUtils) {
    this.jwtUtils = jwtUtils;
  }

  authenticateFromHeader(authHeader: string | undefined): AuthenticatedUser {
    const token = this.jwtUtils.extractFromHeader(authHeader);
    const payload = this.jwtUtils.verify(token);
    return this.mapToAuthenticatedUser(payload);
  }

  verifyToken(token: string): AuthenticatedUser {
    const payload = this.jwtUtils.verify(token);
    return this.mapToAuthenticatedUser(payload);
  }

  generateToken(user: Omit<AuthenticatedUser, 'userId' | 'username'> & { userId: number; username: string }): string {
    return this.jwtUtils.generate(user);
  }

  private mapToAuthenticatedUser(payload: JWTPayload): AuthenticatedUser {
    return {
      userId: payload.userId,
      username: payload.username,
      nombreCompleto: payload.nombreCompleto,
      rol: payload.rol,
    };
  }
}
