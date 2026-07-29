import crypto from 'crypto';
import argon2 from 'argon2';

const DEFAULT_PASSPHRASE = process.env.DATABASE_SECRET_KEY || "1fec0e752b9692981b0adf15537b22b6cc7a025038c08714ac4018a4a481b868";
const MAGIC_HEADER = Buffer.from([0x45, 0x45, 0x46, 0x31]); // "EEF1"

/**
 * Checks if payload has "EEF1" magic header
 */
export function isEncrypted(buffer) {
  if (!buffer || buffer.length < 48) return false;
  return buffer.subarray(0, 4).equals(MAGIC_HEADER);
}

/**
 * Encrypts data (Buffer or string) using Argon2id + AES-256-GCM
 */
export async function encryptDatabase(data, passphrase = DEFAULT_PASSPHRASE) {
  const plainBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);

  // Derive 32-byte key using Argon2id (matching C# parameters)
  const key = await argon2.hash(Buffer.from(passphrase, 'utf-8'), {
    salt,
    type: argon2.argon2id,
    hashLength: 32,
    memoryCost: 65536, // 64MB
    timeCost: 3,
    parallelism: 4,
    raw: true
  });

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  // Layout: [ 4B Magic | 16B Salt | 12B IV | 16B Tag | Ciphertext ]
  return Buffer.concat([MAGIC_HEADER, salt, iv, tag, ciphertext]);
}

/**
 * Decrypts Argon2id + AES-256-GCM payload back into Buffer
 */
export async function decryptDatabase(encryptedPayload, passphrase = DEFAULT_PASSPHRASE) {
  const payload = Buffer.isBuffer(encryptedPayload) ? encryptedPayload : Buffer.from(encryptedPayload);

  if (!isEncrypted(payload)) {
    throw new Error('Invalid encrypted database payload header.');
  }

  const salt = payload.subarray(4, 20);
  const iv = payload.subarray(20, 32);
  const tag = payload.subarray(32, 48);
  const ciphertext = payload.subarray(48);

  const key = await argon2.hash(Buffer.from(passphrase, 'utf-8'), {
    salt,
    type: argon2.argon2id,
    hashLength: 32,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    raw: true
  });

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
