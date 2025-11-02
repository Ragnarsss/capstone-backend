// Sección 2.4.1 - Enrolamiento vs Login
// Key Derivation (HKDF)

import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

function deriveHandshakeSecret(credentialId: string, userId: string): string {
  const ikm = Buffer.from(credentialId + userId + SERVER_MASTER_SECRET);
  const info = Buffer.from('attendance-handshake-v1');

  // Derive 32 bytes
  const derivedKey = hkdf(sha256, ikm, undefined, info, 32);

  return Buffer.from(derivedKey).toString('hex');
}
