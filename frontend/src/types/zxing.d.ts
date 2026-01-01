/**
 * ZXing Type Declarations
 * Los paquetes @zxing/browser y @zxing/library no incluyen tipos oficiales
 */

declare module '@zxing/browser' {
  export interface IScannerControls {
    stop(): void;
  }

  export class BrowserMultiFormatReader {
    decodeFromVideoDevice(
      deviceId: string | null,
      videoElementId: string,
      callback: (result: import('@zxing/library').Result | undefined, error: import('@zxing/library').Exception | undefined) => void
    ): Promise<IScannerControls>;

    static listVideoInputDevices(): Promise<MediaDeviceInfo[]>;
  }
}

declare module '@zxing/library' {
  export class Result {
    getText(): string;
    getBarcodeFormat(): string;
    getTimestamp(): number;
  }

  export class Exception extends Error {
    getKind(): string;
  }

  export class NotFoundException extends Exception {}
  export class ChecksumException extends Exception {}
  export class FormatException extends Exception {}
}
