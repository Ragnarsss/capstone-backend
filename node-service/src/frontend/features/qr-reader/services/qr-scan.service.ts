/**
 * QR Scan Service
 * Responsabilidad: Orquestar el flujo de lectura, validacion y estado del lector
 */
import type { ScannerResult } from './camera-manager';
import { CameraManager } from './camera-manager';
import type { CameraViewComponent } from '../ui/camera-view.component';
import { AttendanceApiClient } from './attendance-api.client';
import { AuthClient } from '../../../shared/auth/auth-client';

export class QRScanService {
  private readonly component: CameraViewComponent;
  private readonly cameraManager: CameraManager;
  private readonly attendanceApi: AttendanceApiClient;
  private readonly authClient: AuthClient;
  private authReady: boolean;
  private scanning: boolean;
  private validating: boolean;

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
    this.validating = true;

    const scannedText = result.text;
    console.log('[QRScanService] Codigo escaneado, validando...');
    
    // Show validating state
    this.component.showValidating();

    // Get student ID from auth
    const studentId = this.authClient.getUserId();
    if (studentId === null) {
      this.component.showValidationError('No se pudo identificar tu usuario');
      this.validating = false;
      return;
    }

    // Validate with backend
    const validationResult = await this.attendanceApi.validatePayload(scannedText, studentId);

    if (validationResult.valid) {
      this.component.showValidationSuccess(validationResult.message);
      // Stop scanning after successful validation
      await this.stop();
    } else {
      this.component.showValidationError(validationResult.message);
      // Allow retry after failed validation
      this.validating = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.scanning) return;
    await this.cameraManager.stop();
    this.component.showReady();
    this.scanning = false;
    this.validating = false;
  }
}
