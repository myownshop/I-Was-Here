import { describe, it, expect } from 'vitest';
import { encryptOfflineRecord, decryptOfflineRecord } from './crypto';
import { OfflineAttendanceRecord } from '../types/attendance';

describe('crypto encryption & decryption', () => {
  const sampleRecord: OfflineAttendanceRecord = {
    name: 'Champion Afolayan',
    stateCode: 'LA/23B/1234',
    campaignId: 'camp_test_123',
    orgId: 'org_test_123',
    timestamp: '2026-09-22T10:00:00.000Z',
    latitude: 6.5954,
    longitude: 3.3421,
    distanceMeters: 14.2,
    base64Image: 'data:image/jpeg;base64,samplephoto123',
    version: '1.0',
  };

  it('encrypts and successfully decrypts an offline attendance record', async () => {
    const encrypted = await encryptOfflineRecord(sampleRecord);

    expect(encrypted.format).toBe('IWH_ENCRYPTED_V1');
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.metadata.stateCode).toBe('LA/23B/1234');

    const decrypted = await decryptOfflineRecord(JSON.stringify(encrypted));
    expect(decrypted.name).toBe('Champion Afolayan');
    expect(decrypted.stateCode).toBe('LA/23B/1234');
    expect(decrypted.distanceMeters).toBe(14.2);
    expect(decrypted.base64Image).toBe('data:image/jpeg;base64,samplephoto123');
  });

  it('rejects tampered ciphertext', async () => {
    const encrypted = await encryptOfflineRecord(sampleRecord);
    // Tamper with ciphertext
    const tampered = {
      ...encrypted,
      ciphertext: 'AAAA' + encrypted.ciphertext.substring(4),
    };

    await expect(decryptOfflineRecord(JSON.stringify(tampered))).rejects.toThrow();
  });
});
