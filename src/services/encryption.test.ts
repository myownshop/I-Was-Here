import { describe, it, expect } from 'vitest';
import {
  encryptOfflineRecord,
  decryptOfflineRecord,
  formatIwhFilename,
  generateIwhFileDownload,
  calculateChecksum,
} from './encryption';
import { OfflineAttendanceRecord } from '../types/attendance';

describe('Symmetric Encryption Service (CryptoJS Engine)', () => {
  const sampleRecord: OfflineAttendanceRecord = {
    name: 'Champion Afolayan',
    stateCode: 'LA/24B/1234',
    campaignId: 'camp_ikeja_cds_01',
    orgId: 'org_nysc_lagos',
    timestamp: '2026-09-22T09:30:00.000Z',
    latitude: 6.5954,
    longitude: 3.3421,
    distanceMeters: 18.5,
    base64Image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
    version: '2.0',
    tampered: false,
    timeBlockCode: 'X12',
  };

  it('formats filename as [StateCode]-[Date].iwh with filesystem safety', () => {
    const filename1 = formatIwhFilename('LA/24B/1234', '2026-09-22T09:30:00.000Z');
    expect(filename1).toBe('LA_24B_1234-2026-09-22.iwh');

    const filename2 = formatIwhFilename('KD/23C/9999', '2026-10-15');
    expect(filename2).toBe('KD_23C_9999-2026-10-15.iwh');
  });

  it('encrypts and decrypts with coordinates, tampered flag, and base64 facial image preserved', async () => {
    const encrypted = await encryptOfflineRecord(sampleRecord);

    expect(encrypted.format).toBe('IWH_ENCRYPTED_V1');
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.salt).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.metadata.stateCode).toBe('LA/24B/1234');
    expect(encrypted.metadata.date).toBe('2026-09-22');

    // Decrypt and verify payload
    const decrypted = await decryptOfflineRecord(JSON.stringify(encrypted));
    expect(decrypted.name).toBe('Champion Afolayan');
    expect(decrypted.stateCode).toBe('LA/24B/1234');
    expect(decrypted.latitude).toBeCloseTo(6.5954);
    expect(decrypted.longitude).toBeCloseTo(3.3421);
    expect(decrypted.distanceMeters).toBe(18.5);
    expect(decrypted.base64Image).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...');
    expect(decrypted.tampered).toBe(false);
    expect(decrypted.timeBlockCode).toBe('X12');
  });

  it('correctly preserves and decodes tampered flag when hardware timer divergence is flagged', async () => {
    const tamperedRecord: OfflineAttendanceRecord = {
      ...sampleRecord,
      stateCode: 'AB/24A/5678',
      tampered: true,
    };

    const encrypted = await encryptOfflineRecord(tamperedRecord);
    const decrypted = await decryptOfflineRecord(JSON.stringify(encrypted));

    expect(decrypted.stateCode).toBe('AB/24A/5678');
    expect(decrypted.tampered).toBe(true);
  });

  it('calculates reproducible SHA-256 checksums', () => {
    const checksum1 = calculateChecksum('TestPayloadString');
    const checksum2 = calculateChecksum('TestPayloadString');
    expect(checksum1).toBe(checksum2);
    expect(checksum1.length).toBeGreaterThan(10);
  });

  it('rejects invalid or corrupted payloads', async () => {
    await expect(decryptOfflineRecord('')).rejects.toThrow();
    await expect(decryptOfflineRecord('corrupted data string')).rejects.toThrow();
  });
});
