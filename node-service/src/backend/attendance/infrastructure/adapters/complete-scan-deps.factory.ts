/**
 * Complete Scan Adapter Factory
 * 
 * Crea las dependencias necesarias para CompleteScanUseCase
 * conectando los repositorios existentes.
 */

import type { CompleteScanDependencies } from '../../application/complete-scan.usecase';
import { CryptoService } from '../../../../shared/infrastructure/crypto';
import { QRPayloadRepository } from '../../../qr-projection/infrastructure/qr-payload.repository';
import { StudentSessionRepository } from '../student-session.repository';
import { ProjectionPoolRepository } from '../projection-pool.repository';
import { QRGenerator } from '../../../qr-projection/domain/qr-generator';
import { QRStateAdapter } from './qr-state.adapter';
import { StudentStateAdapter } from './student-state.adapter';

/**
 * Configuración del factory
 */
interface FactoryConfig {
  qrTTL: number;
  mockHostUserId: number;
}

const DEFAULT_CONFIG: FactoryConfig = {
  qrTTL: 30,
  mockHostUserId: 1,
};

/**
 * Crea todas las dependencias para CompleteScanUseCase
 */
export function createCompleteScanDependencies(
  config?: Partial<FactoryConfig>
): CompleteScanDependencies {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Instanciar repositorios
  const cryptoService = new CryptoService();
  const payloadRepo = new QRPayloadRepository(cfg.qrTTL);
  const studentRepo = new StudentSessionRepository();
  const poolRepo = new ProjectionPoolRepository();
  const qrGenerator = new QRGenerator(cryptoService);

  // Adapters para el pipeline de validación
  const qrStateLoader = new QRStateAdapter(poolRepo, cfg.qrTTL);
  const studentStateLoader = new StudentStateAdapter(studentRepo);

  return {
    // Para ValidateScanUseCase (pipeline)
    cryptoService,
    qrStateLoader,
    studentStateLoader,

    // Side effects
    markQRConsumed: async (nonce: string, studentId: number) => {
      return payloadRepo.markAsConsumed(nonce, studentId);
    },

    completeRound: async (sessionId: string, studentId: number, result) => {
      const { state, isComplete } = await studentRepo.completeRound(
        sessionId,
        studentId,
        result
      );
      
      return {
        currentRound: state.currentRound,
        isComplete,
        roundsCompleted: state.roundsCompleted.map(r => ({
          responseTime: r.responseTime,
        })),
      };
    },

    generateNextQR: async (sessionId: string, studentId: number, round: number) => {
      const { payload, encrypted } = qrGenerator.generateForStudent({
        sessionId,
        userId: studentId,
        round,
        hostUserId: cfg.mockHostUserId,
      });

      // Almacenar el payload para validación futura
      await payloadRepo.store(payload, encrypted, cfg.qrTTL);

      return {
        encrypted,
        nonce: payload.n,
      };
    },

    setActiveQR: async (sessionId: string, studentId: number, nonce: string) => {
      await studentRepo.setActiveQR(sessionId, studentId, nonce);
    },

    updatePoolQR: async (sessionId: string, studentId: number, encrypted: string, round: number) => {
      await poolRepo.upsertStudentQR(sessionId, studentId, encrypted, round);
    },
  };
}
