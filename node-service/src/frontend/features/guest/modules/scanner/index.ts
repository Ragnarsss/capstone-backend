/**
 * Scanner Module - Barrel Export
 */
export {
  CameraService,
  getCameraService,
  type CameraDevice,
} from './camera.service';

export {
  ScannerService,
  getScannerService,
  type QRDetection,
  type QRDetectionCallback,
  type ScannerErrorCallback,
} from './scanner.service';
