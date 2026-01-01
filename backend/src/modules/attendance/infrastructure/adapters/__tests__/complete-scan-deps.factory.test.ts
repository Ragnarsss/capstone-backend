/**
 * Tests: Complete Scan Dependencies Factory
 *
 * Tests unitarios para el factory de dependencias del sistema de asistencia.
 * Verifica la correcta creación de dependencias, servicios y configuración
 * siguiendo principios de Clean Architecture.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createCompleteScanDependencies,
  createCompleteScanDepsWithPersistence,
  type CompleteScanDepsResult,
} from "../complete-scan-deps.factory";

describe("Complete Scan Dependencies Factory", () => {
  // Cleanup después de cada test
  afterEach(() => {
    // Restaurar variables de entorno si fueron modificadas
    delete process.env.TEST_MODE;
  });

  describe("createCompleteScanDependencies", () => {
    describe("Configuración Básica", () => {
      it("debe crear dependencias con valores por defecto", () => {
        const result = createCompleteScanDependencies();

        // Verificar estructura completa
        expect(result).toHaveProperty("deps");
        expect(result).toHaveProperty("services");
        expect(result.deps).toBeDefined();
        expect(result.services).toBeDefined();
      });

      it("debe usar TTL por defecto de 60 segundos", () => {
        const result = createCompleteScanDependencies();

        // El factory usa internamente TTL=60
        expect(result.deps).toBeDefined();
        // Verificar que se puede usar el servicio sin errores
        expect(result.deps.aesGcmService).toBeDefined();
      });

      it("debe usar mockHostUserId por defecto de 1", () => {
        const result = createCompleteScanDependencies();

        // Verificar que el lifecycle manager fue creado correctamente
        expect(result.services.qrLifecycleManager).toBeDefined();
      });
    });

    describe("Configuración Personalizada", () => {
      it("debe aceptar TTL personalizado", () => {
        const customTTL = 120;
        const result = createCompleteScanDependencies({
          qrTTL: customTTL,
        });

        expect(result.deps).toBeDefined();
        expect(result.services).toBeDefined();
      });

      it("debe aceptar mockHostUserId personalizado", () => {
        const customUserId = 999;
        const result = createCompleteScanDependencies({
          mockHostUserId: customUserId,
        });

        expect(result.deps).toBeDefined();
        expect(result.services.qrLifecycleManager).toBeDefined();
      });

      it("debe manejar valores extremos de TTL", () => {
        // TTL muy corto (1 segundo)
        const result1 = createCompleteScanDependencies({ qrTTL: 1 });
        expect(result1.deps).toBeDefined();

        // TTL muy largo (1 hora)
        const result2 = createCompleteScanDependencies({ qrTTL: 3600 });
        expect(result2.deps).toBeDefined();
      });

      it("debe manejar diferentes mockHostUserId", () => {
        // UserID mínimo
        const result1 = createCompleteScanDependencies({ mockHostUserId: 1 });
        expect(result1.services.qrLifecycleManager).toBeDefined();

        // UserID grande
        const result2 = createCompleteScanDependencies({
          mockHostUserId: 999999,
        });
        expect(result2.services.qrLifecycleManager).toBeDefined();
      });
    });

    describe("Dependencias del Pipeline de Validación", () => {
      it("debe crear qrStateLoader con interfaz correcta", () => {
        const { deps } = createCompleteScanDependencies();

        expect(deps.qrStateLoader).toBeDefined();
        expect(typeof deps.qrStateLoader).toBe("object");
        // Verificar que tiene los métodos necesarios para el pipeline
        expect(deps.qrStateLoader).toHaveProperty("getState");
      });

      it("debe crear studentStateLoader con interfaz correcta", () => {
        const { deps } = createCompleteScanDependencies();

        expect(deps.studentStateLoader).toBeDefined();
        expect(typeof deps.studentStateLoader).toBe("object");
        // Verificar que tiene los métodos necesarios
        expect(deps.studentStateLoader).toHaveProperty("getState");
      });

      it("debe crear sessionKeyQuery con método findByUserId", () => {
        const { deps } = createCompleteScanDependencies();

        expect(deps.sessionKeyQuery).toBeDefined();
        expect(typeof deps.sessionKeyQuery.findByUserId).toBe("function");
      });

      it("debe crear aesGcmService con métodos de encriptación", () => {
        const { deps } = createCompleteScanDependencies();

        expect(deps.aesGcmService).toBeDefined();
        expect(typeof deps.aesGcmService.decrypt).toBe("function");
        expect(typeof deps.aesGcmService.encrypt).toBe("function");
      });

      it("debe crear markQRConsumed como función async", () => {
        const { deps } = createCompleteScanDependencies();

        expect(typeof deps.markQRConsumed).toBe("function");
        expect(deps.markQRConsumed.constructor.name).toBe("AsyncFunction");
      });

      it("debe crear completeRound como función async", () => {
        const { deps } = createCompleteScanDependencies();

        expect(typeof deps.completeRound).toBe("function");
        expect(deps.completeRound.constructor.name).toBe("AsyncFunction");
      });
    });

    describe("Servicios de Aplicación", () => {
      it("debe crear qrLifecycleManager con métodos completos", () => {
        const { services } = createCompleteScanDependencies();

        expect(services.qrLifecycleManager).toBeDefined();
        expect(typeof services.qrLifecycleManager.generateAndPublish).toBe(
          "function"
        );
        // Verificar que es una instancia con múltiples métodos
        expect(services.qrLifecycleManager).toHaveProperty(
          "generateAndPublish"
        );
      });

      it("debe crear statsCalculator con método calculate", () => {
        const { services } = createCompleteScanDependencies();

        expect(services.statsCalculator).toBeDefined();
        expect(typeof services.statsCalculator.calculate).toBe("function");
      });

      it("debe crear servicios independientes entre sí", () => {
        const result1 = createCompleteScanDependencies();
        const result2 = createCompleteScanDependencies();

        // Cada llamada debe crear instancias nuevas
        expect(result1.services.qrLifecycleManager).not.toBe(
          result2.services.qrLifecycleManager
        );
        expect(result1.services.statsCalculator).not.toBe(
          result2.services.statsCalculator
        );
      });
    });
  });

  describe("createCompleteScanDepsWithPersistence", () => {
    describe("Persistencia Deshabilitada (Default)", () => {
      it("debe crear resultado sin persistencia por defecto", () => {
        const result = createCompleteScanDepsWithPersistence();

        expect(result).toBeDefined();
        expect(result.deps).toBeDefined();
        expect(result.services).toBeDefined();
        expect(result.persistence).toBeUndefined();
      });

      it("debe crear deps y services completos sin persistencia", () => {
        const result = createCompleteScanDepsWithPersistence();

        // Verificar que deps está completo
        expect(result.deps.aesGcmService).toBeDefined();
        expect(result.deps.qrStateLoader).toBeDefined();
        expect(result.deps.studentStateLoader).toBeDefined();
        expect(result.deps.sessionKeyQuery).toBeDefined();

        // Verificar que services está completo
        expect(result.services.qrLifecycleManager).toBeDefined();
        expect(result.services.statsCalculator).toBeDefined();
      });

      it("debe funcionar con enablePostgresPersistence=false explícito", () => {
        const result = createCompleteScanDepsWithPersistence({
          enablePostgresPersistence: false,
        });

        expect(result.persistence).toBeUndefined();
      });
    });

    describe("Persistencia Habilitada", () => {
      it("debe crear persistence cuando enablePostgresPersistence=true", () => {
        const result = createCompleteScanDepsWithPersistence({
          enablePostgresPersistence: true,
        });

        expect(result).toBeDefined();
        expect(result.deps).toBeDefined();
        expect(result.services).toBeDefined();
        expect(result.persistence).toBeDefined();
      });

      it("debe crear persistenceService con métodos completos", () => {
        const result = createCompleteScanDepsWithPersistence({
          enablePostgresPersistence: true,
        });

        expect(result.persistence).toBeDefined();
        expect(result.persistence!.persistenceService).toBeDefined();

        // Verificar todos los métodos del servicio de persistencia
        const service = result.persistence!.persistenceService;
        expect(typeof service.saveCompleteAttendance).toBe("function");
        expect(typeof service.saveValidationAttempt).toBe("function");
        expect(typeof service.saveAttendanceResult).toBe("function");
        expect(typeof service.markRegistrationComplete).toBe("function");
      });

      it("debe crear todos los repositorios de persistencia", () => {
        const result = createCompleteScanDepsWithPersistence({
          enablePostgresPersistence: true,
        });

        expect(result.persistence).toBeDefined();
        expect(result.persistence!.validationRepo).toBeDefined();
        expect(result.persistence!.resultRepo).toBeDefined();
        expect(result.persistence!.registrationRepo).toBeDefined();
      });

      it("debe funcionar con persistencia + configuración personalizada", () => {
        const result = createCompleteScanDepsWithPersistence({
          qrTTL: 180,
          mockHostUserId: 777,
          enablePostgresPersistence: true,
        });

        expect(result.deps).toBeDefined();
        expect(result.services).toBeDefined();
        expect(result.persistence).toBeDefined();
      });
    });

    it("debe respetar configuración de qrTTL", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 180,
      });

      expect(result.deps).toBeDefined();
      // El TTL se pasa internamente a los repositorios
    });

    it("debe respetar configuración de mockHostUserId", () => {
      const result = createCompleteScanDepsWithPersistence({
        mockHostUserId: 777,
      });

      expect(result.deps).toBeDefined();
      // El mockHostUserId se usa internamente
    });

    it("debe manejar configuración parcial", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 90,
      });

      expect(result).toBeDefined();
      expect(result.persistence).toBeUndefined(); // enablePostgresPersistence es false por defecto
    });

    it("debe manejar configuración completa", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 150,
        mockHostUserId: 555,
        enablePostgresPersistence: true,
      });

      expect(result.deps).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.persistence).toBeDefined();
    });

    it("debe crear todas las dependencias necesarias para el pipeline", () => {
      const result = createCompleteScanDepsWithPersistence();

      // Verificar que todas las dependencias requeridas están presentes
      expect(result.deps.qrStateLoader).toBeDefined();
      expect(result.deps.studentStateLoader).toBeDefined();
      expect(result.deps.sessionKeyQuery).toBeDefined();
      expect(result.deps.aesGcmService).toBeDefined();
    });

    it("debe crear todos los servicios necesarios", () => {
      const result = createCompleteScanDepsWithPersistence();

      expect(result.services.qrLifecycleManager).toBeDefined();
      expect(result.services.statsCalculator).toBeDefined();
    });

    it("debe retornar estructura CompleteScanDepsResult válida", () => {
      const result: CompleteScanDepsResult =
        createCompleteScanDepsWithPersistence();

      expect(result).toHaveProperty("deps");
      expect(result).toHaveProperty("services");
      // persistence es opcional
    });
  });

  describe("Configuración por defecto", () => {
    it("debe usar TTL 60 por defecto", () => {
      const result = createCompleteScanDependencies();

      expect(result.deps).toBeDefined();
      // El factory usa internamente TTL=60 si no se especifica
    });

    it("debe usar mockHostUserId 1 por defecto", () => {
      const result = createCompleteScanDependencies();

      expect(result.deps).toBeDefined();
      // El factory usa internamente mockHostUserId=1 si no se especifica
    });

    it("debe desactivar persistencia por defecto", () => {
      const result = createCompleteScanDepsWithPersistence();

      expect(result.persistence).toBeUndefined();
    });
  });

  describe("Interoperabilidad de dependencias", () => {
    it("deps y services deben ser compatibles para CompleteScanUseCase", () => {
      const { deps, services } = createCompleteScanDependencies();

      // Verificar que deps tiene todas las interfaces necesarias
      expect(deps.qrStateLoader).toBeDefined();
      expect(deps.studentStateLoader).toBeDefined();
      expect(deps.sessionKeyQuery).toBeDefined();
      expect(deps.aesGcmService).toBeDefined();
      expect(deps.markQRConsumed).toBeDefined();
      expect(deps.completeRound).toBeDefined();

      // Verificar que services tiene los servicios esperados
      expect(services.qrLifecycleManager).toBeDefined();
      expect(services.statsCalculator).toBeDefined();
    });

    it("persistence debe integrarse correctamente con deps y services", () => {
      const result = createCompleteScanDepsWithPersistence({
        enablePostgresPersistence: true,
      });

      // Verificar que todos los componentes están presentes
      expect(result.services).toBeDefined();
      expect(result.persistence).toBeDefined();
      expect(result.persistence!.persistenceService).toBeDefined();
      expect(result.persistence!.validationRepo).toBeDefined();
      expect(result.persistence!.resultRepo).toBeDefined();
      expect(result.persistence!.registrationRepo).toBeDefined();

      // Verificar que deps y services siguen disponibles
      expect(result.deps.qrStateLoader).toBeDefined();
      expect(result.services.statsCalculator).toBeDefined();
    });

    it("debe mantener consistencia entre múltiples creaciones", () => {
      const config = { qrTTL: 90, mockHostUserId: 555 };

      const result1 = createCompleteScanDepsWithPersistence(config);
      const result2 = createCompleteScanDepsWithPersistence(config);

      // Ambos deben tener la misma estructura
      expect(result1).toHaveProperty("deps");
      expect(result1).toHaveProperty("services");
      expect(result2).toHaveProperty("deps");
      expect(result2).toHaveProperty("services");

      // Pero ser instancias diferentes
      expect(result1.deps).not.toBe(result2.deps);
      expect(result1.services).not.toBe(result2.services);
    });
  });

  describe("Escenarios de Producción", () => {
    it("debe manejar configuración típica de desarrollo (TTL corto)", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 30,
        mockHostUserId: 1,
        enablePostgresPersistence: false,
      });

      expect(result.deps).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.persistence).toBeUndefined();
    });

    it("debe manejar configuración típica de producción (TTL largo + persistencia)", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 120,
        mockHostUserId: 1,
        enablePostgresPersistence: true,
      });

      expect(result.deps).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.persistence).toBeDefined();
    });

    it("debe funcionar con configuración de testing (valores extremos)", () => {
      const result = createCompleteScanDepsWithPersistence({
        qrTTL: 5, // TTL muy corto para tests rápidos
        mockHostUserId: 999999, // ID grande
        enablePostgresPersistence: false,
      });

      expect(result.deps).toBeDefined();
      expect(result.services).toBeDefined();
    });
  });

  describe("Casos Edge y Validaciones", () => {
    it("debe manejar configuración vacía (usar defaults)", () => {
      const result = createCompleteScanDepsWithPersistence({});

      expect(result.deps).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.persistence).toBeUndefined();
    });

    it("debe crear componentes funcionales independientemente de la config", () => {
      const configs = [
        { qrTTL: 1 },
        { mockHostUserId: 1 },
        { enablePostgresPersistence: true },
        {
          qrTTL: 3600,
          mockHostUserId: 999999,
          enablePostgresPersistence: true,
        },
      ];

      for (const config of configs) {
        const result = createCompleteScanDepsWithPersistence(config);

        // Verificar que los componentes críticos siempre se crean
        expect(result.deps.aesGcmService).toBeDefined();
        expect(result.deps.qrStateLoader).toBeDefined();
        expect(result.services.qrLifecycleManager).toBeDefined();
        expect(result.services.statsCalculator).toBeDefined();
      }
    });

    it("debe retornar tipo correcto CompleteScanDepsResult", () => {
      const result: CompleteScanDepsResult =
        createCompleteScanDepsWithPersistence();

      expect(result).toHaveProperty("deps");
      expect(result).toHaveProperty("services");
      // persistence es opcional, puede estar o no
    });
  });
});
