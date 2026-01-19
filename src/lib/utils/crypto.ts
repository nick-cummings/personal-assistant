import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte base64-encoded string');
  }
  return keyBuffer;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: base64(iv) + '.' + base64(authTag) + '.' + base64(encrypted)
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivBase64, authTagBase64, encryptedData] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function encryptJson<T>(data: T): string {
  return encrypt(JSON.stringify(data));
}

export function decryptJson<T>(encrypted: string): T {
  return JSON.parse(decrypt(encrypted)) as T;
}
