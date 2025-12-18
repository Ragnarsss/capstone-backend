/**
 * Complete Scan Adapter Factory
 * 
 * Crea las dependencias necesarias para CompleteScanUseCase
 * conectando los repositorios existentes.
 */

import type { CompleteScanDependencies, PersistenceDependencies, ServiceDependencies } from '../../application/complete-scan.usecase';
import { AttendancePersistenceService } from '../../application/services/attendance-persistence.service';
import { QRLifecycleService } from '../../application/services/qr-lifecycle.service';
import { AttendanceStatsCalculator } from '../../domain/services/attendance-stats-calculator.service';
import { AesGcmService } from '../../../../shared/infrastructure/crypto';
import { QRPayloadRepository } from '../../../qr-projection/infrastructure/qr-payload.repository';
import { StudentSessionRepository } from '../student-session.repository';
import { ProjectionPoolRepository } from '../../../../shared/infrastructure/valkey';
import { QRGenerator } from '../../../qr-projection/domain/qr-generator';
import type { IQRGenerator, IQRPayloadRepository } from '../../../../shared/ports';
import { QRStateAdapter } from './qr-state.adapter';
import { StudentStateAdapter } from './student-state.adapter';
import { SessionKeyQueryAdapter } from './session-key-query.adapter';
import { SessionKeyRepository } from '../../../session/infrastructure/repositories/session-key.repository';
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
  services: ServiceDependencies;
  persistence?: PersistenceDependencies;
}

/**
 * Crea todas las dependencias para CompleteScanUseCase (deps + services)
 * @deprecated Use createCompleteScanDepsWithPersistence para acceso a todas las dependencias
 */
export function createCompleteScanDependencies(
  config?: Partial<FactoryConfig>
): { deps: CompleteScanDependencies; services: ServiceDependencies } {
  const result = createCompleteScanDepsWithPersistence(config);
  return { deps: result.deps, services: result.services };
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
  const sessionKeyRepo = new SessionKeyRepository();

  // Adapters para el pipeline de validación
  const qrStateLoader = new QRStateAdapter(poolRepo, cfg.qrTTL);
  const studentStateLoader = new StudentStateAdapter(studentRepo);
  const sessionKeyQuery = new SessionKeyQueryAdapter(sessionKeyRepo);

  const deps: CompleteScanDependencies = {
    // Para ValidateScanUseCase (pipeline)
    aesGcmService,
    qrStateLoader,
    studentStateLoader,
    sessionKeyQuery,

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
  };

  // Servicios inyectados (extraídos del UseCase)
  const statsCalculator = new AttendanceStatsCalculator();
  const qrLifecycleManager = new QRLifecycleService(
    qrGenerator,
    payloadRepo,
    poolRepo,
    null,
    cfg.mockHostUserId
  );
  
  const services: ServiceDependencies = {
    statsCalculator,
    qrLifecycleManager,
  };

  // Crear dependencias de persistencia si está habilitado
  let persistence: PersistenceDependencies | undefined;
  
  if (cfg.enablePostgresPersistence) {
    const validationRepo = new ValidationRepository();
    const resultRepo = new ResultRepository();
    const registrationRepo = new RegistrationRepository();
    const persistenceService = new AttendancePersistenceService(
      validationRepo,
      resultRepo,
      registrationRepo
    );
    
    persistence = {
      validationRepo,
      resultRepo,
      registrationRepo,
      persistenceService,
    };
    logger.debug('[CompleteScanDeps] Persistencia PostgreSQL habilitada con servicio');
  }

  return { deps, services, persistence };
}