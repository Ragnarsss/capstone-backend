/**
 * Guest Application - Main Entry Point
 * State Machine para flujo de estudiante: enrollment → scanner → attendance
 */

console.log('[Guest] ====== main.ts LOADING ======');
console.log('[Guest] Location:', window.location.href);
console.log('[Guest] Parent:', window.parent !== window ? 'in iframe' : 'top window');

import { AuthClient } from '../../shared/auth/auth-client';
import { EnrollmentService } from './modules/enrollment/enrollment.service';

console.log('[Guest] Imports completed successfully');

// Estados de la aplicación
type AppState = 
  | 'INIT'
  | 'NO_ENROLLED'
  | 'ENROLLING'
  | 'ENROLLED'
  | 'SCANNING'
  | 'COMPLETED'
  | 'ERROR';

interface UserInfo {
  userId: number;
  username: string;
  displayName: string;
}

class GuestApplication {
  private currentState: AppState = 'INIT';
  private authClient: AuthClient;
  private enrollmentService: EnrollmentService;
  private userInfo: UserInfo | null = null;
  private errorMessage: string = '';

  // DOM Elements
  private elements: {
    userInfo: HTMLElement;
    userName: HTMLElement;
    btnStartEnrollment: HTMLButtonElement;
    btnStartScanner: HTMLButtonElement;
    btnStopScanner: HTMLButtonElement;
    btnRetry: HTMLButtonElement;
    enrollingMessage: HTMLElement;
    errorMessageEl: HTMLElement;
    deviceCount: HTMLElement;
  };

  constructor() {
    this.authClient = new AuthClient();
    this.enrollmentService = new EnrollmentService();
    this.elements = this.getElements();
  }

  private getElements() {
    return {
      userInfo: document.getElementById('user-info')!,
      userName: document.getElementById('user-name')!,
      btnStartEnrollment: document.getElementById('btn-start-enrollment') as HTMLButtonElement,
      btnStartScanner: document.getElementById('btn-start-scanner') as HTMLButtonElement,
      btnStopScanner: document.getElementById('btn-stop-scanner') as HTMLButtonElement,
      btnRetry: document.getElementById('btn-retry') as HTMLButtonElement,
      enrollingMessage: document.getElementById('enrolling-message')!,
      errorMessageEl: document.getElementById('error-message')!,
      deviceCount: document.getElementById('device-count')!,
    };
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
    this.elements.btnStartEnrollment.addEventListener('click', () => this.startEnrollment());
    this.elements.btnStartScanner.addEventListener('click', () => this.startScanning());
    this.elements.btnStopScanner.addEventListener('click', () => this.stopScanning());
    this.elements.btnRetry.addEventListener('click', () => this.retry());
  }

  private async handleAuthenticated(): Promise<void> {
    console.log('[Guest] Usuario autenticado');
    
    // Extraer info del token
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
      this.elements.userName.textContent = this.userInfo.displayName;
      this.elements.userInfo.classList.remove('hidden');
    } catch (e) {
      console.error('[Guest] Error decodificando token:', e);
    }

    // Verificar estado de enrollment
    await this.checkEnrollmentStatus();
  }

  private async checkEnrollmentStatus(): Promise<void> {
    const token = this.authClient.getToken();
    if (!token) {
      this.showError('Sesión expirada. Por favor recarga la página.');
      return;
    }

    try {
      const status = await this.enrollmentService.getStatus(token);
      console.log('[Guest] Estado enrollment:', status);

      if (status.isEnrolled) {
        this.elements.deviceCount.textContent = status.deviceCount.toString();
        this.transitionTo('ENROLLED');
      } else {
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
    this.elements.enrollingMessage.textContent = 'Preparando registro...';

    try {
      // 1. Obtener opciones de enrollment del servidor
      this.elements.enrollingMessage.textContent = 'Generando desafío de seguridad...';
      const startResponse = await this.enrollmentService.startEnrollment(token);
      
      // 2. Solicitar credencial al usuario via WebAuthn
      this.elements.enrollingMessage.textContent = 'Usa tu huella digital o método biométrico...';
      
      const credential = await navigator.credentials.create({
        publicKey: startResponse.options,
      }) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('No se creó la credencial');
      }

      // 3. Generar fingerprint del dispositivo
      this.elements.enrollingMessage.textContent = 'Completando registro...';
      const fingerprint = await this.enrollmentService.generateDeviceFingerprint();

      // 4. Enviar credencial al servidor
      const finishResponse = await this.enrollmentService.finishEnrollment(
        token,
        credential,
        fingerprint
      );

      console.log('[Guest] Enrollment completado:', finishResponse);

      // 5. Éxito
      await this.checkEnrollmentStatus();

    } catch (error: any) {
      console.error('[Guest] Error en enrollment:', error);
      
      let message = 'Error al registrar dispositivo';
      
      if (error.name === 'NotAllowedError') {
        message = 'Operación cancelada o tiempo agotado';
      } else if (error.name === 'InvalidStateError') {
        message = 'Este dispositivo ya está registrado';
      } else if (error.name === 'NotSupportedError') {
        message = 'Tu dispositivo no soporta este método de autenticación';
      } else if (error.message?.includes('PENALTY_ACTIVE')) {
        message = error.message.replace('PENALTY_ACTIVE: ', '');
      } else if (error.message) {
        message = error.message;
      }
      
      this.showError(message);
    }
  }

  private async startScanning(): Promise<void> {
    // TODO: Implementar escaneo QR
    this.transitionTo('SCANNING');
    console.log('[Guest] Iniciando escáner...');
    
    // Por ahora, solo mostramos el estado
    setTimeout(() => {
      this.showError('Escáner QR aún no implementado');
    }, 2000);
  }

  private stopScanning(): void {
    this.transitionTo('ENROLLED');
  }

  private retry(): void {
    this.checkEnrollmentStatus();
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.elements.errorMessageEl.textContent = message;
    this.transitionTo('ERROR');
  }

  private transitionTo(newState: AppState): void {
    console.log(`[Guest] Transición: ${this.currentState} → ${newState}`);
    
    // Ocultar todos los estados
    document.querySelectorAll('.state-view').forEach(el => {
      el.classList.remove('active');
    });

    // Mostrar nuevo estado
    const stateEl = document.getElementById(`state-${newState.toLowerCase().replace('_', '-')}`);
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
