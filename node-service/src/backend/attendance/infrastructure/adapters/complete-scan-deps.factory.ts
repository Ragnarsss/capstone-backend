/**
 * Complete Scan Adapter Factory
 * 
 * Crea las dependencias necesarias para CompleteScanUseCase
 * conectando los repositorios existentes.
 */

import type { CompleteScanDependencies, PersistenceDependencies } from '../../application/complete-scan.usecase';
import { AesGcmService } from '../../../../shared/infrastructure/crypto';
import { QRPayloadRepository } from '../../../qr-projection/infrastructure/qr-payload.repository';
import { StudentSessionRepository } from '../student-session.repository';
import { ProjectionPoolRepository } from '../../../../shared/infrastructure/valkey';
import { QRGenerator } from '../../../qr-projection/domain/qr-generator';
import type { IQRGenerator, IQRPayloadRepository } from '../../../../shared/ports';
import { QRStateAdapter } from './qr-state.adapter';
import { StudentStateAdapter } from './student-state.adapter';
import { ValidationRepository, ResultRepository, RegistrationRepository } from '../repositories';
import { logger } from '../../../../shared/infrastructure/logger';

/**
 * Configuración del factory
 */
interface FactoryConfig {
  qrTTL: number;
  mockHostUserId: number;
  enablePostgresPersistence: boolean;
}

const DEFAULT_CONFIG: FactoryConfig = {
  qrTTL: 60,
  mockHostUserId: 1,
  enablePostgresPersistence: false,
};

/**
 * Resultado del factory
 */
export interface CompleteScanDepsResult {
  deps: CompleteScanDependencies;
  persistence?: PersistenceDependencies;
}

/**
 * Crea todas las dependencias para CompleteScanUseCase
 */
export function createCompleteScanDependencies(
  config?: Partial<FactoryConfig>
): CompleteScanDependencies {
  return createCompleteScanDepsWithPersistence(config).deps;
}

/**
 * Crea dependencias con persistencia PostgreSQL opcional
 */
export function createCompleteScanDepsWithPersistence(
  config?: Partial<FactoryConfig>
): CompleteScanDepsResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Instanciar repositorios
  const aesGcmService = new AesGcmService();
  const payloadRepo = new QRPayloadRepository(cfg.qrTTL);
  const studentRepo = new StudentSessionRepository();
  const poolRepo = new ProjectionPoolRepository();
  const qrGenerator = new QRGenerator(aesGcmService);

  // Adapters para el pipeline de validación
  const qrStateLoader = new QRStateAdapter(poolRepo, cfg.qrTTL);
  const studentStateLoader = new StudentStateAdapter(studentRepo);

  const deps: CompleteScanDependencies = {
    // Para ValidateScanUseCase (pipeline)
    aesGcmService,
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

  // Crear dependencias de persistencia si está habilitado
  let persistence: PersistenceDependencies | undefined;
  
  if (cfg.enablePostgresPersistence) {
    persistence = {
      validationRepo: new ValidationRepository(),
      resultRepo: new ResultRepository(),
      registrationRepo: new RegistrationRepository(),
    };
    logger.debug('[CompleteScanDeps] Persistencia PostgreSQL habilitada');
  }

  return { deps, persistence };
}