/**
 * Remote Logger Service
 * Envía logs al servidor para debugging en móviles
 */

interface LogEntry {
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  data?: unknown;
  timestamp: string;
}

export class RemoteLoggerService {
  private logs: LogEntry[] = [];
  private baseUrl: string;
  private flushInterval: number | null = null;
  private authToken: string | null = null;

  constructor() {
    // Detectar URL base igual que enrollment service
    const isEmbeddedInPhp = window.location.port === '9500' || 
                            window.location.port === '9505' ||
                            window.location.port === '';
    this.baseUrl = isEmbeddedInPhp ? '/minodo-api/enrollment' : '/api/enrollment';
    
    // Obtener token del localStorage
    this.authToken = localStorage.getItem('jwt_token');
    
    // Flush logs cada 2 segundos
    this.flushInterval = window.setInterval(() => this.flush(), 2000);
    
    // Flush al cerrar la página
    window.addEventListener('beforeunload', () => this.flush());
    
    // Log inicial
    this.log('info', 'RemoteLogger initialized', { 
      url: window.location.href,
      userAgent: navigator.userAgent,
      hasToken: !!this.authToken
    });
  }

  log(level: LogEntry['level'], message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    
    this.logs.push(entry);
    
    // También log a consola local
    const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : level === 'success' ? '[OK]' : '[INFO]';
    console.log(`${prefix} [RemoteLog] ${message}`, data ?? '');
    
    // Flush inmediato para errores
    if (level === 'error') {
      this.flush();
    }
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  success(message: string, data?: unknown): void {
    this.log('success', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  private async flush(): Promise<void> {
    if (this.logs.length === 0) return;
    
    const logsToSend = [...this.logs];
    this.logs = [];
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      await fetch(`${this.baseUrl}/client-log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // Si falla, volver a agregar los logs
      this.logs = [...logsToSend, ...this.logs];
      console.error('[RemoteLogger] Failed to send logs:', error);
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Singleton para uso global
let instance: RemoteLoggerService | null = null;

export function getRemoteLogger(): RemoteLoggerService {
  if (!instance) {
    instance = new RemoteLoggerService();
  }
  return instance;
}
