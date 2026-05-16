const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a string value using AES-256-GCM
 * Returns a Buffer suitable for storing in PostgreSQL BYTEA column
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Format: [IV (16 bytes)][Auth Tag (16 bytes)][Ciphertext]
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt a Buffer from PostgreSQL BYTEA column
 * Returns the original plaintext string
 */
function decrypt(buffer) {
  if (!buffer) return null;
  
  const key = getKey();
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  
  const iv = buf.slice(0, IV_LENGTH);
  const tag = buf.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.slice(IV_LENGTH + TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
