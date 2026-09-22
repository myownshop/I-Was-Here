/**
 * IWasHere Military-Grade AES-GCM Encryption / Decryption Engine
 * for Zero-Network Offline Attendance (.iwh files).
 */

import { EncryptedIwhFile, OfflineAttendanceRecord } from '../types/attendance';

// Master derivation passphrase used for tenant offline package verification
const DEFAULT_SYSTEM_PASSPHRASE = 'IWasHere-Secure-Tenancy-AES256-Attendance-2026';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a 256-bit AES-GCM key from a passphrase and salt using PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Calculates SHA-256 checksum of a string.
 */
async function calculateChecksum(dataStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(dataStr));
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Encrypts an offline attendance payload into an AES-GCM encrypted package.
 */
export async function encryptOfflineRecord(
  record: OfflineAttendanceRecord,
  passphrase = DEFAULT_SYSTEM_PASSPHRASE
): Promise<EncryptedIwhFile> {
  const encoder = new TextEncoder();
  const plainJson = JSON.stringify(record);
  const checksum = await calculateChecksum(plainJson);

  // Generate cryptographic salt (16 bytes) and IV (12 bytes for AES-GCM)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(passphrase, salt);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encoder.encode(plainJson)
  );

  const dateStr = record.timestamp.split('T')[0];

  return {
    format: 'IWH_ENCRYPTED_V1',
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    checksum,
    metadata: {
      stateCode: record.stateCode,
      date: dateStr,
      campaignId: record.campaignId,
      orgId: record.orgId,
    },
  };
}

/**
 * Decrypts and verifies an .iwh file payload.
 */
export async function decryptOfflineRecord(
  fileContent: string,
  passphrase = DEFAULT_SYSTEM_PASSPHRASE
): Promise<OfflineAttendanceRecord> {
  let parsed: EncryptedIwhFile;
  try {
    parsed = JSON.parse(fileContent.trim());
  } catch {
    throw new Error('Invalid .iwh file format: Not a valid JSON payload.');
  }

  if (parsed.format !== 'IWH_ENCRYPTED_V1' || !parsed.ciphertext || !parsed.salt || !parsed.iv) {
    throw new Error('Unsupported or corrupted .iwh file format.');
  }

  const saltBuffer = new Uint8Array(base64ToArrayBuffer(parsed.salt));
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(parsed.iv));
  const ciphertextBuffer = base64ToArrayBuffer(parsed.ciphertext);

  const key = await deriveKey(passphrase, saltBuffer);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer as unknown as BufferSource,
      },
      key,
      ciphertextBuffer
    );
  } catch {
    throw new Error('Decryption failed: Key mismatch or tampered .iwh file.');
  }

  const decoder = new TextDecoder();
  const plainJson = decoder.decode(decryptedBuffer);

  // Verify SHA-256 integrity
  const actualChecksum = await calculateChecksum(plainJson);
  if (parsed.checksum && actualChecksum !== parsed.checksum) {
    throw new Error('Integrity check failed: Checksum does not match plain data.');
  }

  const record: OfflineAttendanceRecord = JSON.parse(plainJson);
  return record;
}

/**
 * Triggers a browser download of an encrypted .iwh file.
 */
export function downloadIwhFile(encryptedPackage: EncryptedIwhFile): string {
  const cleanStateCode = encryptedPackage.metadata.stateCode.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanStateCode}-${encryptedPackage.metadata.date}.iwh`;

  const blob = new Blob([JSON.stringify(encryptedPackage, null, 2)], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}
