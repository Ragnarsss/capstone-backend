/**
 * Enrollment Application
 * Responsabilidad: Bootstrap del feature de registro FIDO2
 * 
 * Flujo:
 * 1. Usuario abre /enrollment/
 * 2. Verifica autenticación JWT
 * 3. Consulta estado de dispositivos enrolados
 * 4. Si < 5 dispositivos → Muestra botón de enrollment
 * 5. Click en enrollment → WebAuthn create()
 * 6. Post-enrollment → Login ECDH para obtener session_key
 */
import { AuthClient } from '../../shared/auth/auth-client';
import { EnrollmentService } from './services/enrollment.service';
import { LoginService } from './services/login.service';
import { SessionKeyStore } from './services/session-key.store';

class EnrollmentApplication {
  private authClient: AuthClient;
  private enrollmentService: EnrollmentService;
  private loginService: LoginService;
  private sessionKeyStore: SessionKeyStore;
  
  // UI Elements
  private statusElement: HTMLElement | null = null;
  private userInfoSection: HTMLElement | null = null;
  private userNameSpan: HTMLElement | null = null;
  private deviceCountSpan: HTMLElement | null = null;
  private devicesSection: HTMLElement | null = null;
  private devicesList: HTMLElement | null = null;
  private enrollmentSection: HTMLElement | null = null;
  private enrollBtn: HTMLButtonElement | null = null;
  private enrollBtnText: HTMLElement | null = null;
  private enrollmentMessage: HTMLElement | null = null;
  private loginSection: HTMLElement | null = null;
  private loginBtn: HTMLButtonElement | null = null;
  private loginMessage: HTMLElement | null = null;
  private debugSection: HTMLElement | null = null;
  private debugOutput: HTMLElement | null = null;

  constructor() {
    this.authClient = new AuthClient();
    this.enrollmentService = new EnrollmentService();
    this.loginService = new LoginService();
    this.sessionKeyStore = new SessionKeyStore();
  }

  async initialize(): Promise<void> {
    this.initializeElements();
    
    // Iniciar autenticación
    this.authClient.initialize();

    if (this.authClient.isUserAuthenticated()) {
      await this.handleAuthReady();
    } else {
      this.authClient.onAuthenticated(() => this.handleAuthReady());
    }

    // Mostrar debug section en desarrollo
    if (import.meta.env.DEV && this.debugSection) {
      this.debugSection.style.display = 'block';
    }
  }

  private initializeElements(): void {
    this.statusElement = document.getElementById('enrollment-status');
    this.userInfoSection = document.getElementById('user-info');
    this.userNameSpan = document.getElementById('user-name');
    this.deviceCountSpan = document.getElementById('device-count');
    this.devicesSection = document.getElementById('devices-section');
    this.devicesList = document.getElementById('devices-list');
    this.enrollmentSection = document.getElementById('enrollment-section');
    this.enrollBtn = document.getElementById('enroll-btn') as HTMLButtonElement;
    this.enrollBtnText = document.getElementById('enroll-btn-text');
    this.enrollmentMessage = document.getElementById('enrollment-message');
    this.loginSection = document.getElementById('login-section');
    this.loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
    this.loginMessage = document.getElementById('login-message');
    this.debugSection = document.getElementById('debug-section');
    this.debugOutput = document.getElementById('debug-output');

    // Configurar event listeners
    this.enrollBtn?.addEventListener('click', () => this.handleEnrollClick());
    this.loginBtn?.addEventListener('click', () => this.handleLoginClick());
  }

  private async handleAuthReady(): Promise<void> {
    this.log('[Enrollment] Autenticación lista');
    this.updateStatus('Cargando información de dispositivos...');

    // Mostrar info del usuario
    const userId = this.authClient.getUserId();
    const username = this.authClient.getUsername();
    
    if (this.userNameSpan) {
      this.userNameSpan.textContent = username || `Usuario ${userId}`;
    }
    if (this.userInfoSection) {
      this.userInfoSection.style.display = 'block';
    }

    // Verificar si WebAuthn está soportado
    if (!this.enrollmentService.isWebAuthnSupported()) {
      this.updateStatus('Este navegador no soporta WebAuthn');
      this.showEnrollmentMessage('Tu navegador no soporta autenticación biométrica', 'error');
      return;
    }

    // Cargar estado de enrollment
    await this.loadEnrollmentStatus();
  }

  private async loadEnrollmentStatus(): Promise<void> {
    try {
      const status = await this.enrollmentService.getStatus();
      
      this.log('[Enrollment] Status:', status);

      // Actualizar conteo de dispositivos
      if (this.deviceCountSpan) {
        this.deviceCountSpan.textContent = String(status.deviceCount);
      }

      // Mostrar lista de dispositivos
      if (status.devices && status.devices.length > 0) {
        this.renderDevicesList(status.devices);
      }

      // Verificar si tiene session_key almacenada
      const hasSessionKey = this.sessionKeyStore.hasSessionKey();

      if (hasSessionKey) {
        // Ya tiene session key - puede usar el scanner
        this.updateStatus('Dispositivo listo');
        this.showEnrollmentMessage(
          '✅ Tienes una sesión activa. Puedes ir al escáner de asistencia.',
          'success'
        );
        this.showGoToScannerButton();
      } else if (status.deviceCount > 0) {
        // Tiene dispositivos pero no session key - necesita login
        this.updateStatus('Inicia sesión para continuar');
        this.showLoginSection();
      } else {
        // No tiene dispositivos - necesita enrollment
        this.updateStatus('Registra tu dispositivo');
        this.enableEnrollButton();
      }

      // Si puede enrolar más dispositivos
      if (status.deviceCount < 5) {
        this.enableEnrollButton();
      } else {
        this.showEnrollmentMessage('Has alcanzado el máximo de 5 dispositivos', 'info');
      }

    } catch (error) {
      this.log('[Enrollment] Error cargando status:', error);
      this.updateStatus('Error al cargar información');
      this.showEnrollmentMessage('Error al conectar con el servidor', 'error');
    }
  }

  private renderDevicesList(devices: Array<{ deviceId: number; aaguid: string; enrolledAt: string; lastUsedAt?: string }>): void {
    if (!this.devicesList || !this.devicesSection) return;

    this.devicesSection.style.display = 'block';
    this.devicesList.innerHTML = '';

    for (const device of devices) {
      const li = document.createElement('li');
      li.className = 'enrollment__device-item';
      
      const enrolledDate = new Date(device.enrolledAt).toLocaleDateString('es-CL');
      const lastUsed = device.lastUsedAt 
        ? new Date(device.lastUsedAt).toLocaleDateString('es-CL')
        : 'Nunca';

      li.innerHTML = `
        <div class="device-info">
          <span class="device-icon">📱</span>
          <span class="device-details">
            <span class="device-id">Dispositivo #${device.deviceId}</span>
            <span class="device-dates">Registrado: ${enrolledDate} | Último uso: ${lastUsed}</span>
          </span>
        </div>
        <button class="btn btn--small btn--danger revoke-btn" data-device-id="${device.deviceId}">
          Revocar
        </button>
      `;

      // Event listener para revocar
      const revokeBtn = li.querySelector('.revoke-btn');
      revokeBtn?.addEventListener('click', () => this.handleRevokeDevice(device.deviceId));

      this.devicesList.appendChild(li);
    }
  }

  private async handleEnrollClick(): Promise<void> {
    if (!this.enrollBtn) return;

    try {
      this.enrollBtn.disabled = true;
      this.updateEnrollButtonText('Preparando...');
      this.showEnrollmentMessage('Iniciando registro seguro...', 'info');

      // Paso 1: Obtener opciones del servidor
      this.log('[Enrollment] Solicitando opciones de registro...');
      const startResult = await this.enrollmentService.startEnrollment();

      if (!startResult.success) {
        throw new Error(startResult.error || 'Error al iniciar enrollment');
      }

      // Mostrar info de penalización si existe
      if (startResult.penaltyInfo) {
        this.log('[Enrollment] Penalización:', startResult.penaltyInfo);
      }

      // Paso 2: Crear credencial con WebAuthn
      this.updateEnrollButtonText('Esperando biometría...');
      this.showEnrollmentMessage(
        'Sigue las instrucciones de tu dispositivo para registrar biometría o PIN',
        'info'
      );

      this.log('[Enrollment] Creando credencial WebAuthn...');
      const credential = await this.enrollmentService.createCredential(startResult.options);

      // Paso 3: Enviar credencial al servidor
      this.updateEnrollButtonText('Verificando...');
      this.showEnrollmentMessage('Verificando credencial...', 'info');

      this.log('[Enrollment] Enviando credencial al servidor...');
      const finishResult = await this.enrollmentService.finishEnrollment(credential);

      if (!finishResult.success) {
        throw new Error(finishResult.error || 'Error al completar enrollment');
      }

      // Éxito
      this.log('[Enrollment] Enrollment completado:', finishResult);
      this.showEnrollmentMessage(
        `✅ ¡Dispositivo registrado correctamente! ID: ${finishResult.deviceId}`,
        'success'
      );
      this.updateStatus('Dispositivo registrado');

      // Recargar lista de dispositivos y mostrar login
      await this.loadEnrollmentStatus();
      this.showLoginSection();

    } catch (error) {
      this.log('[Enrollment] Error:', error);
      
      let message = 'Error durante el registro';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          message = 'Registro cancelado por el usuario';
        } else if (error.name === 'InvalidStateError') {
          message = 'Este dispositivo ya está registrado';
        } else {
          message = error.message;
        }
      }

      this.showEnrollmentMessage(message, 'error');
      this.enableEnrollButton();
    }
  }

  private async handleLoginClick(): Promise<void> {
    if (!this.loginBtn) return;

    try {
      this.loginBtn.disabled = true;
      this.showLoginMessage('Iniciando sesión segura...', 'info');

      // Obtener credencial disponible
      const status = await this.enrollmentService.getStatus();
      
      if (!status.devices || status.devices.length === 0) {
        throw new Error('No hay dispositivos registrados');
      }

      // Usar el primer dispositivo
      const device = status.devices[0];
      
      this.log('[Login] Realizando ECDH key exchange...');
      const loginResult = await this.loginService.performLogin(device.credentialId);

      if (!loginResult.success) {
        throw new Error(loginResult.error || 'Error en login');
      }

      // Guardar session key
      this.sessionKeyStore.storeSessionKey(loginResult.sessionKey!, loginResult.totpu!);

      this.showLoginMessage('✅ Sesión iniciada correctamente', 'success');
      this.updateStatus('Listo para marcar asistencia');

      // Mostrar botón para ir al scanner
      this.showGoToScannerButton();

    } catch (error) {
      this.log('[Login] Error:', error);
      this.showLoginMessage(
        error instanceof Error ? error.message : 'Error al iniciar sesión',
        'error'
      );
      this.loginBtn.disabled = false;
    }
  }

  private async handleRevokeDevice(deviceId: number): Promise<void> {
    if (!confirm(`¿Estás seguro de revocar el dispositivo #${deviceId}?`)) {
      return;
    }

    try {
      const result = await this.enrollmentService.revokeDevice(deviceId);
      
      if (result.success) {
        this.showEnrollmentMessage(`Dispositivo #${deviceId} revocado`, 'success');
        await this.loadEnrollmentStatus();
      } else {
        throw new Error(result.error || 'Error al revocar');
      }
    } catch (error) {
      this.showEnrollmentMessage(
        error instanceof Error ? error.message : 'Error al revocar dispositivo',
        'error'
      );
    }
  }

  private showLoginSection(): void {
    if (this.loginSection) {
      this.loginSection.style.display = 'block';
    }
  }

  private showGoToScannerButton(): void {
    if (!this.loginSection) return;

    this.loginSection.innerHTML = `
      <h2>¡Listo!</h2>
      <p>Tu dispositivo está configurado. Ya puedes marcar tu asistencia.</p>
      <a href="/features/qr-reader/" class="btn primary btn--large">
        📷 Ir al Escáner de Asistencia
      </a>
    `;
    this.loginSection.style.display = 'block';
  }

  private enableEnrollButton(): void {
    if (this.enrollBtn) {
      this.enrollBtn.disabled = false;
    }
    this.updateEnrollButtonText('Registrar este dispositivo');
  }

  private updateEnrollButtonText(text: string): void {
    if (this.enrollBtnText) {
      this.enrollBtnText.textContent = text;
    }
  }

  private updateStatus(text: string): void {
    if (this.statusElement) {
      this.statusElement.textContent = text;
    }
  }

  private showEnrollmentMessage(text: string, type: 'info' | 'success' | 'error'): void {
    if (!this.enrollmentMessage) return;
    this.enrollmentMessage.textContent = text;
    this.enrollmentMessage.className = `enrollment__message enrollment__message--${type}`;
  }

  private showLoginMessage(text: string, type: 'info' | 'success' | 'error'): void {
    if (!this.loginMessage) return;
    this.loginMessage.textContent = text;
    this.loginMessage.className = `enrollment__message enrollment__message--${type}`;
  }

  private log(...args: unknown[]): void {
    console.log(...args);
    
    if (this.debugOutput) {
      const text = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      this.debugOutput.textContent += text + '\n';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new EnrollmentApplication();
  app.initialize();
});
