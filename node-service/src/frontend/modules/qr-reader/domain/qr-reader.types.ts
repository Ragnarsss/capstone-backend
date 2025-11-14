/**
 * QR Reader Domain Types
 * Responsabilidad: Definir contratos de estado y eventos del lector
 */

export type ScannerStatus =
  | 'idle'
  | 'waiting-auth'
  | 'ready'
  | 'scanning'
  | 'error';

export interface ScannerState {
  status: ScannerStatus;
  lastMessage: string | null;
}

export interface ScannerResult {
  text: string;
  timestamp: number;
}

export type ScannerCallback = (result: ScannerResult) => void;

export interface ScannerError {
  message: string;
}
