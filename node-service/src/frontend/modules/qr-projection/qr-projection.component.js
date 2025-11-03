/**
 * QR Projection Component
 * Responsabilidad: Renderizado y actualización de UI para proyección de QR
 */
export class QRProjectionComponent {
  constructor() {
    this.elements = {
      status: null,
      countdown: null,
      qrContainer: null,
      qrImage: null
    };
  }

  mount() {
    this.elements.status = document.getElementById('status');
    this.elements.countdown = document.getElementById('countdown');
    this.elements.qrContainer = document.getElementById('qr-container');
    this.elements.qrImage = document.getElementById('qr-image');
  }

  updateStatus(message) {
    if (this.elements.status) {
      this.elements.status.textContent = message;
    }
  }

  showCountdown(seconds) {
    if (this.elements.countdown && this.elements.qrContainer) {
      this.elements.countdown.style.display = 'block';
      this.elements.countdown.textContent = seconds;
      this.elements.qrContainer.style.display = 'none';
      this.updateStatus('Iniciando en...');
    }
  }

  showQRCode(qrData) {
    if (this.elements.countdown && this.elements.qrContainer && this.elements.qrImage) {
      this.elements.countdown.style.display = 'none';
      this.elements.qrContainer.style.display = 'block';
      this.elements.qrImage.src = qrData;
      this.updateStatus('Escanea el codigo QR para registrar asistencia');
    }
  }

  showError(message) {
    if (this.elements.status) {
      this.elements.status.innerHTML = `<div class="error">${message}</div>`;
    }
  }

  showWaitingAuth() {
    this.updateStatus('Esperando autenticación...');
  }

  showConnecting() {
    this.updateStatus('Conectando...');
  }

  showConnected() {
    this.updateStatus('Preparando sistema...');
  }
}
