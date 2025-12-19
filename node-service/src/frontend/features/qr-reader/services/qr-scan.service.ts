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

// Tiempo de espera entre rondas (segundos)
const COOLDOWN_SECONDS = 3;
// Tiempo de espera después de error antes de reintentar (segundos)
const ERROR_RECOVERY_SECONDS = 2;

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
    
    // Debug: mostrar lo que se escaneo
    console.log('[QRScanService] QR detectado, longitud:', scannedText.length);
    console.log('[QRScanService] Primeros 50 chars:', scannedText.substring(0, 50));
    
    try {
      // 1. Intentar desencriptar
      console.log('[QRScanService] Intentando desencriptar...');
      const payloadJson = await decryptQR(scannedText);
      console.log('[QRScanService] Desencriptado OK:', payloadJson);
      const payload = JSON.parse(payloadJson);

      // 2. Verificar formato basico
      if (typeof payload.r !== 'number' || typeof payload.uid !== 'number') {
        return; // No es un QR valido de nuestro sistema
      }

      // 3. Obtener ID estudiante
      const studentId = this.authClient.getUserId();
      if (studentId === null) {
        console.log('[QRScanService] No hay usuario autenticado');
        return;
      }

      // 4. Verificar que el QR es para este estudiante
      // En produccion con ECDH, solo se descifraria el propio
      // En desarrollo con mock key, filtramos por uid
      if (payload.uid !== studentId) {
        // Ignorar silenciosamente - no es nuestro QR
        return;
      }

      // 5. Verificar ronda esperada
      if (payload.r !== this.expectedRound) {
        console.log(`[QRScanService] Ronda incorrecta. Esperada: ${this.expectedRound}, Recibida: ${payload.r}`);
        return; // Ignorar silenciosamente
      }

      console.log(`[QRScanService] QR VALIDO encontrado! uid=${payload.uid}, r=${payload.r}`);

      // --- INICIO VALIDACION ---
      this.validating = true;
      this.component.showValidating();
      console.log(`[QRScanService] Validando ronda ${payload.r}...`);

      // 6. Construir respuesta con payload original desencriptado
      const responsePayload = {
        original: payload,           // Payload desencriptado del QR
        studentId: studentId,        // ID del alumno que escanea
        receivedAt: Date.now(),      // Timestamp de recepcion
        // TODO: totp debe derivarse de session_key del estudiante (enrolamiento)
        // Por ahora omitido hasta integrar con modulo de enrollment
      };
      
      // 7. Encriptar respuesta completa
      const encryptedResponse = await encryptPayload(JSON.stringify(responsePayload));
      console.log(`[QRScanService] Respuesta encriptada, enviando al servidor...`);

      // 8. Enviar al backend
      const validationResult = await this.attendanceApi.validatePayload(encryptedResponse, studentId);
      console.log(`[QRScanService] Resultado validacion:`, JSON.stringify(validationResult));

      if (validationResult.valid) {
        if (validationResult.status === 'completed') {
          console.log(`[QRScanService] COMPLETADO! sessionId=${validationResult.sessionId}`);
          this.component.showValidationSuccess('Asistencia completada!');
          await this.stop();
          
          // Notificar al parent (PHP) que el estudiante completó la asistencia
          // El parent decide qué hacer (redirigir, mostrar mensaje, etc.)
          this.notifyParentCompletion(studentId, validationResult.sessionId);
        } else {
          // Partial success - actualizar round esperado y mostrar cooldown
          this.component.showPartialSuccess(`Ronda ${payload.r} completada`);
          this.expectedRound = validationResult.nextRound || (this.expectedRound + 1);
          
          // Cooldown visual con reanudación automática
          this.component.showCooldown(COOLDOWN_SECONDS, () => {
            this.validating = false;
            this.component.showScanning();
            console.log(`[QRScanService] Reanudando escaneo, round esperado: ${this.expectedRound}`);
          });
        }
      } else {
        this.component.showValidationError(validationResult.message);
        this.scheduleRecovery(ERROR_RECOVERY_SECONDS);
      }

    } catch (error) {
      // Si falla desencriptacion o parseo, asumimos que no es un QR para nosotros
      // o que la clave es incorrecta. Ignoramos silenciosamente.
      if (error instanceof Error) {
        console.warn('[QRScanService] Error procesando QR:', error.message);
      }
      this.validating = false;
    }
  }

  /**
   * Programa recuperacion despues de un error
   */
  private scheduleRecovery(seconds: number): void {
    setTimeout(() => {
      this.validating = false;
      if (this.scanning) {
        this.component.showScanning();
      }
    }, seconds * 1000);
  }

  /**
   * Notifica al parent (PHP) que el estudiante completó la asistencia
   * Intenta postMessage primero, luego redirect directo como fallback
   */
  private notifyParentCompletion(studentId: number, sessionId?: string): void {
    const studentName = this.authClient.getUserName();
    
    const message = {
      type: 'attendance-completed',
      studentId,
      studentName,
      sessionId,
      completedAt: Date.now(),
    };
    
    console.log('[QRScanService] Notificando completion:', message);
    
    // Intentar postMessage al parent (funciona si same-origin)
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(message, '*');
        console.log('[QRScanService] postMessage enviado');
      } catch (e) {
        console.warn('[QRScanService] postMessage falló:', e);
      }
    }
    
    // Redirect directo después de un delay
    // Usamos window.top para salir del iframe
    // La URL es relativa al origen del proxy (/asistencia/ -> mismo origen que PHP)
    const redirectUrl = `/encuesta/?student=${studentId}&session=${sessionId || ''}&name=${encodeURIComponent(studentName || '')}`;
    
    console.log('[QRScanService] Redirigiendo a:', redirectUrl);
    
    setTimeout(() => {
      try {
        // Intentar redirigir el top-level window
        if (window.top && window.top !== window) {
          window.top.location.href = redirectUrl;
        } else {
          // Fallback: redirigir el iframe mismo
          window.location.href = redirectUrl;
        }
      } catch (e) {
        // Si falla por cross-origin, redirigir el iframe
        console.warn('[QRScanService] No se pudo redirigir top, usando iframe:', e);
        window.location.href = redirectUrl;
      }
    }, 1500);
  }

  async stop(): Promise<void> {
    if (!this.scanning) return;
    this.component.clearCooldownTimer();
    await this.cameraManager.stop();
    this.component.showReady();
    this.scanning = false;
    this.validating = false;
  }
}
