/**
 * Tests para AttendancePersistenceService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttendancePersistenceService } from '../attendance-persistence.service';
import type { ValidationRepository, ResultRepository, RegistrationRepository } from '../../../infrastructure/repositories';

describe('AttendancePersistenceService', () => {
  let service: AttendancePersistenceService;
  let validationRepo: ValidationRepository;
  let resultRepo: ResultRepository;
  let registrationRepo: RegistrationRepository;

  beforeEach(() => {
    // Mock repositories
    validationRepo = {
      create: vi.fn(),
      complete: vi.fn(),
      getByRound: vi.fn(),
      getResponseTimeStats: vi.fn(),
      countSuccessful: vi.fn(),
    } as any;

    resultRepo = {
      create: vi.fn(),
      getByRegistration: vi.fn(),
    } as any;

    registrationRepo = {
      getBySessionAndUser: vi.fn(),
      updateStatus: vi.fn(),
    } as any;

    service = new AttendancePersistenceService(
      validationRepo,
      resultRepo,
      registrationRepo
    );
  });

  describe('saveValidationAttempt', () => {
    it('debería guardar nueva validación si no existe', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 1,
        responseTime: 1200,
        validatedAt: Date.now(),
      };

      const mockRegistration = { registrationId: 'reg-123' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(validationRepo.getByRound).mockResolvedValue(null);

      await service.saveValidationAttempt(params);

      expect(registrationRepo.getBySessionAndUser).toHaveBeenCalledWith(101, 1);
      expect(validationRepo.getByRound).toHaveBeenCalledWith('reg-123', 1);
      expect(validationRepo.create).toHaveBeenCalledWith({
        registrationId: 'reg-123',
        roundNumber: 1,
        qrGeneratedAt: expect.any(Date),
      });
      expect(validationRepo.complete).toHaveBeenCalledWith('reg-123', 1, {
        responseReceivedAt: expect.any(Date),
        responseTimeMs: 1200,
        validationStatus: 'success',
      });
    });

    it('debería completar validación existente sin crear duplicado', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 1,
        responseTime: 1200,
        validatedAt: Date.now(),
      };

      const mockRegistration = { registrationId: 'reg-123' };
      const mockExistingValidation = { validationId: 'val-456' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(validationRepo.getByRound).mockResolvedValue(mockExistingValidation as any);

      await service.saveValidationAttempt(params);

      expect(validationRepo.create).not.toHaveBeenCalled();
      expect(validationRepo.complete).toHaveBeenCalledWith('reg-123', 1, {
        responseReceivedAt: expect.any(Date),
        responseTimeMs: 1200,
        validationStatus: 'success',
      });
    });

    it('NO debería lanzar error si no encuentra registro', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 1,
        responseTime: 1200,
        validatedAt: Date.now(),
      };

      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(null);

      await expect(service.saveValidationAttempt(params)).resolves.not.toThrow();
      expect(validationRepo.create).not.toHaveBeenCalled();
    });

    it('NO debería lanzar error si sessionId no es numérico', async () => {
      const params = {
        sessionId: 'invalid',
        studentId: 1,
        round: 1,
        responseTime: 1200,
        validatedAt: Date.now(),
      };

      await expect(service.saveValidationAttempt(params)).resolves.not.toThrow();
      expect(registrationRepo.getBySessionAndUser).not.toHaveBeenCalled();
    });
  });

  describe('saveAttendanceResult', () => {
    it('debería guardar resultado final con estadísticas', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 3,
        responseTime: 1000,
        stats: {
          avg: 1100,
          stdDev: 150,
          min: 900,
          max: 1300,
          certainty: 85,
        },
        validatedAt: Date.now(),
        maxRounds: 3,
      };

      const mockRegistration = { registrationId: 'reg-123' };
      const mockRTStats = { avg: 1100, stdDev: 150, min: 900, max: 1300, median: 1100 };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(resultRepo.getByRegistration).mockResolvedValue(null);
      vi.mocked(validationRepo.getResponseTimeStats).mockResolvedValue(mockRTStats as any);
      vi.mocked(validationRepo.countSuccessful).mockResolvedValue(3);

      await service.saveAttendanceResult(params);

      expect(resultRepo.create).toHaveBeenCalledWith({
        registrationId: 'reg-123',
        totalRounds: 3,
        successfulRounds: 3,
        failedRounds: 0,
        avgResponseTimeMs: 1100,
        stdDevResponseTime: 150,
        minResponseTimeMs: 900,
        maxResponseTimeMs: 1300,
        medianResponseTimeMs: 1100,
        certaintyScore: 85,
        finalStatus: 'PRESENT',
      });
    });

    it('debería ser idempotente: NO duplicar si ya existe resultado', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 3,
        responseTime: 1000,
        stats: {
          avg: 1100,
          stdDev: 150,
          min: 900,
          max: 1300,
          certainty: 85,
        },
        validatedAt: Date.now(),
        maxRounds: 3,
      };

      const mockRegistration = { registrationId: 'reg-123' };
      const mockExistingResult = { resultId: 'res-789' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(resultRepo.getByRegistration).mockResolvedValue(mockExistingResult as any);

      await service.saveAttendanceResult(params);

      expect(resultRepo.create).not.toHaveBeenCalled();
    });

    it('debería determinar finalStatus PRESENT si certainty >= 70', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 3,
        responseTime: 1000,
        stats: { avg: 1100, stdDev: 150, min: 900, max: 1300, certainty: 75 },
        validatedAt: Date.now(),
        maxRounds: 3,
      };

      const mockRegistration = { registrationId: 'reg-123' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(resultRepo.getByRegistration).mockResolvedValue(null);
      vi.mocked(validationRepo.getResponseTimeStats).mockResolvedValue({} as any);
      vi.mocked(validationRepo.countSuccessful).mockResolvedValue(3);

      await service.saveAttendanceResult(params);

      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ finalStatus: 'PRESENT' })
      );
    });

    it('debería determinar finalStatus DOUBTFUL si 40 <= certainty < 70', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 3,
        responseTime: 1000,
        stats: { avg: 1100, stdDev: 150, min: 900, max: 1300, certainty: 50 },
        validatedAt: Date.now(),
        maxRounds: 3,
      };

      const mockRegistration = { registrationId: 'reg-123' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(resultRepo.getByRegistration).mockResolvedValue(null);
      vi.mocked(validationRepo.getResponseTimeStats).mockResolvedValue({} as any);
      vi.mocked(validationRepo.countSuccessful).mockResolvedValue(2);

      await service.saveAttendanceResult(params);

      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ finalStatus: 'DOUBTFUL' })
      );
    });

    it('debería determinar finalStatus ABSENT si certainty < 40', async () => {
      const params = {
        sessionId: '101',
        studentId: 1,
        round: 3,
        responseTime: 1000,
        stats: { avg: 1100, stdDev: 150, min: 900, max: 1300, certainty: 30 },
        validatedAt: Date.now(),
        maxRounds: 3,
      };

      const mockRegistration = { registrationId: 'reg-123' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(resultRepo.getByRegistration).mockResolvedValue(null);
      vi.mocked(validationRepo.getResponseTimeStats).mockResolvedValue({} as any);
      vi.mocked(validationRepo.countSuccessful).mockResolvedValue(1);

      await service.saveAttendanceResult(params);

      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ finalStatus: 'ABSENT' })
      );
    });
  });

  describe('markRegistrationComplete', () => {
    it('debería actualizar estado de registración a completed', async () => {
      const mockRegistration = { registrationId: 'reg-123' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);

      await service.markRegistrationComplete(1, '101');

      expect(registrationRepo.updateStatus).toHaveBeenCalledWith('reg-123', { status: 'completed' });
    });

    it('NO debería lanzar error si no encuentra registro', async () => {
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(null);

      await expect(service.markRegistrationComplete(1, '101')).resolves.not.toThrow();
      expect(registrationRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('saveCompleteAttendance', () => {
    it('debería ejecutar las 3 operaciones en orden', async () => {
      const validation = {
        sessionId: '101',
        studentId: 1,
        round: 3,
        responseTime: 1000,
        validatedAt: Date.now(),
      };

      const result = {
        sessionId: '101',
        studentId: 1,
        round: 3,
        responseTime: 1000,
        stats: { avg: 1100, stdDev: 150, min: 900, max: 1300, certainty: 85 },
        validatedAt: Date.now(),
        maxRounds: 3,
      };

      const mockRegistration = { registrationId: 'reg-123' };
      vi.mocked(registrationRepo.getBySessionAndUser).mockResolvedValue(mockRegistration as any);
      vi.mocked(validationRepo.getByRound).mockResolvedValue(null);
      vi.mocked(resultRepo.getByRegistration).mockResolvedValue(null);
      vi.mocked(validationRepo.getResponseTimeStats).mockResolvedValue({} as any);
      vi.mocked(validationRepo.countSuccessful).mockResolvedValue(3);

      await service.saveCompleteAttendance(validation, result);

      // Verificar que se ejecutaron todas las operaciones
      expect(validationRepo.create).toHaveBeenCalled();
      expect(resultRepo.create).toHaveBeenCalled();
      expect(registrationRepo.updateStatus).toHaveBeenCalled();
    });
  });
});
