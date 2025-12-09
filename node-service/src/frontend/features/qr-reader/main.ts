/**
 * QR Reader Application
 * Responsabilidad: Bootstrap del feature lectura QR
 * 
 * Flujo:
 * 1. Usuario abre /reader/
 * 2. Se autentica (mock en dev)
 * 3. Presiona "Registrar Asistencia"
 * 4. Backend verifica si hay sesión activa
 * 5. Si hay → Registra y activa cámara
 * 6. Si no hay → Muestra mensaje "No hay clase activa"
 */
import { AuthClient } from '../../shared/auth/auth-client';
import { CameraViewComponent } from './ui/camera-view.component';
import { CameraManager } from './services/camera-manager';
import { QRScanService } from './services/qr-scan.service';
import { AttendanceApiClient } from './services/attendance-api.client';
import { decryptQR, encryptPayload, MOCK_SESSION_KEY } from '../../shared/crypto';
import { LegacyBridge } from '../../shared/services/legacy-bridge.service';
import { LegacyContextStore } from '../../shared/stores/legacy-context.store';

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
  
  // UI Elements
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
    const component = new CameraViewComponent();
    const cameraManager = new CameraManager('camera-feed');
    this.scanService = new QRScanService(component, cameraManager, this.authClient, this.attendanceApi);
  }

  initialize(): void {
    // Obtener elementos UI
    this.registerBtn = document.getElementById('register-btn') as HTMLButtonElement;
    this.registerMessage = document.getElementById('register-message');
    this.registerSection = document.getElementById('register-section');
    this.scanSection = document.getElementById('scan-section');
    this.statusElement = document.getElementById('scanner-status');
    
    // Inicializar bridge para comunicacion con PHP legacy
    this.legacyBridge.initialize();
    
    // Configurar scan service
    this.scanService.initialize();
    
    // Configurar botón de registro
    this.registerBtn?.addEventListener('click', () => this.handleRegisterClick());

    // Iniciar autenticación
    this.authClient.initialize();

    if (this.authClient.isUserAuthenticated()) {
      this.handleAuthReady();
    } else {
      this.authClient.onAuthenticated(() => this.handleAuthReady());
    }

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

  private handleAuthReady(): void {
    console.log('[QRReader] Autenticación lista');
    
    // Log contexto si esta disponible (viene de PHP legacy)
    if (this.contextStore.hasContext()) {
      const ctx = this.contextStore.getAsAlumno();
      if (ctx) {
        console.log('[QRReader] Contexto alumno - codigoQR:', ctx.codigoQR);
      }
    }
    
    this.updateStatus('Listo para registrar asistencia');
    
    // Habilitar botón de registro
    if (this.registerBtn) {
      this.registerBtn.disabled = false;
    }
  }

  /**
   * Maneja click en "Registrar Asistencia"
   */
  private async handleRegisterClick(): Promise<void> {
    if (!this.registerBtn) return;
    
    // Deshabilitar botón mientras procesa
    this.registerBtn.disabled = true;
    this.showMessage('Buscando clase activa...', 'info');
    
    // Consultar sesión activa
    const session = await this.attendanceApi.getActiveSession();
    
    if (!session.hasActiveSession || !session.sessionId) {
      this.showMessage(session.message || 'No hay clase activa en este momento', 'error');
      this.registerBtn.disabled = false;
      return;
    }
    
    // Hay sesión activa - registrar estudiante
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
    
    // Éxito - mostrar sección de escaneo
    console.log(`[QRReader] Registrado OK. Round inicial: ${result.currentRound}`);
    this.showMessage(`¡Registrado! Round ${result.currentRound}. Escanea tu QR.`, 'success');
    
    // Pasar a la sección de escaneo
    this.showScanSection();
    this.scanService.markAuthReady();
  }

  /**
   * Muestra la sección de escaneo y oculta el registro
   */
  private showScanSection(): void {
    if (this.registerSection) {
      this.registerSection.style.display = 'none';
    }
    if (this.scanSection) {
      this.scanSection.style.display = 'block';
    }
    this.updateStatus('Busca tu código QR en pantalla');
  }

  /**
   * Muestra mensaje de estado
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
