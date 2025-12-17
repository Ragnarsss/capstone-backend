/**
 * Adapter: QRGenerator
 * 
 * Implementa IQRGenerator delegando a la implementación concreta de qr-projection.
 * Permite que attendance dependa de la interface (shared/ports/) en lugar de la implementación.
 * 
 * Patrón: Ports & Adapters (Hexagonal Architecture)
 */

import type { IQRGenerator, GenerateStudentQROptions, GenerateQRResult } from '../../../../shared/ports';
import { QRGenerator } from '../../../qr-projection/domain/qr-generator';
import type { QRPayloadV1 } from '../../../../shared/types';
import type { AesGcmService } from '../../../../shared/infrastructure/crypto';

/**
 * Adapter que implementa IQRGenerator usando QRGenerator de qr-projection
 */
export class QRGeneratorAdapter implements IQRGenerator {
  private readonly qrGenerator: QRGenerator;

  constructor(aesGcmService: AesGcmService) {
    this.qrGenerator = new QRGenerator(aesGcmService);
  }

  generateForStudent(options: GenerateStudentQROptions): GenerateQRResult {
    return this.qrGenerator.generateForStudent(options);
  }

  generateNonce(): string {
    return this.qrGenerator.generateNonce();
  }

  encryptPayloadWithRandomKey(payload: QRPayloadV1): string {
    return this.qrGenerator.encryptPayloadWithRandomKey(payload);
  }
}
