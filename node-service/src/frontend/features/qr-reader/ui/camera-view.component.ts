/**
 * Camera View Component
 * Responsabilidad: Renderizado UI del lector QR
 */
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
    this.updateStatus('Esperando autenticacion...');
    this.setOverlay('Camara inactiva');
    this.toggleButtons({ start: true, stop: true });
  }

  showReady(): void {
    this.updateStatus('Listo para iniciar la camara');
    this.setOverlay('Camara inactiva');
    this.toggleButtons({ start: false, stop: true });
  }

  showScanning(): void {
    this.updateStatus('Leyendo codigo...');
    this.setOverlay(null);
    this.toggleButtons({ start: true, stop: false });
  }

  showResult(message: string): void {
    this.updateStatus('Codigo detectado');
    this.renderResult(message, 'success');
  }

  showValidating(): void {
    this.updateStatus('Validando asistencia...');
    this.renderResult('Procesando codigo...', 'pending');
  }

  showValidationSuccess(message: string): void {
    this.updateStatus('Asistencia registrada');
    this.renderResult(message, 'success');
    this.setOverlay('Escaneo completado');
    this.toggleButtons({ start: false, stop: true });
  }

  showPartialSuccess(message: string): void {
    this.updateStatus('Ronda completada');
    this.renderResult(message, 'success');
    this.setOverlay('Ronda OK - Preparando siguiente...');
    // No cambiamos botones, mantenemos estado activo
  }

  showValidationError(message: string): void {
    this.updateStatus('Error de validacion');
    this.renderResult(message, 'error');
  }

  showError(message: string): void {
    this.updateStatus(message);
    this.renderResult(message, 'error');
    this.setOverlay('Camara inactiva');
    this.toggleButtons({ start: false, stop: true });
  }

  resetResult(): void {
    this.renderResult('Ningun codigo detectado todavia');
  }

  private updateStatus(message: string): void {
    if (this.refs.status) {
      this.refs.status.textContent = message;
    }
  }

  private setOverlay(message: string | null): void {
    if (!this.refs.overlay) return;
    if (!message) {
      this.refs.overlay.style.opacity = '0';
      this.refs.overlay.style.pointerEvents = 'none';
      this.refs.overlay.textContent = '';
      return;
    }
    this.refs.overlay.textContent = message;
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
