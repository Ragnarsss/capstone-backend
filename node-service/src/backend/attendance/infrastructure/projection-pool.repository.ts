import { ValkeyClient } from '../../../shared/infrastructure/valkey/valkey-client';

/**
 * Entrada del pool de proyección
 * Representa un QR que se proyectará en pantalla
 */
export interface PoolEntry {
  /** ID único de la entrada */
  id: string;
  /** Payload encriptado del QR */
  encrypted: string;
  /** ID del estudiante (0 = QR falso) */
  studentId: number;
  /** Round del QR (1-3) */
  round: number;
  /** Timestamp de creación */
  createdAt: number;
  /** Es un QR falso? */
  isFake: boolean;
}

/**
 * Repository para el Pool de Proyección
 * 
 * Responsabilidad: Gestionar la lista de QRs que el proyector debe ciclar
 * 
 * Claves en Valkey:
 * - pool:session:{sessionId} → LIST de PoolEntry (JSON)
 * - pool:index:{sessionId} → Índice actual del ciclo
 */
export class ProjectionPoolRepository {
  private client = ValkeyClient.getInstance().getClient();
  
  /** TTL del pool (2 horas) */
  private readonly poolTTL = 7200;
  
  private static readonly POOL_PREFIX = 'pool:session:';
  private static readonly INDEX_PREFIX = 'pool:index:';

  /**
   * Agrega un QR al pool de proyección
   */
  async addToPool(sessionId: string, entry: PoolEntry): Promise<void> {
    const key = this.buildPoolKey(sessionId);
    await this.client.rpush(key, JSON.stringify(entry));
    await this.client.expire(key, this.poolTTL);
    
    console.log(`[ProjectionPool] Added ${entry.isFake ? 'FAKE' : 'student=' + entry.studentId} to pool session=${sessionId.substring(0, 8)}...`);
  }

  /**
   * Remueve un QR del pool por ID de entrada
   */
  async removeFromPool(sessionId: string, entryId: string): Promise<boolean> {
    const entries = await this.getAllEntries(sessionId);
    const filtered = entries.filter(e => e.id !== entryId);
    
    if (filtered.length === entries.length) {
      return false; // No se encontró
    }

    // Reescribir el pool sin la entrada
    const key = this.buildPoolKey(sessionId);
    await this.client.del(key);
    
    for (const entry of filtered) {
      await this.client.rpush(key, JSON.stringify(entry));
    }
    await this.client.expire(key, this.poolTTL);
    
    return true;
  }

  /**
   * Actualiza el QR de un estudiante en el pool
   * Si ya existe, lo reemplaza; si no, lo agrega
   */
  async upsertStudentQR(sessionId: string, studentId: number, encrypted: string, round: number): Promise<string> {
    const entries = await this.getAllEntries(sessionId);
    const existingIndex = entries.findIndex(e => e.studentId === studentId && !e.isFake);
    
    const entryId = `student-${studentId}-${Date.now()}`;
    const newEntry: PoolEntry = {
      id: entryId,
      encrypted,
      studentId,
      round,
      createdAt: Date.now(),
      isFake: false,
    };

    if (existingIndex !== -1) {
      // Reemplazar entrada existente
      entries[existingIndex] = newEntry;
    } else {
      // Agregar nueva entrada
      entries.push(newEntry);
    }

    // Reescribir el pool
    await this.rewritePool(sessionId, entries);
    
    console.log(`[ProjectionPool] Upserted student=${studentId} round=${round} in session=${sessionId.substring(0, 8)}...`);
    return entryId;
  }

  /**
   * Obtiene todas las entradas del pool
   */
  async getAllEntries(sessionId: string): Promise<PoolEntry[]> {
    const key = this.buildPoolKey(sessionId);
    const items = await this.client.lrange(key, 0, -1);
    
    return items.map(item => {
      try {
        return JSON.parse(item) as PoolEntry;
      } catch {
        console.error('[ProjectionPool] Error parsing entry:', item);
        return null;
      }
    }).filter((e): e is PoolEntry => e !== null);
  }

  /**
   * Obtiene la siguiente entrada del pool (round-robin)
   * Avanza el índice automáticamente
   */
  async getNextEntry(sessionId: string): Promise<PoolEntry | null> {
    const entries = await this.getAllEntries(sessionId);
    if (entries.length === 0) {
      return null;
    }

    // Obtener índice actual
    const indexKey = this.buildIndexKey(sessionId);
    const currentIndex = parseInt(await this.client.get(indexKey) || '0', 10);
    
    // Calcular siguiente índice (round-robin)
    const nextIndex = (currentIndex + 1) % entries.length;
    await this.client.setex(indexKey, this.poolTTL, String(nextIndex));
    
    return entries[currentIndex] || entries[0];
  }

  /**
   * Obtiene el conteo de entradas por tipo
   */
  async getPoolStats(sessionId: string): Promise<{ total: number; students: number; fakes: number }> {
    const entries = await this.getAllEntries(sessionId);
    return {
      total: entries.length,
      students: entries.filter(e => !e.isFake).length,
      fakes: entries.filter(e => e.isFake).length,
    };
  }

  /**
   * Agrega QRs falsos al pool
   * @param count Cantidad de QRs falsos a agregar
   * @param generateFake Función para generar el QR falso encriptado
   */
  async addFakeQRs(
    sessionId: string, 
    count: number, 
    generateFake: () => string
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      const entry: PoolEntry = {
        id: `fake-${Date.now()}-${i}`,
        encrypted: generateFake(),
        studentId: 0,
        round: Math.ceil(Math.random() * 3), // Round aleatorio 1-3
        createdAt: Date.now(),
        isFake: true,
      };
      await this.addToPool(sessionId, entry);
    }
    
    console.log(`[ProjectionPool] Added ${count} fake QRs to session=${sessionId.substring(0, 8)}...`);
  }

  /**
   * Limpia todo el pool de una sesión
   */
  async clearPool(sessionId: string): Promise<void> {
    const poolKey = this.buildPoolKey(sessionId);
    const indexKey = this.buildIndexKey(sessionId);
    await this.client.del(poolKey, indexKey);
  }

  /**
   * Reescribe el pool completo
   */
  private async rewritePool(sessionId: string, entries: PoolEntry[]): Promise<void> {
    const key = this.buildPoolKey(sessionId);
    await this.client.del(key);
    
    for (const entry of entries) {
      await this.client.rpush(key, JSON.stringify(entry));
    }
    await this.client.expire(key, this.poolTTL);
  }

  private buildPoolKey(sessionId: string): string {
    return `${ProjectionPoolRepository.POOL_PREFIX}${sessionId}`;
  }

  private buildIndexKey(sessionId: string): string {
    return `${ProjectionPoolRepository.INDEX_PREFIX}${sessionId}`;
  }
}
