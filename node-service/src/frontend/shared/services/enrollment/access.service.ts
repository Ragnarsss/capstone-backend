/**
 * AccessService (Frontend)
 * Cliente HTTP para GET /api/access/state
 * Responsabilidad: Obtener estado agregado de acceso del usuario
 *
 * NOTA: Servicio compartido usado por enrollment, guest y qr-reader features
 */

/**
 * Estado agregado del sistema de acceso (espejo del backend)
 */
export interface AccessState {
  state: 'NOT_ENROLLED' | 'ENROLLED_NO_SESSION' | 'READY' | 'BLOCKED';
  action: 'enroll' | 'login' | 'scan' | null;
  device?: { credentialId: string; deviceId: number };
  message?: string;
}

/**
 * DeviceFingerprintGenerator
 * 
 * Genera un fingerprint estable para identificar dispositivos móviles.
 * Optimizado para Android/iOS donde FIDO2 y captura QR son exclusivamente móviles.
 * 
 * Componentes seleccionados por estabilidad:
 * - Modelo del dispositivo (extraído de userAgent)
 * - Hardware: CPU cores, touch points
 * - Pantalla: dimensiones + pixel ratio (estables en móvil, no hay monitores externos)
 * - GPU: renderer WebGL (identificativo del modelo)
 * 
 * El fingerprint solo cambia cuando el usuario cambia de dispositivo físico,
 * lo cual es el comportamiento deseado para la política 1:1.
 */
export class DeviceFingerprintGenerator {
  /**
   * Genera fingerprint sincrónico (hash simple)
   * Usado por AccessService para consultas rápidas
   */
  static generate(): string {
    const components = this.collectComponents();
    return this.hashSimple(components.join('|'));
  }

  /**
   * Genera fingerprint asíncrono (SHA-256)
   * Usado por EnrollmentService para persistencia
   */
  static async generateAsync(): Promise<string> {
    const components = this.collectComponents();
    return this.hashSHA256(components.join('|'));
  }

  /**
   * Recolecta componentes estables del dispositivo
   */
  private static collectComponents(): string[] {
    return [
      // Modelo del dispositivo (muy estable en móviles)
      this.extractDeviceModel(),
      
      // Hardware
      String(navigator.hardwareConcurrency || 'unknown'),
      String(navigator.maxTouchPoints || 0),
      
      // Pantalla (estable en móvil - no hay monitores externos)
      String(screen.width),
      String(screen.height),
      String(window.devicePixelRatio || 1),
      String(screen.colorDepth),
      
      // GPU (identificativo del modelo de dispositivo)
      this.getWebGLRenderer(),
    ];
  }

  /**
   * Extrae el modelo del dispositivo desde userAgent
   * Android: "SM-G998B", "Pixel 7", etc.
   * iOS: "iPhone-390x844" (modelo oculto, usamos dimensiones como proxy)
   */
  private static extractDeviceModel(): string {
    const ua = navigator.userAgent;
    
    // Android: buscar modelo entre paréntesis
    // Ej: "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit..."
    const androidMatch = ua.match(/\(Linux; Android [^;]+; ([^)]+)\)/);
    if (androidMatch) {
      return `android:${androidMatch[1].trim()}`;
    }
    
    // Android alternativo: algunos reportan diferente
    const androidAlt = ua.match(/Android[^;]*;\s*([^)]+)\)/);
    if (androidAlt) {
      return `android:${androidAlt[1].trim()}`;
    }
    
    // iOS: el modelo exacto está oculto por privacidad
    // Usamos dimensiones como proxy (cada iPhone tiene dimensiones únicas)
    if (ua.includes('iPhone')) {
      return `iPhone-${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`;
    }
    if (ua.includes('iPad')) {
      return `iPad-${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`;
    }
    
    // Fallback: usar platform + dimensiones
    return `${navigator.platform || 'unknown'}-${screen.width}x${screen.height}`;
  }

  /**
   * Obtiene el renderer WebGL (GPU del dispositivo)
   * Muy identificativo: cada modelo de celular tiene GPU específica
   */
  private static getWebGLRenderer(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl || !(gl instanceof WebGLRenderingContext)) {
        return 'no-webgl';
      }
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) {
        return 'no-debug-info';
      }
      
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      return renderer ? String(renderer) : 'unknown-renderer';
    } catch {
      return 'webgl-error';
    }
  }

  /**
   * Hash simple para uso sincrónico
   */
  private static hashSimple(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Hash SHA-256 para uso asíncrono (más seguro para persistencia)
   */
  private static async hashSHA256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
  }
}

/**
 * AccessService
 * Cliente para el Access Gateway endpoint
 */
export class AccessService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      // Auto-detectar si estamos embebidos en PHP o acceso directo a Node
      const isEmbeddedInPhp =
        window.location.port === '9500' ||
        window.location.port === '9505' ||
        window.location.port === '';
      this.baseUrl = isEmbeddedInPhp ? '/minodo-api/access' : '/api/access';
    }
  }

  /**
   * Obtiene el estado agregado del usuario
   *
   * Llama a GET /api/access/state?deviceFingerprint={fingerprint}
   * El backend determina el estado basándose en:
   * 1. Restricciones activas
   * 2. Enrollment de dispositivo + validacion 1:1 con deviceFingerprint
   * 3. Sesión activa
   *
   * @returns Estado agregado del sistema
   * @throws Error si la solicitud falla
   */
  async getState(): Promise<AccessState> {
    try {
      // Generar huella del dispositivo actual
      const deviceFingerprint = DeviceFingerprintGenerator.generate();

      // Pasar deviceFingerprint al servidor para validacion 1:1
      const url = new URL(`${this.baseUrl}/state`, window.location.origin);
      url.searchParams.set('deviceFingerprint', deviceFingerprint);

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const state: AccessState = await response.json();
      return state;
    } catch (error) {
      console.error('[AccessService] Error fetching access state:', error);
      throw error;
    }
  }
}
