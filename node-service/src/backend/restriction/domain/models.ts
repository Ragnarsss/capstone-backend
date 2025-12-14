/**
 * Domain models para Restriction
 */

/**
 * Result of restriction check
 */
export interface RestrictionResult {
  /** Whether the user is blocked from access */
  blocked: boolean;
  /** Reason for blocking (if blocked) */
  reason?: string;
  /** When the restriction ends (if known) */
  endsAt?: Date;
  /** Type of restriction */
  type?: 'schedule' | 'suspension' | 'temporary_block';
}
