/**
 * Legacy Context Store
 * Responsabilidad: Almacenar contexto de sesion recibido desde PHP legacy via postMessage
 * 
 * El contexto incluye informacion sobre:
 * - Tipo de usuario (PROFESOR/ALUMNO)
 * - Datos de sesion de asistencia
 * - Datos del curso
 * - Datos del bloque horario
 * - Datos del profesor
 * - Datos del alumno (si aplica)
 */

// Tipos basados en roseta.md

interface SesionContext {
  id: number;
  codigo: string;
  fecha: string;
  fechahoraInicio: string;
  fechahoraTermino: string;
  tipo: number;
}

interface CursoContext {
  id: number;
  nombre: string;
  codigo: string;
  seccion: string;
}

interface BloqueContext {
  id: number;
  nombre: string;
  horario: string;
}

interface ProfesorContext {
  id: number;
  nombre: string;
  email: string;
}

interface AlumnoContext {
  rut: string;
}

interface SemestreContext {
  id: number;
}

export interface LegacyContextProfesor {
  tipo: 'PROFESOR';
  sesion: SesionContext;
  curso: CursoContext;
  bloque: BloqueContext;
  profesor: ProfesorContext;
  semestre: SemestreContext;
}

export interface LegacyContextAlumno {
  tipo: 'ALUMNO';
  alumno: AlumnoContext;
  codigoQR: string;
}

export type LegacyContext = LegacyContextProfesor | LegacyContextAlumno;

type ContextCallback = (context: LegacyContext) => void;

export class LegacyContextStore {
  private context: LegacyContext | null;
  private readonly storageKey: string;
  private readonly onContextCallbacks: ContextCallback[];

  constructor() {
    this.context = null;
    this.storageKey = 'legacy_context';
    this.onContextCallbacks = [];
    this.loadFromStorage();
  }

  /**
   * Guarda el contexto recibido desde PHP legacy
   */
  save(context: LegacyContext): void {
    this.context = context;
    sessionStorage.setItem(this.storageKey, JSON.stringify(context));
    console.log('[LegacyContext] Contexto guardado:', context.tipo);
    this.notifyListeners();
  }

  /**
   * Obtiene el contexto almacenado
   */
  get(): LegacyContext | null {
    return this.context;
  }

  /**
   * Verifica si hay contexto disponible
   */
  hasContext(): boolean {
    return this.context !== null;
  }

  /**
   * Verifica si el usuario es profesor
   */
  isProfesor(): boolean {
    return this.context?.tipo === 'PROFESOR';
  }

  /**
   * Verifica si el usuario es alumno
   */
  isAlumno(): boolean {
    return this.context?.tipo === 'ALUMNO';
  }

  /**
   * Obtiene el contexto como profesor (con type guard)
   */
  getAsProfesor(): LegacyContextProfesor | null {
    if (this.context?.tipo === 'PROFESOR') {
      return this.context;
    }
    return null;
  }

  /**
   * Obtiene el contexto como alumno (con type guard)
   */
  getAsAlumno(): LegacyContextAlumno | null {
    if (this.context?.tipo === 'ALUMNO') {
      return this.context;
    }
    return null;
  }

  /**
   * Registra callback para cuando se reciba contexto
   */
  onContextReceived(callback: ContextCallback): void {
    this.onContextCallbacks.push(callback);
    if (this.context) {
      callback(this.context);
    }
  }

  /**
   * Limpia el contexto almacenado
   */
  clear(): void {
    this.context = null;
    sessionStorage.removeItem(this.storageKey);
    console.log('[LegacyContext] Contexto limpiado');
  }

  /**
   * Carga contexto desde sessionStorage si existe
   */
  private loadFromStorage(): void {
    const stored = sessionStorage.getItem(this.storageKey);
    if (stored) {
      try {
        this.context = JSON.parse(stored) as LegacyContext;
        console.log('[LegacyContext] Contexto recuperado de sessionStorage');
      } catch {
        console.warn('[LegacyContext] Error parseando contexto almacenado');
        sessionStorage.removeItem(this.storageKey);
      }
    }
  }

  /**
   * Notifica a los listeners registrados
   */
  private notifyListeners(): void {
    if (this.context) {
      this.onContextCallbacks.forEach(callback => callback(this.context!));
    }
  }
}
