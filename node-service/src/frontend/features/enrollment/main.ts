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
import {
  EnrollmentService,
  LoginService,
  SessionKeyStore,
  AccessService,
  type AccessState,
} from '../../shared/services/enrollment';
import { getRemoteLogger, RemoteLoggerService } from './services/remote-logger.service';

class EnrollmentApplication {
  private authClient: AuthClient;
  private enrollmentService: EnrollmentService;
  private loginService: LoginService;
  private sessionKeyStore: SessionKeyStore;
  private accessService: AccessService;
  private remoteLogger: RemoteLoggerService;
  
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
    this.remoteLogger = getRemoteLogger();
    this.remoteLogger.info('EnrollmentApplication constructor');

    this.authClient = new AuthClient();
    this.enrollmentService = new EnrollmentService();
    this.loginService = new LoginService(this.authClient);
    this.sessionKeyStore = new SessionKeyStore();
    this.accessService = new AccessService(() => this.authClient.getToken());
  }

  async initialize(): Promise<void> {
    this.remoteLogger.info('initialize() called');
    this.initializeElements();
    
    // Mostrar panel de logs siempre (para debugging móvil)
    if (this.debugSection) {
      this.debugSection.style.display = 'block';
    }
    
    // Log inicial para confirmar que el script cargó
    this.log('🚀 Enrollment inicializado', 'info');
    this.log(`User Agent: ${navigator.userAgent.substring(0, 50)}...`, 'info');
    this.log(`WebAuthn soportado: ${window.PublicKeyCredential ? 'Sí' : 'No'}`, 'info');
    
    // Iniciar autenticación
    this.authClient.initialize();
    this.log('Iniciando autenticación...', 'info');

    if (this.authClient.isUserAuthenticated()) {
      this.log('Usuario ya autenticado', 'success');
      await this.handleAuthReady();
    } else {
      this.log('Esperando token JWT...', 'info');
      this.authClient.onAuthenticated(() => this.handleAuthReady());
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
    
    // Botón para limpiar log
    const clearLogBtn = document.getElementById('clear-log-btn');
    clearLogBtn?.addEventListener('click', () => {
      if (this.debugOutput) {
        this.debugOutput.innerHTML = '';
        this.log('Log limpiado', 'info');
      }
    });
  }

  private async handleAuthReady(): Promise<void> {
    // Mostrar información del navegador
    this.log('=== Iniciando Enrollment ===', 'info');
    this.log(`Navegador: ${navigator.userAgent}`, 'info');
    this.log(`WebAuthn soportado: ${!!window.PublicKeyCredential}`, 'info');
    this.log('Autenticación JWT lista', 'success');
    this.updateStatus('Cargando información de dispositivos...');

    // Mostrar info del usuario
    const userId = this.authClient.getUserId();
    const username = this.authClient.getUserName();

    if (this.userNameSpan) {
      this.userNameSpan.textContent = username || `Usuario ${userId}`;
    }
    if (this.userInfoSection) {
      this.userInfoSection.style.display = 'block';
    }

    // Verificar si WebAuthn está soportado
    if (!this.enrollmentService.isWebAuthnSupported()) {
      this.log('WebAuthn NO soportado en este navegador', 'error');
      this.updateStatus('Este navegador no soporta WebAuthn');
      this.showEnrollmentMessage('Tu navegador no soporta autenticación biométrica', 'error');
      return;
    }

    this.log('WebAuthn soportado ✓', 'success');

    // Cargar lista de dispositivos para mostrar
    await this.loadDevicesList();

    // Obtener estado agregado del backend y renderizar
    try {
      const state = await this.accessService.getState();
      this.renderByState(state);
    } catch (error) {
      this.log('[handleAuthReady] Error obteniendo estado:', error);
      this.updateStatus('Error al cargar estado');
      this.showEnrollmentMessage('Error al conectar con el servidor', 'error');
    }
  }

  /**
   * Carga y muestra la lista de dispositivos del usuario
   * Ya no contiene lógica de inferencia de estado (movida a renderByState)
   */
  private async loadDevicesList(): Promise<void> {
    try {
      this.log('Cargando lista de dispositivos...', 'info');
      const result = await this.enrollmentService.getDevices();

      this.log(`Dispositivos: ${result.deviceCount}/5`, 'success', result);

      // Actualizar conteo de dispositivos
      if (this.deviceCountSpan) {
        this.deviceCountSpan.textContent = String(result.deviceCount);
      }

      // Mostrar lista de dispositivos
      if (result.devices && result.devices.length > 0) {
        this.renderDevicesList(result.devices);
      }

    } catch (error) {
      this.logError('Error cargando dispositivos', error);
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

    this.remoteLogger.info('=== handleEnrollClick START ===');

    try {
      this.enrollBtn.disabled = true;
      this.updateEnrollButtonText('Preparando...');
      this.showEnrollmentMessage('Iniciando registro seguro...', 'info');
      this.log('=== Iniciando Enrollment ===', 'info');

      // Paso 1: Obtener opciones del servidor
      this.log('Paso 1: Solicitando opciones del servidor...', 'info');
      this.remoteLogger.info('Paso 1: Llamando /start');
      
      const startResult = await this.enrollmentService.startEnrollment();
      this.remoteLogger.info('Paso 1: Respuesta de /start', { success: startResult.success, hasOptions: !!startResult.options, error: startResult.error });

      if (!startResult.success) {
        this.log(`Error en /start: ${startResult.error}`, 'error');
        this.remoteLogger.error('Error en /start', startResult.error);
        throw new Error(startResult.error || 'Error al iniciar enrollment');
      }

      // Validar que recibimos opciones
      if (!startResult.options) {
        this.log('No se recibieron opciones del servidor', 'error', startResult);
        throw new Error('No se recibieron opciones de registro del servidor');
      }

      this.log('Opciones recibidas del servidor ✓', 'success');
      this.log('Challenge: ' + startResult.options.challenge?.substring(0, 20) + '...', 'info');
      this.log('RP: ' + JSON.stringify(startResult.options.rp), 'info');
      this.log('User ID: ' + startResult.options.user?.id, 'info');

      // Mostrar info de penalización si existe
      if (startResult.penaltyInfo) {
        this.log('Info penalización: ' + JSON.stringify(startResult.penaltyInfo), 'warn');
      }

      // Paso 2: Crear credencial con WebAuthn
      this.log('Paso 2: Creando credencial WebAuthn...', 'info');
      this.log('Esto mostrará el diálogo de biometría/PIN del dispositivo', 'info');
      this.remoteLogger.info('Paso 2: Llamando createCredential (WebAuthn)', { 
        rpId: startResult.options.rp?.id,
        rpName: startResult.options.rp?.name,
        challengeLength: startResult.options.challenge?.length 
      });
      
      this.updateEnrollButtonText('Esperando biometría...');
      this.showEnrollmentMessage(
        'Sigue las instrucciones de tu dispositivo para registrar biometría o PIN',
        'info'
      );

      let credential;
      try {
        credential = await this.enrollmentService.createCredential(startResult.options);
        this.log('Credencial creada exitosamente ✓', 'success');
        this.log('Credential ID: ' + credential.id?.substring(0, 30) + '...', 'info');
        this.log('Type: ' + credential.type, 'info');
        this.remoteLogger.success('Paso 2: Credencial creada', { 
          credentialId: credential.id?.substring(0, 30),
          type: credential.type,
          hasResponse: !!credential.response 
        });
      } catch (webauthnError) {
        this.logError('Error en WebAuthn createCredential', webauthnError);
        const errorInfo = webauthnError instanceof Error 
          ? { name: webauthnError.name, message: webauthnError.message } 
          : String(webauthnError);
        this.remoteLogger.error('Paso 2 FAILED: Error en createCredential', errorInfo);
        throw webauthnError;
      }

      // Paso 3: Enviar credencial al servidor
      this.log('Paso 3: Enviando credencial al servidor...', 'info');
      this.remoteLogger.info('Paso 3: Llamando /finish');
      this.updateEnrollButtonText('Verificando...');
      this.showEnrollmentMessage('Verificando credencial...', 'info');

      const finishResult = await this.enrollmentService.finishEnrollment(credential);
      this.remoteLogger.info('Paso 3: Respuesta de /finish', { success: finishResult.success, deviceId: finishResult.deviceId, error: finishResult.error });

      if (!finishResult.success) {
        this.log(`Error en /finish: ${finishResult.error}`, 'error');
        this.remoteLogger.error('Error en /finish', finishResult.error);
        throw new Error(finishResult.error || 'Error al completar enrollment');
      }

      // Éxito
      this.log('=== Enrollment Completado ✓ ===', 'success');
      this.log(`Device ID: ${finishResult.deviceId}`, 'success');
      this.remoteLogger.success('=== ENROLLMENT COMPLETADO ===', { deviceId: finishResult.deviceId });
      this.showEnrollmentMessage(
        `✅ ¡Dispositivo registrado correctamente! ID: ${finishResult.deviceId}`,
        'success'
      );
      this.updateStatus('Dispositivo registrado');

      // Recargar lista de dispositivos
      await this.loadDevicesList();

      // Auto-continuacion: consultar estado y renderizar
      const state = await this.accessService.getState();
      this.renderByState(state);

    } catch (error) {
      const errorInfo = error instanceof Error 
        ? { name: error.name, message: error.message } 
        : String(error);
      this.remoteLogger.error('=== ENROLLMENT FAILED ===', errorInfo);
      this.logError('Error en enrollment', error);
      
      let message = 'Error durante el registro';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          message = 'Registro cancelado por el usuario';
          this.log('Usuario canceló el registro', 'warn');
        } else if (error.name === 'InvalidStateError') {
          message = 'Este dispositivo ya está registrado';
          this.log('Dispositivo ya registrado', 'warn');
        } else if (error.name === 'SecurityError') {
          message = 'Error de seguridad - verifica que estás en HTTPS';
          this.log('SecurityError - ¿HTTPS habilitado?', 'error');
        } else if (error.name === 'NotSupportedError') {
          message = 'Algoritmo no soportado por este dispositivo';
          this.log('NotSupportedError - algoritmo no soportado', 'error');
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
      const result = await this.enrollmentService.getDevices();
      
      if (!result.devices || result.devices.length === 0) {
        throw new Error('No hay dispositivos registrados');
      }

      // Usar el primer dispositivo
      const device = result.devices[0];
      
      this.log('[Login] Realizando ECDH key exchange...');
      const loginResult = await this.loginService.performLogin(device.credentialId);

      if (!loginResult.success) {
        throw new Error(loginResult.error || 'Error en login');
      }

      // Guardar session key
      this.sessionKeyStore.storeSessionKey(loginResult.sessionKey!, loginResult.totpu!);

      this.showLoginMessage('✅ Sesión iniciada correctamente', 'success');

      // Auto-continuacion: consultar estado y renderizar
      const state = await this.accessService.getState();
      this.renderByState(state);

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
        
        // Recargar lista y consultar nuevo estado
        await this.loadDevicesList();
        const state = await this.accessService.getState();
        this.renderByState(state);
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

  private showBlockedMessage(message?: string): void {
    if (this.enrollmentSection) {
      this.enrollmentSection.style.display = 'none';
    }
    if (this.loginSection) {
      this.loginSection.style.display = 'none';
    }

    this.showEnrollmentMessage(
      message || '🚫 Acceso bloqueado. Contacta al administrador.',
      'error'
    );
    this.updateStatus('Acceso bloqueado');
  }

  /**
   * Renderiza la UI según el estado agregado del backend
   * Método centralizado para eliminar lógica dispersa
   */
  private renderByState(state: AccessState): void {
    this.log(`[renderByState] Estado: ${state.state}, Acción: ${state.action}`, 'info');

    switch (state.state) {
      case 'NOT_ENROLLED':
        this.updateStatus('Registra tu dispositivo');
        this.enableEnrollButton();
        if (this.loginSection) {
          this.loginSection.style.display = 'none';
        }
        break;

      case 'ENROLLED_NO_SESSION':
        this.updateStatus('Inicia sesión para continuar');
        this.showLoginSection();
        break;

      case 'READY':
        this.updateStatus('Dispositivo listo');
        this.showEnrollmentMessage(
          '✅ Tienes una sesión activa. Puedes ir al escáner de asistencia.',
          'success'
        );
        this.showGoToScannerButton();
        break;

      case 'BLOCKED':
        this.showBlockedMessage(state.message);
        break;

      default:
        this.log(`[renderByState] Estado desconocido: ${state.state}`, 'error');
        break;
    }
  }

  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info', data?: unknown): void {
    const timestamp = new Date().toLocaleTimeString('es-CL');
    console.log(`[${timestamp}]`, message, data ?? '');
    
    if (this.debugOutput) {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry log-entry--${type}`;
      
      let text = `[${timestamp}] ${message}`;
      if (data !== undefined) {
        if (typeof data === 'object') {
          text += '\n' + JSON.stringify(data, null, 2);
        } else {
          text += ' ' + String(data);
        }
      }
      
      logEntry.textContent = text;
      this.debugOutput.appendChild(logEntry);
      this.debugOutput.scrollTop = this.debugOutput.scrollHeight;
    }
  }

  private logError(message: string, error: unknown): void {
    let errorMessage = 'Error desconocido';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.name + (error.stack ? '\n' + error.stack : '');
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }
    
    this.log(`${message}: ${errorMessage}`, 'error');
    if (errorDetails) {
      console.error('Error details:', errorDetails);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new EnrollmentApplication();
  app.initialize();
});
