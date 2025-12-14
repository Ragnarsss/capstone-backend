/**
 * Guest Application - Main Entry Point
 * State Machine para flujo de estudiante: enrollment → login → scanner → attendance
 * 
 * Arquitectura SoC:
 * - main.ts: Orquestador (State Machine)
 * - modules/enrollment: EnrollmentService, LoginService, SessionKeyStore
 * - modules/scanner: ScannerService, CameraService
 * - modules/attendance: AttendanceService
 * - modules/communication: ParentMessenger
 */

console.log('[Guest] ====== main.ts LOADING ======');
console.log('[Guest] Location:', window.location.href);
console.log('[Guest] Parent:', window.parent !== window ? 'in iframe' : 'top window');

import { AuthClient } from '../../shared/auth/auth-client';
import { EnrollmentService } from './modules/enrollment/enrollment.service';
import { LoginService, getLoginService } from './modules/enrollment/login.service';
import { getSessionKeyStore } from './modules/enrollment/session-key.store';
import { ScannerService, getScannerService } from './modules/scanner/scanner.service';
import { AttendanceService, getAttendanceService } from './modules/attendance/attendance.service';
import { ParentMessenger, getParentMessenger } from './modules/communication/parent-messenger';

console.log('[Guest] Imports completed successfully');

// Estados de la aplicación
type AppState = 
  | 'INIT'
  | 'CHECKING_ENROLLMENT'
  | 'NO_ENROLLED'
  | 'ENROLLING'
  | 'ENROLLMENT_SUCCESS'
  | 'PENALTY_WAIT'
  | 'LOGGING_IN'
  | 'READY_TO_SCAN'
  | 'SCANNING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'ERROR';

interface UserInfo {
  userId: number;
  username: string;
  displayName: string;
}

interface EnrollmentResult {
  deviceId: number;
  penaltyMinutes: number;
}

class GuestApplication {
  private currentState: AppState = 'INIT';
  
  // Servicios (inyección de dependencias)
  private authClient: AuthClient;
  private enrollmentService: EnrollmentService;
  private loginService: LoginService;
  private scannerService: ScannerService;
  private attendanceService: AttendanceService;
  private parentMessenger: ParentMessenger;
  
  // Estado de la aplicación
  private userInfo: UserInfo | null = null;
  private errorMessage: string = '';
  private lastEnrollmentResult: EnrollmentResult | null = null;
  private currentSessionId: string | null = null;

  constructor() {
    // Inicializar servicios
    this.authClient = new AuthClient();
    this.enrollmentService = new EnrollmentService();
    this.loginService = getLoginService();
    this.scannerService = getScannerService();
    this.attendanceService = getAttendanceService();
    this.parentMessenger = getParentMessenger();
  }

  async initialize(): Promise<void> {
    console.log('[Guest] Inicializando aplicación...');
    
    // Verificar soporte WebAuthn
    if (!this.enrollmentService.isWebAuthnAvailable()) {
      this.showError('Tu navegador no soporta WebAuthn. Usa Chrome, Firefox, Safari o Edge actualizado.');
      return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Inicializar auth client
    this.authClient.initialize();

    // Verificar si ya está autenticado
    if (this.authClient.isUserAuthenticated()) {
      await this.handleAuthenticated();
    } else {
      // Esperar autenticación
      this.authClient.onAuthenticated(async () => {
        await this.handleAuthenticated();
      });
    }
  }

  private setupEventListeners(): void {
    // Botones de enrollment
    document.getElementById('btn-start-enrollment')?.addEventListener('click', () => this.startEnrollment());
    
    // Botón post-enrollment
    document.getElementById('btn-close-return')?.addEventListener('click', () => this.handleCloseAndReturn());
    
    // Botones de scanner
    document.getElementById('btn-start-scanner')?.addEventListener('click', () => this.startScanning());
    document.getElementById('btn-stop-scanner')?.addEventListener('click', () => this.stopScanning());
    
    // Botón de retry
    document.getElementById('btn-retry')?.addEventListener('click', () => this.retry());
    
    // Escuchar mensajes del padre
    this.parentMessenger.on('CLOSE_CONFIRMED', () => {
      console.log('[Guest] Parent confirmó cierre');
    });
  }

  private async handleAuthenticated(): Promise<void> {
    console.log('[Guest] Usuario autenticado');
    
    const token = this.authClient.getToken();
    if (!token) {
      this.showError('No se pudo obtener el token de autenticación');
      return;
    }

    // Decodificar JWT para obtener info del usuario
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.userInfo = {
        userId: payload.userId,
        username: payload.username,
        displayName: payload.nombreCompleto || payload.username,
      };

      // Mostrar info del usuario
      this.updateUserInfo();
    } catch (e) {
      console.error('[Guest] Error decodificando token:', e);
    }

    // Verificar estado de enrollment
    await this.checkEnrollmentStatus();
  }

  private updateUserInfo(): void {
    const userNameEl = document.getElementById('user-name');
    const userInfoEl = document.getElementById('user-info');
    
    if (userNameEl && this.userInfo) {
      userNameEl.textContent = this.userInfo.displayName;
    }
    if (userInfoEl) {
      userInfoEl.classList.remove('hidden');
    }
  }

  private async checkEnrollmentStatus(): Promise<void> {
    this.transitionTo('CHECKING_ENROLLMENT');
    
    const token = this.authClient.getToken();
    if (!token) {
      this.showError('Sesión expirada. Por favor recarga la página.');
      return;
    }

    try {
      const devices = await this.enrollmentService.getDevices(token);
      console.log('[Guest] Dispositivos:', devices);

      // Actualizar contador de dispositivos
      const deviceCountEl = document.getElementById('device-count');
      if (deviceCountEl) {
        deviceCountEl.textContent = devices.deviceCount.toString();
      }

      if (devices.deviceCount > 0) {
        // Tiene dispositivos, verificar si tiene session_key
        const sessionKeyStore = getSessionKeyStore();
        
        if (sessionKeyStore.hasSessionKey()) {
          // Ya tiene session key válida
          this.transitionTo('READY_TO_SCAN');
        } else {
          // Necesita hacer login ECDH
          await this.performLogin();
        }
      } else {
        // No tiene dispositivos, necesita enrollment
        this.transitionTo('NO_ENROLLED');
      }
    } catch (error) {
      console.error('[Guest] Error obteniendo estado:', error);
      this.showError('Error al verificar estado de registro');
    }
  }

  private async startEnrollment(): Promise<void> {
    const token = this.authClient.getToken();
    if (!token) {
      this.showError('Sesión expirada');
      return;
    }

    this.transitionTo('ENROLLING');
    this.updateEnrollingMessage('Preparando registro...');

    try {
      // 1. Obtener opciones de enrollment del servidor
      this.updateEnrollingMessage('Generando desafío de seguridad...');
      const startResponse = await this.enrollmentService.startEnrollment(token);
      
      // 2. Solicitar credencial al usuario via WebAuthn
      this.updateEnrollingMessage('Usa tu huella digital o método biométrico...');
      
      const credential = await navigator.credentials.create({
        publicKey: startResponse.options,
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('No se creó la credencial');
      }

      // 3. Generar fingerprint del dispositivo
      this.updateEnrollingMessage('Completando registro...');
      const fingerprint = await this.enrollmentService.generateDeviceFingerprint();

      // 4. Enviar credencial al servidor
      const finishResponse = await this.enrollmentService.finishEnrollment(
        token,
        credential,
        fingerprint
      );

      console.log('[Guest] Enrollment completado:', finishResponse);

      // 5. Guardar resultado y mostrar éxito
      this.lastEnrollmentResult = {
        deviceId: finishResponse.deviceId,
        penaltyMinutes: finishResponse.penaltyInfo?.nextDelayMinutes || 0,
      };

      // Mostrar pantalla de éxito con penalización
      this.showEnrollmentSuccess(this.lastEnrollmentResult);

    } catch (error: unknown) {
      console.error('[Guest] Error en enrollment:', error);
      
      let message = 'Error al registrar dispositivo';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          message = 'Operación cancelada o tiempo agotado';
        } else if (error.name === 'InvalidStateError') {
          message = 'Este dispositivo ya está registrado';
        } else if (error.name === 'NotSupportedError') {
          message = 'Tu dispositivo no soporta este método de autenticación';
        } else if (error.message?.includes('PENALTY_ACTIVE')) {
          // Extraer minutos de penalización del mensaje
          const match = error.message.match(/esperar (\d+) minutos/);
          if (match) {
            this.showPenaltyWait(parseInt(match[1], 10));
            return;
          }
          message = error.message.replace('PENALTY_ACTIVE: ', '');
        } else {
          message = error.message;
        }
      }
      
      this.showError(message);
    }
  }

  private showEnrollmentSuccess(result: EnrollmentResult): void {
    this.transitionTo('ENROLLMENT_SUCCESS');
    
    const messageEl = document.getElementById('enrollment-success-message');
    const penaltyEl = document.getElementById('penalty-info');
    
    if (messageEl) {
      messageEl.textContent = `¡Dispositivo #${result.deviceId} registrado correctamente!`;
    }
    
    if (penaltyEl) {
      if (result.penaltyMinutes > 0) {
        penaltyEl.textContent = `Por seguridad, debes esperar ${result.penaltyMinutes} minutos antes de poder marcar asistencia.`;
        penaltyEl.classList.remove('hidden');
      } else {
        penaltyEl.classList.add('hidden');
      }
    }

    // Notificar al padre
    this.parentMessenger.notifyEnrollmentComplete({
      deviceId: result.deviceId,
      penaltyMinutes: result.penaltyMinutes,
      message: 'Enrollment completado exitosamente',
    });
  }

  private showPenaltyWait(minutes: number): void {
    this.transitionTo('PENALTY_WAIT');
    
    const minutesEl = document.getElementById('penalty-minutes');
    if (minutesEl) {
      minutesEl.textContent = minutes.toString();
    }
  }

  private handleCloseAndReturn(): void {
    console.log('[Guest] Usuario solicitó cerrar y volver');
    this.parentMessenger.requestClose('enrollment_complete');
    
    // Si no estamos en iframe, intentar cerrar la ventana
    if (!this.parentMessenger.isEmbedded()) {
      window.close();
    }
  }

  private async performLogin(): Promise<void> {
    this.transitionTo('LOGGING_IN');
    
    const token = this.authClient.getToken();
    if (!token) {
      this.showError('Sesión expirada');
      return;
    }

    try {
      // Obtener dispositivos para conseguir credentialId
      const devices = await this.enrollmentService.getDevices(token);
      
      if (!devices.devices || devices.devices.length === 0) {
        this.transitionTo('NO_ENROLLED');
        return;
      }

      // Usar el primer dispositivo disponible
      const device = devices.devices[0];
      console.log('[Guest] Realizando login ECDH con dispositivo:', device.deviceId);

      const loginResult = await this.loginService.performLogin(token, device.credentialId);

      if (!loginResult.success) {
        throw new Error(loginResult.error || 'Error en login');
      }

      console.log('[Guest] Login ECDH exitoso');
      this.transitionTo('READY_TO_SCAN');

    } catch (error) {
      console.error('[Guest] Error en login:', error);
      this.showError(error instanceof Error ? error.message : 'Error al iniciar sesión');
    }
  }

  private async startScanning(): Promise<void> {
    // Verificar sesión activa primero
    const activeSession = await this.attendanceService.getActiveSession();
    
    if (!activeSession.hasActiveSession) {
      this.showError(activeSession.message || 'No hay clase activa en este momento');
      return;
    }

    this.currentSessionId = activeSession.sessionId || null;
    console.log('[Guest] Sesión activa:', this.currentSessionId);

    // Registrar participación
    if (this.currentSessionId && this.userInfo) {
      const registerResult = await this.attendanceService.register(
        this.currentSessionId,
        this.userInfo.userId
      );

      if (!registerResult.success) {
        this.showError(registerResult.message);
        return;
      }
    }

    this.transitionTo('SCANNING');
    
    try {
      await this.scannerService.start(
        'scanner-video',
        async (detection) => {
          await this.handleQRDetection(detection.text);
        },
        (error) => {
          console.error('[Guest] Error en scanner:', error);
          this.showError(error);
        }
      );
    } catch (error) {
      console.error('[Guest] Error iniciando scanner:', error);
      this.showError(error instanceof Error ? error.message : 'Error al iniciar cámara');
    }
  }

  private async handleQRDetection(encryptedText: string): Promise<void> {
    if (this.currentState === 'VALIDATING') {
      return; // Evitar validaciones múltiples
    }

    if (!this.userInfo) return;

    const result = await this.attendanceService.processQR(encryptedText, this.userInfo.userId);
    
    if (result === null) {
      // QR no es para nosotros, ignorar
      return;
    }

    this.transitionTo('VALIDATING');
    this.updateScanStatus(result.message);

    if (result.valid) {
      if (result.status === 'completed') {
        // Asistencia completada
        this.scannerService.stop();
        this.transitionTo('COMPLETED');
        
        // Notificar al padre
        this.parentMessenger.notifyAttendanceComplete({
          sessionId: result.sessionId || '',
          status: 'PRESENT',
          certainty: 85, // TODO: obtener del resultado real
        });
      } else {
        // Round parcial completado
        this.updateScanStatus(`Ronda completada. Busca el siguiente QR...`);
        setTimeout(() => {
          this.transitionTo('SCANNING');
        }, 1500);
      }
    } else {
      // Error en validación
      this.updateScanStatus(result.message);
      setTimeout(() => {
        this.transitionTo('SCANNING');
      }, 2000);
    }
  }

  private updateScanStatus(message: string): void {
    const statusEl = document.getElementById('scan-status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  private stopScanning(): void {
    this.scannerService.stop();
    this.transitionTo('READY_TO_SCAN');
  }

  private retry(): void {
    this.checkEnrollmentStatus();
  }

  private showError(message: string): void {
    this.errorMessage = message;
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
      errorEl.textContent = message;
    }
    this.transitionTo('ERROR');
  }

  private updateEnrollingMessage(message: string): void {
    const el = document.getElementById('enrolling-message');
    if (el) {
      el.textContent = message;
    }
  }

  private transitionTo(newState: AppState): void {
    console.log(`[Guest] Transición: ${this.currentState} → ${newState}`);
    
    // Ocultar todos los estados
    document.querySelectorAll('.state-view').forEach(el => {
      el.classList.remove('active');
    });

    // Mapear estado a ID de elemento
    const stateIdMap: Record<AppState, string> = {
      'INIT': 'state-init',
      'CHECKING_ENROLLMENT': 'state-checking-enrollment',
      'NO_ENROLLED': 'state-no-enrolled',
      'ENROLLING': 'state-enrolling',
      'ENROLLMENT_SUCCESS': 'state-enrollment-success',
      'PENALTY_WAIT': 'state-penalty-wait',
      'LOGGING_IN': 'state-logging-in',
      'READY_TO_SCAN': 'state-ready-to-scan',
      'SCANNING': 'state-scanning',
      'VALIDATING': 'state-validating',
      'COMPLETED': 'state-completed',
      'ERROR': 'state-error',
    };

    const stateId = stateIdMap[newState];
    const stateEl = document.getElementById(stateId);
    if (stateEl) {
      stateEl.classList.add('active');
    }

    this.currentState = newState;
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const app = new GuestApplication();
  app.initialize();
});
