/**
 * Enrollment Validation Schemas
 * 
 * Schemas de validación para endpoints de enrollment FIDO2.
 * Usa validación manual hasta que Zod esté instalado.
 */

import { ValidationError } from '../../../middleware';

/**
 * Validación manual para StartEnrollmentRequest
 */
export const startEnrollmentSchema = {
  safeParse: (data: any) => {
    const errors: Array<{ path: string[]; message: string; code: string }> = [];

    // displayName es opcional, pero si existe debe ser string
    if (data.displayName !== undefined) {
      if (typeof data.displayName !== 'string') {
        errors.push({
          path: ['displayName'],
          message: 'displayName must be a string',
          code: 'invalid_type',
        });
      } else if (data.displayName.length > 100) {
        errors.push({
          path: ['displayName'],
          message: 'displayName must not exceed 100 characters',
          code: 'too_big',
        });
      }
    }

    if (errors.length > 0) {
      return { success: false, error: { errors } };
    }

    return { success: true, data };
  },
};

/**
 * Validación manual para FinishEnrollmentRequest
 */
export const finishEnrollmentSchema = {
  safeParse: (data: any) => {
    const errors: Array<{ path: string[]; message: string; code: string }> = [];

    // credential es requerido
    if (!data.credential) {
      errors.push({
        path: ['credential'],
        message: 'credential is required',
        code: 'invalid_type',
      });
    } else if (typeof data.credential !== 'object') {
      errors.push({
        path: ['credential'],
        message: 'credential must be an object',
        code: 'invalid_type',
      });
    } else {
      // Validar campos requeridos de credential
      const requiredFields = ['id', 'rawId', 'type', 'response'];
      for (const field of requiredFields) {
        if (!(field in data.credential)) {
          errors.push({
            path: ['credential', field],
            message: `${field} is required in credential`,
            code: 'invalid_type',
          });
        }
      }

      // Validar que type sea 'public-key'
      if (data.credential.type && data.credential.type !== 'public-key') {
        errors.push({
          path: ['credential', 'type'],
          message: 'credential type must be "public-key"',
          code: 'invalid_literal',
        });
      }

      // Validar response object
      if (data.credential.response) {
        if (typeof data.credential.response !== 'object') {
          errors.push({
            path: ['credential', 'response'],
            message: 'credential.response must be an object',
            code: 'invalid_type',
          });
        } else {
          const responseFields = ['clientDataJSON', 'attestationObject'];
          for (const field of responseFields) {
            if (!(field in data.credential.response)) {
              errors.push({
                path: ['credential', 'response', field],
                message: `${field} is required in credential.response`,
                code: 'invalid_type',
              });
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, error: { errors } };
    }

    return { success: true, data };
  },
};

/**
 * Validación manual para LoginECDHRequest
 */
export const loginECDHSchema = {
  safeParse: (data: any) => {
    const errors: Array<{ path: string[]; message: string; code: string }> = [];

    // publicKey es requerido
    if (!data.publicKey) {
      errors.push({
        path: ['publicKey'],
        message: 'publicKey is required',
        code: 'invalid_type',
      });
    } else if (typeof data.publicKey !== 'string') {
      errors.push({
        path: ['publicKey'],
        message: 'publicKey must be a string',
        code: 'invalid_type',
      });
    }

    // assertion es requerido
    if (!data.assertion) {
      errors.push({
        path: ['assertion'],
        message: 'assertion is required',
        code: 'invalid_type',
      });
    } else if (typeof data.assertion !== 'object') {
      errors.push({
        path: ['assertion'],
        message: 'assertion must be an object',
        code: 'invalid_type',
      });
    } else {
      // Validar campos requeridos de assertion
      const requiredFields = ['id', 'rawId', 'type', 'response'];
      for (const field of requiredFields) {
        if (!(field in data.assertion)) {
          errors.push({
            path: ['assertion', field],
            message: `${field} is required in assertion`,
            code: 'invalid_type',
          });
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, error: { errors } };
    }

    return { success: true, data };
  },
};

/**
 * Helper para validar y lanzar ValidationError si falla
 */
export function validateOrThrow(schema: any, data: any, context: string): any {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new ValidationError(`Invalid ${context}`, result.error.errors);
  }
  
  return result.data;
}
