import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

describe('crypto', () => {
  it('encrypt() returns iv:authTag:encrypted hex format', () => {
    const result = encrypt('hello');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    // Each part should be valid hex
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/);
    }
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
  });

  it('decrypt(encrypt(plaintext)) returns original plaintext', () => {
    const plaintext = 'my-secret-password-123!@#';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypt() produces different output each call (unique IV)', () => {
    const plaintext = 'same-input';
    const result1 = encrypt(plaintext);
    const result2 = encrypt(plaintext);
    expect(result1).not.toBe(result2);
    // But both decrypt to the same value
    expect(decrypt(result1)).toBe(plaintext);
    expect(decrypt(result2)).toBe(plaintext);
  });

  it('decrypt() throws on corrupted data', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    // Corrupt the encrypted data
    const corrupted = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;
    expect(() => decrypt(corrupted)).toThrow();
  });

  it('decrypt() throws on invalid format', () => {
    expect(() => decrypt('not-valid-format')).toThrow('Invalid ciphertext format');
    expect(() => decrypt('a:b')).toThrow('Invalid ciphertext format');
    expect(() => decrypt('a:b:c:d')).toThrow('Invalid ciphertext format');
  });

  it('handles empty string encryption', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('handles unicode content', () => {
    const plaintext = 'mot de passe: café ☕ 日本語';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });
});
