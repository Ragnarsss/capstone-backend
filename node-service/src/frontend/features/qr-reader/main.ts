/**
 * QR Reader Application
 * Responsabilidad: Bootstrap del feature lectura QR
 * 
 * Flujo:
 * 1. Usuario abre /reader/
 * 2. Se autentica (JWT via postMessage)
 * 3. Verifica enrollment:
 *    - No enrolado → Mostrar UI enrollment inline
 *    - Enrolado sin session_key → Trigger login ECDH
 *    - Enrolado con session_key → Mostrar boton registrar
 * 4. Presiona "Registrar Asistencia"
 * 5. Backend verifica si hay sesion activa
 * 6. Si hay → Registra y activa camara
 * 7. Si no hay → Muestra mensaje "No hay clase activa"
 */
import { AuthClient } from '../../shared/auth/auth-client';
import { CameraViewComponent } from './ui/camera-view.component';
import { CameraManager } from './services/camera-manager';
import { QRScanService } from './services/qr-scan.service';
import { AttendanceApiClient } from './services/attendance-api.client';
import { decryptQR, encryptPayload, MOCK_SESSION_KEY } from '../../shared/crypto';
import { LegacyBridge } from '../../shared/services/legacy-bridge.service';
import { LegacyContextStore } from '../../shared/stores/legacy-context.store';
import {
  EnrollmentService,
  LoginService,
  SessionKeyStore,
  AccessService,
  type AccessState,
} from '../../shared/services/enrollment';

// Exponer helpers de debug en desarrollo
declare global {
  interface Window {
    __DEBUG__?: {
      decryptQR: typeof decryptQR;
      encryptPayload: typeof encryptPayload;
      MOCK_KEY: string;
    };
  }
}

class QRReaderApplication {
  private authClient: AuthClient;
  private scanService: QRScanService;
  private attendanceApi: AttendanceApiClient;
  private legacyBridge: LegacyBridge;
  private contextStore: LegacyContextStore;
  private enrollmentService: EnrollmentService;
  private loginService: LoginService;
  private sessionKeyStore: SessionKeyStore;
  private accessService: AccessService;
  
  // UI Elements - Enrollment
  private enrollmentSection: HTMLElement | null = null;
  private enrollBtn: HTMLButtonElement | null = null;
  private enrollmentMessage: HTMLElement | null = null;
  
  // UI Elements - Login
  private loginSection: HTMLElement | null = null;
  private loginBtn: HTMLButtonElement | null = null;
  private loginMessage: HTMLElement | null = null;
  
  // UI Elements - Register
  private registerBtn: HTMLButtonElement | null = null;
  private registerMessage: HTMLElement | null = null;
  private registerSection: HTMLElement | null = null;
  private scanSection: HTMLElement | null = null;
  private statusElement: HTMLElement | null = null;

  constructor() {
    this.authClient = new AuthClient();
    this.contextStore = new LegacyContextStore();
    this.legacyBridge = new LegacyBridge(this.authClient, this.contextStore);
    this.attendanceApi = new AttendanceApiClient();
    this.enrollmentService = new EnrollmentService();
    this.loginService = new LoginService(this.authClient);
    this.sessionKeyStore = new SessionKeyStore();
    this.accessService = new AccessService(() => this.authClient.getToken());
    const component = new CameraViewComponent();
    const cameraManager = new CameraManager('camera-feed');
    this.scanService = new QRScanService(component, cameraManager, this.authClient, this.attendanceApi);
  }

  initialize(): void {
    // Obtener elementos UI - Enrollment
    this.enrollmentSection = document.getElementById('enrollment-section');
    this.enrollBtn = document.getElementById('enroll-btn') as HTMLButtonElement;
    this.enrollmentMessage = document.getElementById('enrollment-message');
    
    // Obtener elementos UI - Login
    this.loginSection = document.getElementById('login-section');
    this.loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
    this.loginMessage = document.getElementById('login-message');
    
    // Obtener elementos UI - Register/Scan
    this.registerBtn = document.getElementById('register-btn') as HTMLButtonElement;
    this.registerMessage = document.getElementById('register-message');
    this.registerSection = document.getElementById('register-section');
    this.scanSection = document.getElementById('scan-section');
    this.statusElement = document.getElementById('scanner-status');
    
    // Inicializar bridge para comunicacion con PHP legacy
    this.legacyBridge.initialize();
    
    // Configurar scan service
    this.scanService.initialize();
    
    // Configurar event listeners
    this.enrollBtn?.addEventListener('click', () => this.handleEnrollClick());
    this.loginBtn?.addEventListener('click', () => this.handleLoginClick());
    this.registerBtn?.addEventListener('click', () => this.handleRegisterClick());

    // Iniciar autenticacion
    this.authClient.initialize();

    // SIEMPRE esperar al evento AUTH_TOKEN del host PHP.
    // El sessionStorage puede tener un token obsoleto de otro usuario.
    // El host PHP enviará el token del usuario ACTUAL via postMessage.
    // El callback se dispara cuando llega AUTH_TOKEN, momento en que
    // AuthClient ya habrá detectado cambio de usuario y limpiado el estado anterior.
    this.authClient.onAuthenticated(() => this.handleAuthReady());

    // Registrar helpers de debug en desarrollo
    if (import.meta.env.DEV) {
      window.__DEBUG__ = {
        decryptQR,
        encryptPayload,
        MOCK_KEY: MOCK_SESSION_KEY,
      };
      console.log('[QRReader] Modo desarrollo - Helpers de debug disponibles:');
      console.log('  window.__DEBUG__.decryptQR(encryptedString)');
      console.log('  window.__DEBUG__.encryptPayload(plaintext)');
      console.log('  window.__DEBUG__.MOCK_KEY');
    }
  }

  private async handleAuthReady(): Promise<void> {
    console.log('[QRReader] Autenticacion lista');
    
    // Log contexto si esta disponible (viene de PHP legacy)
    if (this.contextStore.hasContext()) {
      const ctx = this.contextStore.getAsAlumno();
      if (ctx) {
        console.log('[QRReader] Contexto alumno - codigoQR:', ctx.codigoQR);
      }
    }
    
    this.updateStatus('Verificando dispositivo...');
    
    // Verificar enrollment
    await this.checkEnrollmentStatus();
  }

  /**
   * Verifica estado de enrollment y muestra UI apropiada
   * 
   * REFACTORIZADO (Fase 21.2): Usa Access Gateway en lugar de verificacion local
   * El Access Gateway valida deviceFingerprint y politica 1:1 automaticamente
   */
  private async checkEnrollmentStatus(): Promise<void> {
    try {
      // Verificar si WebAuthn esta soportado
      if (!this.enrollmentService.isWebAuthnSupported()) {
        this.updateStatus('Navegador no soportado');
        this.showEnrollmentSection();
        this.showEnrollmentMessage('Tu navegador no soporta autenticacion biometrica', 'error');
        return;
      }

      // Consultar Access Gateway con deviceFingerprint
      const accessState = await this.accessService.getState();
      console.log('[QRReader] Access Gateway state:', accessState);

      // Mapear estado del Access Gateway a UI
      switch (accessState.state) {
        case 'NOT_ENROLLED':
          // Usuario no tiene dispositivo enrollado O dispositivo actual pertenece a otro usuario
          this.showEnrollmentSection();
          if (accessState.message) {
            this.showEnrollmentMessage(accessState.message, 'info');
          }
          break;

        case 'ENROLLED_NO_SESSION':
          // Usuario enrollado pero sin session_key → necesita login ECDH
          this.showLoginSection(accessState.device);
          break;

        case 'READY':
          // Usuario listo para registrar asistencia
          this.showReadyState();
          break;

        case 'BLOCKED':
          // Usuario bloqueado por restricciones
          this.updateStatus('Acceso bloqueado');
          this.showEnrollmentSection();
          this.showEnrollmentMessage(
            accessState.message || 'Tu cuenta esta temporalmente bloqueada',
            'error'
          );
          break;

        default:
          throw new Error(`Estado desconocido: ${accessState.state}`);
      }
    } catch (error) {
      console.error('[QRReader] Error verificando enrollment:', error);
      this.updateStatus('Error al verificar dispositivo');
      this.showEnrollmentSection();
      this.showEnrollmentMessage('Error al verificar estado del dispositivo', 'error');
    }
  }

  /**
   * Muestra seccion de enrollment
   */
  private showEnrollmentSection(): void {
    this.hideAllSections();
    if (this.enrollmentSection) {
      this.enrollmentSection.style.display = 'block';
    }
    if (this.enrollBtn) {
      this.enrollBtn.disabled = false;
    }
    this.updateStatus('Vincula tu dispositivo');
  }

  /**
   * Muestra seccion de login ECDH
   */
  private showLoginSection(device?: { credentialId: string; deviceId: number }): void {
    this.hideAllSections();
    if (this.loginSection) {
      this.loginSection.style.display = 'block';
    }
    if (this.loginBtn) {
      this.loginBtn.disabled = false;
      // Guardar credentialId para login
      if (device?.credentialId) {
        this.loginBtn.dataset.credentialId = device.credentialId;
      }
    }
    this.updateStatus('Inicia sesion para continuar');
  }

  /**
   * Muestra estado listo para registrar asistencia
   */
  private showReadyState(): void {
    this.hideAllSections();
    if (this.registerSection) {
      this.registerSection.style.display = 'block';
    }
    if (this.registerBtn) {
      this.registerBtn.disabled = false;
    }
    this.updateStatus('Listo para registrar asistencia');
  }

  /**
   * Oculta todas las secciones
   */
  private hideAllSections(): void {
    if (this.enrollmentSection) this.enrollmentSection.style.display = 'none';
    if (this.loginSection) this.loginSection.style.display = 'none';
    if (this.registerSection) this.registerSection.style.display = 'none';
    if (this.scanSection) this.scanSection.style.display = 'none';
  }

  /**
   * Maneja click en boton de enrollment
   */
  private async handleEnrollClick(): Promise<void> {
    if (!this.enrollBtn) return;
    
    this.enrollBtn.disabled = true;
    this.showEnrollmentMessage('Iniciando vinculacion...', 'info');

    try {
      // Paso 1: Iniciar enrollment - obtener opciones WebAuthn
      console.log('[QRReader] Iniciando enrollment...');
      const startResult = await this.enrollmentService.startEnrollment();
      
      if (!startResult.success || !startResult.options) {
        this.showEnrollmentMessage(startResult.error || 'Error al iniciar enrollment', 'error');
        this.enrollBtn.disabled = false;
        return;
      }
      console.log('[QRReader] Opciones recibidas, challenge:', startResult.options.challenge?.substring(0, 20));

      // Paso 2: Crear credencial con WebAuthn (biometría/PIN)
      this.showEnrollmentMessage('Esperando biometría o PIN...', 'info');
      console.log('[QRReader] Creando credencial WebAuthn...');
      const credential = await this.enrollmentService.createCredential(startResult.options);
      console.log('[QRReader] Credencial creada, id:', credential?.id?.substring(0, 20));

      // Paso 3: Completar enrollment enviando credencial al servidor
      this.showEnrollmentMessage('Verificando credencial...', 'info');
      const finishResult = await this.enrollmentService.finishEnrollment(credential);
      
      if (!finishResult.success) {
        this.showEnrollmentMessage(finishResult.error || 'Error al completar enrollment', 'error');
        this.enrollBtn.disabled = false;
        return;
      }

      this.showEnrollmentMessage('Dispositivo vinculado exitosamente', 'success');
      console.log('[QRReader] Enrollment exitoso, credentialId:', finishResult.credentialId);

      // Ahora hacer login ECDH para obtener session_key
      if (finishResult.credentialId) {
        await this.performLogin(finishResult.credentialId);
      }
    } catch (error) {
      console.error('[QRReader] Error en enrollment:', error);
      this.showEnrollmentMessage('Error durante la vinculacion', 'error');
      this.enrollBtn.disabled = false;
    }
  }

  /**
   * Maneja click en boton de login
   */
  private async handleLoginClick(): Promise<void> {
    if (!this.loginBtn) return;
    
    const credentialId = this.loginBtn.dataset.credentialId;
    if (!credentialId) {
      this.showLoginMessage('No hay credencial disponible', 'error');
      return;
    }

    this.loginBtn.disabled = true;
    this.showLoginMessage('Iniciando sesion...', 'info');

    await this.performLogin(credentialId);
  }

  /**
   * Realiza login ECDH para obtener session_key
   */
  private async performLogin(credentialId: string): Promise<void> {
    try {
      const result = await this.loginService.performLogin(credentialId);
      
      if (!result.success || !result.sessionKey || !result.totpu) {
        this.showLoginMessage(result.error || 'Error en login', 'error');
        if (this.loginBtn) this.loginBtn.disabled = false;
        return;
      }

      // LoginService ya almacenó las session keys (sessionKey + hmacKey)
      console.log('[QRReader] Login exitoso, session keys almacenadas');

      // Mostrar estado listo
      this.showReadyState();
    } catch (error) {
      console.error('[QRReader] Error en login:', error);
      this.showLoginMessage('Error durante el inicio de sesion', 'error');
      if (this.loginBtn) this.loginBtn.disabled = false;
    }
  }

  /**
   * Maneja click en "Registrar Asistencia"
   */
  private async handleRegisterClick(): Promise<void> {
    if (!this.registerBtn) return;
    
    // Deshabilitar boton mientras procesa
    this.registerBtn.disabled = true;
    this.showMessage('Buscando clase activa...', 'info');
    
    // Consultar sesion activa
    const session = await this.attendanceApi.getActiveSession();
    
    if (!session.hasActiveSession || !session.sessionId) {
      this.showMessage(session.message || 'No hay clase activa en este momento', 'error');
      this.registerBtn.disabled = false;
      return;
    }
    
    // Hay sesion activa - registrar estudiante
    this.showMessage(`Registrando en clase de ${session.hostUsername}...`, 'info');
    
    const studentId = this.authClient.getUserId();
    if (!studentId) {
      this.showMessage('Error: No hay usuario autenticado', 'error');
      this.registerBtn.disabled = false;
      return;
    }
    
    const result = await this.attendanceApi.registerParticipation(session.sessionId, studentId);
    
    if (!result.success) {
      this.showMessage(result.message || 'Error al registrar', 'error');
      this.registerBtn.disabled = false;
      return;
    }
    
    // Exito - mostrar seccion de escaneo
    console.log(`[QRReader] Registrado OK. Round inicial: ${result.currentRound}`);
    this.showMessage(`Registrado! Round ${result.currentRound}. Escanea tu QR.`, 'success');
    
    // Pasar a la seccion de escaneo
    this.showScanSection();
    this.scanService.markAuthReady();
  }

  /**
   * Muestra la seccion de escaneo y oculta el registro
   */
  private showScanSection(): void {
    this.hideAllSections();
    if (this.scanSection) {
      this.scanSection.style.display = 'block';
    }
    this.updateStatus('Busca tu codigo QR en pantalla');
  }

  /**
   * Muestra mensaje de enrollment
   */
  private showEnrollmentMessage(text: string, type: 'info' | 'success' | 'error'): void {
    if (!this.enrollmentMessage) return;
    this.enrollmentMessage.textContent = text;
    this.enrollmentMessage.className = `scanner__message scanner__message--${type}`;
  }

  /**
   * Muestra mensaje de login
   */
  private showLoginMessage(text: string, type: 'info' | 'success' | 'error'): void {
    if (!this.loginMessage) return;
    this.loginMessage.textContent = text;
    this.loginMessage.className = `scanner__message scanner__message--${type}`;
  }

  /**
   * Muestra mensaje de estado (register section)
   */
  private showMessage(text: string, type: 'info' | 'success' | 'error'): void {
    if (!this.registerMessage) return;
    this.registerMessage.textContent = text;
    this.registerMessage.className = `scanner__message scanner__message--${type}`;
  }

  /**
   * Actualiza el estado principal
   */
  private updateStatus(text: string): void {
    if (this.statusElement) {
      this.statusElement.textContent = text;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new QRReaderApplication();
  app.initialize();
});
