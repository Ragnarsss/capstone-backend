/**
 * QR Scan Service
 * Responsabilidad: Orquestar el flujo de lectura, validacion y estado del lector
 */
import type { ScannerResult } from './camera-manager';
import { CameraManager } from './camera-manager';
import type { CameraViewComponent } from '../ui/camera-view.component';
import { AttendanceApiClient } from './attendance-api.client';
import { AuthClient } from '../../../shared/auth/auth-client';
import { decryptQR, encryptPayload } from '../../../shared/crypto/aes-gcm';

export class QRScanService {
  private readonly component: CameraViewComponent;
  private readonly cameraManager: CameraManager;
  private readonly attendanceApi: AttendanceApiClient;
  private readonly authClient: AuthClient;
  
  private authReady: boolean;
  private scanning: boolean;
  private validating: boolean;
  private expectedRound: number;

  constructor(
    component: CameraViewComponent,
    cameraManager: CameraManager,
    authClient: AuthClient,
    attendanceApi?: AttendanceApiClient
  ) {
    this.component = component;
    this.cameraManager = cameraManager;
    this.authClient = authClient;
    this.attendanceApi = attendanceApi ?? new AttendanceApiClient();
    
    this.authReady = false;
    this.scanning = false;
    this.validating = false;
    this.expectedRound = 1;
  }

  initialize(): void {
    this.component.mount();
    this.component.resetResult();
    this.component.showWaitingAuth();

    this.component.onStart(() => {
      void this.start();
    });

    this.component.onStop(() => {
      void this.stop();
    });
  }

  markAuthReady(): void {
    this.authReady = true;
    this.component.showReady();
  }

  async start(): Promise<void> {
    if (!this.authReady) {
      this.component.showError('Aun no se valida la sesion');
      return;
    }
    if (this.scanning) return;
    this.scanning = true;
    this.validating = false;
    this.component.showScanning();
    this.component.resetResult();

    try {
      await this.cameraManager.start(
        (result: ScannerResult) => {
          void this.handleScanResult(result);
        },
        (message: string) => {
          this.component.showError(message);
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al iniciar el lector';
      this.component.showError(message);
      this.scanning = false;
    }
  }

  private async handleScanResult(result: ScannerResult): Promise<void> {
    // Prevent multiple validations for same scan
    if (this.validating) return;

    const scannedText = result.text;
    
    try {
      // 1. Intentar desencriptar
      const payloadJson = await decryptQR(scannedText);
      const payload = JSON.parse(payloadJson);

      // 2. Verificar formato básico
      if (typeof payload.r !== 'number') {
        return; // No es un QR válido de nuestro sistema
      }

      // 3. Verificar ronda esperada
      if (payload.r !== this.expectedRound) {
        console.log(`[QRScanService] Ronda incorrecta. Esperada: ${this.expectedRound}, Recibida: ${payload.r}`);
        return; // Ignorar silenciosamente
      }

      // --- INICIO VALIDACIÓN ---
      this.validating = true;
      this.component.showValidating();
      console.log(`[QRScanService] Validando ronda ${payload.r}...`);

      // 4. Obtener ID estudiante
      const studentId = this.authClient.getUserId();
      if (studentId === null) {
        this.component.showValidationError('No se pudo identificar tu usuario');
        this.validating = false;
        return;
      }

      // 5. Construir respuesta encriptada
      const responsePayload = JSON.stringify({
        r: payload.r,
        ts: Date.now(),
        studentId: studentId // Incluimos ID por seguridad adicional
      });
      
      const encryptedResponse = await encryptPayload(responsePayload);

      // 6. Enviar al backend
      const validationResult = await this.attendanceApi.validatePayload(encryptedResponse);

      if (validationResult.valid) {
        if (validationResult.status === 'completed') {
          this.component.showValidationSuccess('¡Asistencia completada!');
          await this.stop();
        } else {
          // Partial success
          this.component.showPartialSuccess(`Ronda ${payload.r} completada. Esperando siguiente...`);
          this.expectedRound = validationResult.nextRound || (this.expectedRound + 1);
          
          // Pausa breve antes de seguir escaneando
          setTimeout(() => {
            this.validating = false;
            this.component.showScanning();
          }, 2000);
        }
      } else {
        this.component.showValidationError(validationResult.message);
        // Permitir reintentar después de un error
        setTimeout(() => {
          this.validating = false;
          this.component.showScanning();
        }, 2000);
      }

    } catch (error) {
      // Si falla desencriptación o parseo, asumimos que no es un QR para nosotros
      // o que la clave es incorrecta. Ignoramos silenciosamente para no interrumpir el escaneo.
      // Solo logueamos si es un error inesperado
      if (error instanceof Error && error.message !== 'Fallo en desencriptación o autenticación') {
        console.warn('[QRScanService] Error procesando QR:', error);
      }
      this.validating = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.scanning) return;
    await this.cameraManager.stop();
    this.component.showReady();
    this.scanning = false;
    this.validating = false;
    // Reset expected round on stop? Maybe not, if they accidentally close camera.
    // But for now let's keep it.
  }
}
