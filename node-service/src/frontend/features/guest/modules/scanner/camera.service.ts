/**
 * Camera Service
 * Responsabilidad: Manejo exclusivo de la cámara y stream de video
 * 
 * Este servicio NO procesa QR, solo maneja:
 * - Solicitar permisos de cámara
 * - Iniciar/detener stream de video
 * - Listar dispositivos de video disponibles
 */

export interface CameraDevice {
  deviceId: string;
  label: string;
  isBackCamera: boolean;
}

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Verifica si el navegador soporta acceso a cámara
   */
  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Verifica si estamos en contexto seguro (HTTPS o localhost)
   */
  isSecureContext(): boolean {
    return window.isSecureContext;
  }

  /**
   * Lista las cámaras disponibles
   */
  async listCameras(): Promise<CameraDevice[]> {
    if (!this.isSupported()) {
      throw new Error('Cámara no soportada en este navegador');
    }

    // Solicitar permiso temporal para obtener labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach(track => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    
    return devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Cámara ${device.deviceId.slice(0, 8)}`,
        isBackCamera: /back|rear|environment/i.test(device.label),
      }));
  }

  /**
   * Inicia la cámara y conecta al elemento video
   */
  async start(videoElement: HTMLVideoElement, preferBackCamera: boolean = true): Promise<void> {
    if (!this.isSecureContext()) {
      throw new Error('Se requiere HTTPS para acceder a la cámara');
    }

    if (!this.isSupported()) {
      throw new Error('Tu navegador no soporta acceso a cámara');
    }

    this.videoElement = videoElement;

    // Intentar obtener cámara trasera primero si se prefiere
    const constraints: MediaStreamConstraints = {
      video: preferBackCamera
        ? { facingMode: { ideal: 'environment' } }
        : { facingMode: 'user' },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = this.stream;
      await videoElement.play();
      console.log('[CameraService] Cámara iniciada');
    } catch (error) {
      // Si falla con cámara trasera, intentar con cualquiera
      if (preferBackCamera) {
        console.log('[CameraService] Cámara trasera no disponible, intentando frontal');
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        videoElement.srcObject = this.stream;
        await videoElement.play();
      } else {
        throw error;
      }
    }
  }

  /**
   * Detiene la cámara y libera recursos
   */
  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('[CameraService] Track detenido:', track.kind);
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    console.log('[CameraService] Cámara detenida');
  }

  /**
   * Verifica si la cámara está activa
   */
  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }

  /**
   * Obtiene el stream actual (para procesamiento externo)
   */
  getStream(): MediaStream | null {
    return this.stream;
  }
}

/**
 * Singleton para uso global
 */
let instance: CameraService | null = null;

export function getCameraService(): CameraService {
  if (!instance) {
    instance = new CameraService();
  }
  return instance;
}
