/**
 * Camera View Component
 * Responsabilidad: Renderizado UI del lector QR
 * 
 * Estados de la UI:
 * - IDLE: Cámara apagada, esperando inicio
 * - WAITING_AUTH: Esperando autenticación del usuario
 * - SCANNING: Buscando QR activamente
 * - PROCESSING: QR detectado, desencriptando/enviando
 * - SUCCESS: Asistencia completada exitosamente
 * - PARTIAL_SUCCESS: Ronda completada, esperando siguiente
 * - ERROR: Error en validación
 * - COOLDOWN: Cuenta regresiva para siguiente ronda
 */

export type ScannerState = 
  | 'IDLE'
  | 'WAITING_AUTH'
  | 'SCANNING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'ERROR'
  | 'COOLDOWN';

type VoidHandler = () => void;

interface DOMRefs {
  status: HTMLElement | null;
  overlay: HTMLElement | null;
  video: HTMLVideoElement | null;
  startButton: HTMLButtonElement | null;
  stopButton: HTMLButtonElement | null;
  result: HTMLElement | null;
}

export class CameraViewComponent {
  private refs: DOMRefs;
  private startHandlers: VoidHandler[];
  private stopHandlers: VoidHandler[];
  private currentState: ScannerState;
  private cooldownTimer: number | null;

  constructor() {
    this.refs = {
      status: null,
      overlay: null,
      video: null,
      startButton: null,
      stopButton: null,
      result: null,
    };
    this.startHandlers = [];
    this.stopHandlers = [];
    this.currentState = 'IDLE';
    this.cooldownTimer = null;
  }

  /**
   * Obtiene el estado actual del scanner
   */
  getState(): ScannerState {
    return this.currentState;
  }

  mount(): void {
    this.refs.status = document.getElementById('scanner-status');
    this.refs.overlay = document.getElementById('camera-overlay');
    this.refs.video = document.getElementById('camera-feed') as HTMLVideoElement | null;
    this.refs.startButton = document.getElementById('start-scan') as HTMLButtonElement | null;
    this.refs.stopButton = document.getElementById('stop-scan') as HTMLButtonElement | null;
    this.refs.result = document.getElementById('scan-result');

    this.refs.startButton?.addEventListener('click', () => this.startHandlers.forEach((handler) => handler()));
    this.refs.stopButton?.addEventListener('click', () => this.stopHandlers.forEach((handler) => handler()));
  }

  onStart(handler: VoidHandler): void {
    this.startHandlers.push(handler);
  }

  onStop(handler: VoidHandler): void {
    this.stopHandlers.push(handler);
  }

  showWaitingAuth(): void {
    this.setState('WAITING_AUTH');
    this.updateStatus('Esperando autenticacion...');
    this.setOverlay('Camara inactiva');
    this.toggleButtons({ start: true, stop: true });
  }

  showReady(): void {
    this.setState('IDLE');
    this.updateStatus('Listo para iniciar la camara');
    this.setOverlay('Camara inactiva');
    this.toggleButtons({ start: false, stop: true });
  }

  showScanning(): void {
    this.setState('SCANNING');
    this.updateStatus('Leyendo codigo...');
    this.setOverlay(null);
    this.toggleButtons({ start: true, stop: false });
  }

  showResult(message: string): void {
    this.updateStatus('Codigo detectado');
    this.renderResult(message, 'success');
  }

  showValidating(): void {
    this.setState('PROCESSING');
    this.updateStatus('Validando asistencia...');
    this.setOverlay('Procesando...', true); // Con spinner
    this.renderResult('Verificando codigo...', 'pending');
    this.toggleButtons({ start: true, stop: true }); // Deshabilitar ambos durante procesamiento
  }

  showValidationSuccess(message: string): void {
    this.setState('SUCCESS');
    this.updateStatus('Asistencia registrada');
    this.renderResult(message, 'success');
    this.setOverlay('Escaneo completado');
    this.toggleButtons({ start: false, stop: true });
  }

  showPartialSuccess(message: string): void {
    this.setState('PARTIAL_SUCCESS');
    this.updateStatus('Ronda completada');
    this.renderResult(message, 'success');
    this.setOverlay('Ronda OK');
  }

  /**
   * Muestra cuenta regresiva antes de continuar escaneando
   * @param seconds - Segundos de espera
   * @param onComplete - Callback cuando termina la cuenta
   */
  showCooldown(seconds: number, onComplete?: VoidHandler): void {
    this.setState('COOLDOWN');
    this.clearCooldownTimer();
    
    let remaining = seconds;
    
    const updateCountdown = () => {
      this.updateStatus(`Siguiente ronda en ${remaining}s...`);
      this.setOverlay(`Espera ${remaining}s`);
      this.renderResult('Preparando siguiente lectura...', 'pending');
      
      if (remaining <= 0) {
        this.clearCooldownTimer();
        onComplete?.();
        return;
      }
      
      remaining--;
      this.cooldownTimer = window.setTimeout(updateCountdown, 1000);
    };
    
    updateCountdown();
  }

  /**
   * Cancela cualquier cuenta regresiva activa
   */
  clearCooldownTimer(): void {
    if (this.cooldownTimer !== null) {
      window.clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  showValidationError(message: string): void {
    this.setState('ERROR');
    this.updateStatus('Error de validacion');
    this.renderResult(message, 'error');
    this.setOverlay('Error');
  }

  showError(message: string): void {
    this.setState('ERROR');
    this.updateStatus(message);
    this.renderResult(message, 'error');
    this.setOverlay('Camara inactiva');
    this.toggleButtons({ start: false, stop: true });
  }

  resetResult(): void {
    this.renderResult('Ningun codigo detectado todavia');
  }

  /**
   * Actualiza el estado interno
   */
  private setState(state: ScannerState): void {
    this.currentState = state;
  }

  private updateStatus(message: string): void {
    if (this.refs.status) {
      this.refs.status.textContent = message;
    }
  }

  /**
   * Configura el overlay con mensaje opcional y spinner
   * @param message - Mensaje a mostrar (null para ocultar)
   * @param showSpinner - Si true, muestra animación de carga
   */
  private setOverlay(message: string | null, showSpinner: boolean = false): void {
    if (!this.refs.overlay) return;
    if (!message) {
      this.refs.overlay.style.opacity = '0';
      this.refs.overlay.style.pointerEvents = 'none';
      this.refs.overlay.innerHTML = '';
      this.refs.overlay.classList.remove('overlay--loading');
      return;
    }
    
    if (showSpinner) {
      this.refs.overlay.innerHTML = `<div class="spinner"></div><span>${message}</span>`;
      this.refs.overlay.classList.add('overlay--loading');
    } else {
      this.refs.overlay.textContent = message;
      this.refs.overlay.classList.remove('overlay--loading');
    }
    
    this.refs.overlay.style.opacity = '1';
    this.refs.overlay.style.pointerEvents = 'auto';
  }

  private toggleButtons(state: { start: boolean; stop: boolean }): void {
    if (this.refs.startButton) {
      this.refs.startButton.disabled = state.start;
    }
    if (this.refs.stopButton) {
      this.refs.stopButton.disabled = state.stop;
    }
  }

  private renderResult(message: string, type?: 'success' | 'error' | 'pending'): void {
    if (!this.refs.result) return;
    this.refs.result.textContent = message;
    this.refs.result.className = type ? `result-${type}` : '';
  }
}
