// Sección 2.4.3 - Flujo de Captura y Decodificación Inmediata
// AttendanceScanner class

import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';

class AttendanceScanner {
  private myDataFragment: Uint8Array;
  private handshakeKey: CryptoKey;
  private TOTPu: string;

  async startScanning() {
    const scanner = new Html5Qrcode('reader');

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: 250 },

      // ❌ NO usar este callback (ya está decodificado)
      (decodedText) => { /* Too late */ },

      // ❌ Error callback tampoco sirve
      (error) => { /* Already failed */ }
    );

    // ✅ SOLUCIÓN: Interceptar a nivel de ImageData antes de jsQR
    this.interceptVideoFrame(scanner);
  }

  private interceptVideoFrame(scanner: Html5Qrcode) {
    // Acceder al canvas interno (hack, depende de implementación)
    const canvas = document.querySelector('#reader canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const processFrame = () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 1. Intentar decodificar sin modificar (puede ser QR de otro usuario completo)
      let decoded = jsQR(imageData.data, canvas.width, canvas.height);

      if (!decoded) {
        // 2. No se pudo decodificar → probablemente es MI QR (incompleto)
        // Insertar mi fragmento antes de re-intentar
        const reconstructed = this.injectFragment(imageData);
        decoded = jsQR(reconstructed.data, canvas.width, canvas.height);

        if (decoded) {
          // ✅ Éxito! Es mi QR reconstruido
          this.handleMyQR(decoded.data);
        }
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  private injectFragment(imageData: ImageData): ImageData {
    // 1. Detectar QR y extraer BitMatrix
    const qrLocation = this.detectQRLocation(imageData);
    if (!qrLocation) return imageData;

    // 2. Extraer módulos actuales
    const currentModules = this.extractModules(imageData, qrLocation);

    // 3. Identificar región faltante (módulos en 0 contiguos)
    const missingRegion = this.findMissingRegion(currentModules);

    // 4. Insertar mi fragmento
    const reconstructed = this.insertMyFragment(
      imageData,
      missingRegion,
      this.myDataFragment
    );

    return reconstructed;
  }

  private async handleMyQR(payload: string) {
    try {
      // Parsear payload del QR
      const qrData = JSON.parse(payload);
      const { sessionId, TOTPs, timestamp } = qrData;

      // Construir mensaje para servidor
      const message = {
        userId: this.userId,
        sessionId,
        TOTPs,
        clientTimestamp: Date.now(),
        qrTimestamp: timestamp
      };

      // Encriptar con key derivada del handshake
      const encrypted = await this.encryptWithHandshake(message);

      // Enviar a servidor (incluye TOTPu en header)
      await fetch('/api/attendance/validate', {
        method: 'POST',
        headers: {
          'X-TOTP-User': this.TOTPu,
          'Content-Type': 'application/octet-stream'
        },
        body: encrypted
      });

    } catch (err) {
      console.error('QR processing failed', err);
    }
  }

  private async encryptWithHandshake(data: any): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));

    // AES-GCM con key derivada del handshake
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.handshakeKey,  // Derivada en enrolamiento/login
      plaintext
    );

    // Retornar: iv + ciphertext
    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(ciphertext), iv.length);

    return result.buffer;
  }
}
