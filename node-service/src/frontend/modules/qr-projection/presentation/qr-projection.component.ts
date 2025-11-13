/**
 * QR Projection Component
 * Responsabilidad: Renderizado y actualización de UI para proyección de QR
 */
interface DOMElements {
  status: HTMLElement | null;
  countdown: HTMLElement | null;
  qrContainer: HTMLElement | null;
  qrImage: HTMLImageElement | null;
}

export class QRProjectionComponent {
  private readonly elements: DOMElements;

  constructor() {
    this.elements = {
      status: null,
      countdown: null,
      qrContainer: null,
      qrImage: null
    };
  }

  mount(): void {
    this.elements.status = document.getElementById('status');
    this.elements.countdown = document.getElementById('countdown');
    this.elements.qrContainer = document.getElementById('qr-container');
    this.elements.qrImage = document.getElementById('qr-image') as HTMLImageElement | null;
  }

  updateStatus(message: string): void {
    if (this.elements.status) {
      this.elements.status.textContent = message;
    }
  }

  showCountdown(seconds: number): void {
    if (this.elements.countdown && this.elements.qrContainer) {
      this.elements.countdown.style.display = 'block';
      this.elements.countdown.textContent = seconds.toString();
      this.elements.qrContainer.style.display = 'none';
      this.updateStatus('Iniciando en...');
    }
  }

  showQRCode(qrData: string): void {
    if (this.elements.countdown && this.elements.qrContainer && this.elements.qrImage) {
      this.elements.countdown.style.display = 'none';
      this.elements.qrContainer.style.display = 'block';
      this.elements.qrImage.src = qrData;
      this.updateStatus('Escanea el codigo QR para registrar asistencia');
    }
  }

  showError(message: string): void {
    if (this.elements.status) {
      this.elements.status.innerHTML = `<div class="error">${message}</div>`;
    }
  }

  showWaitingAuth(): void {
    this.updateStatus('Esperando autenticación...');
  }

  showConnecting(): void {
    this.updateStatus('Conectando...');
  }

  showConnected(): void {
    this.updateStatus('Preparando sistema...');
  }
}
