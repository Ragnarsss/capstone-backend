import { PostgresPool } from '../../../../shared/infrastructure/database';
import type { Device, CreateDeviceDto, UpdateCounterDto } from '../../domain/entities';

/**
 * Row type para mapeo de PostgreSQL
 */
interface DeviceRow {
  device_id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  handshake_secret: string;
  aaguid: string;
  device_fingerprint: string;
  attestation_format: string | null;
  sign_count: number;
  enrolled_at: Date;
  last_used_at: Date | null;
  is_active: boolean;
  transports: string | null; // JSON string
}

/**
 * Repository para dispositivos FIDO2
 * Responsabilidad única: CRUD de enrollment.devices en PostgreSQL
 */
export class DeviceRepository {
  private pool = PostgresPool.getInstance();

  /**
   * Crea un nuevo dispositivo enrolado
   */
  async create(dto: CreateDeviceDto): Promise<Device> {
    const query = `
      INSERT INTO enrollment.devices (
        user_id,
        credential_id,
        public_key,
        handshake_secret,
        aaguid,
        device_fingerprint,
        attestation_format,
        sign_count,
        transports
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      dto.userId,
      dto.credentialId,
      dto.publicKey,
      dto.handshakeSecret,
      dto.aaguid,
      dto.deviceFingerprint,
      dto.attestationFormat || null,
      dto.signCount || 0,
      dto.transports ? JSON.stringify(dto.transports) : null,
    ];

    const result = await this.pool.query<DeviceRow>(query, values);
    return this.mapRowToDevice(result.rows[0]);
  }

  /**
   * Busca dispositivo por ID
   */
  async findById(deviceId: number): Promise<Device | null> {
    const query = `
      SELECT * FROM enrollment.devices
      WHERE device_id = $1 AND is_active = TRUE
    `;

    const result = await this.pool.query<DeviceRow>(query, [deviceId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDevice(result.rows[0]);
  }

  /**
   * Busca dispositivo por credential_id (solo activos)
   */
  async findByCredentialId(credentialId: string): Promise<Device | null> {
    const query = `
      SELECT * FROM enrollment.devices
      WHERE credential_id = $1 AND is_active = TRUE
    `;

    const result = await this.pool.query<DeviceRow>(query, [credentialId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDevice(result.rows[0]);
  }

  /**
   * Busca dispositivo por credential_id incluyendo inactivos
   * Usado para política 1:1: detectar si dispositivo estuvo enrolado por otro usuario
   */
  async findByCredentialIdIncludingInactive(credentialId: string): Promise<Device | null> {
    const query = `
      SELECT * FROM enrollment.devices
      WHERE credential_id = $1
      ORDER BY is_active DESC, enrolled_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query<DeviceRow>(query, [credentialId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDevice(result.rows[0]);
  }

  /**
   * Busca todos los dispositivos activos de un usuario
   */
  async findByUserId(userId: number): Promise<Device[]> {
    const query = `
      SELECT * FROM enrollment.devices
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY enrolled_at DESC
    `;

    const result = await this.pool.query<DeviceRow>(query, [userId]);
    return result.rows.map((row: DeviceRow) => this.mapRowToDevice(row));
  }

  /**
   * Actualiza el contador de firmas (anti-clonación)
   */
  async updateCounter(dto: UpdateCounterDto): Promise<void> {
    const query = `
      UPDATE enrollment.devices
      SET sign_count = $1, last_used_at = NOW()
      WHERE device_id = $2
    `;

    await this.pool.query(query, [dto.newCounter, dto.deviceId]);
  }

  /**
   * Actualiza timestamp de último uso
   */
  async updateLastUsed(deviceId: number): Promise<void> {
    const query = `
      UPDATE enrollment.devices
      SET last_used_at = NOW()
      WHERE device_id = $1
    `;

    await this.pool.query(query, [deviceId]);
  }

  /**
   * Revoca un dispositivo (soft delete)
   */
  async revoke(deviceId: number, reason?: string): Promise<void> {
    await this.pool.transaction(async (client) => {
      // Desactivar dispositivo
      await client.query(
        `UPDATE enrollment.devices SET is_active = FALSE WHERE device_id = $1`,
        [deviceId]
      );

      // Registrar en historial
      await client.query(
        `INSERT INTO enrollment.enrollment_history 
          (device_id, user_id, action, reason) 
         SELECT device_id, user_id, 'revoked', $2 
         FROM enrollment.devices 
         WHERE device_id = $1`,
        [deviceId, reason || 'User requested revocation']
      );
    });
  }

  /**
   * Cuenta dispositivos activos de un usuario
   */
  async countByUserId(userId: number): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM enrollment.devices
      WHERE user_id = $1 AND is_active = TRUE
    `;

    const result = await this.pool.query<{ count: string }>(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Verifica si un usuario tiene dispositivos enrolados
   */
  async hasEnrolledDevices(userId: number): Promise<boolean> {
    const count = await this.countByUserId(userId);
    return count > 0;
  }

  /**
   * Revoca todos los dispositivos activos de un usuario
   * Usado para política 1:1: auto-desvincular antes de nuevo enrollment
   * @returns número de dispositivos revocados
   */
  async revokeAllByUserId(userId: number, reason?: string): Promise<number> {
    const result = await this.pool.transaction(async (client) => {
      // Obtener IDs de dispositivos activos
      const devicesResult = await client.query<{ device_id: number }>(
        `SELECT device_id FROM enrollment.devices WHERE user_id = $1 AND is_active = TRUE`,
        [userId]
      );

      if (devicesResult.rows.length === 0) {
        return 0;
      }

      const deviceIds = devicesResult.rows.map(r => r.device_id);

      // Desactivar todos los dispositivos
      await client.query(
        `UPDATE enrollment.devices SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE`,
        [userId]
      );

      // Registrar en historial para cada dispositivo
      for (const deviceId of deviceIds) {
        await client.query(
          `INSERT INTO enrollment.enrollment_history 
            (device_id, user_id, action, reason) 
           VALUES ($1, $2, 'revoked', $3)`,
          [deviceId, userId, reason || 'Auto-revoked: 1:1 policy enforcement']
        );
      }

      return deviceIds.length;
    });

    return result;
  }

  /**
   * Mapea row de PostgreSQL a entidad Device
   */
  private mapRowToDevice(row: DeviceRow): Device {
    return {
      deviceId: row.device_id,
      userId: row.user_id,
      credentialId: row.credential_id,
      publicKey: row.public_key,
      handshakeSecret: row.handshake_secret,
      aaguid: row.aaguid,
      deviceFingerprint: row.device_fingerprint,
      attestationFormat: row.attestation_format,
      signCount: row.sign_count,
      enrolledAt: row.enrolled_at,
      lastUsedAt: row.last_used_at,
      isActive: row.is_active,
      transports: row.transports ? JSON.parse(row.transports) : undefined,
    };
  }
}
