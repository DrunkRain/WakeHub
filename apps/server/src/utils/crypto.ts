import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // NIST recommended for GCM
const AUTH_TAG_LENGTH = 16;

function deriveKey(rawKey: string): Buffer {
  // If 64 hex chars (32 bytes) → use directly
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  // Otherwise derive a 32-byte key via SHA-256
  return createHash('sha256').update(rawKey).digest();
}

export function encrypt(plaintext: string): string {
  const key = deriveKey(config.encryptionKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected iv:authTag:encrypted');
  }

  const ivHex = parts[0]!;
  const authTagHex = parts[1]!;
  const encryptedHex = parts[2]!;
  const key = deriveKey(config.encryptionKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
