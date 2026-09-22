import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isNavigatorOnline,
  dataUrlToBlob,
  DB_NAME,
  ATTENDANCE_STORE,
} from './indexedDB';

describe('PWA IndexedDB Offline Attendance Storage Utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes correct DB name and object store name constants', () => {
    expect(DB_NAME).toBe('iwashere_pwa_offline_db');
    expect(ATTENDANCE_STORE).toBe('pending_attendance_records');
  });

  it('detects online status using navigator.onLine', () => {
    expect(typeof isNavigatorOnline()).toBe('boolean');
  });

  it('converts base64 Data URL to binary Blob', () => {
    // 1x1 transparent PNG data URL
    const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const blob = dataUrlToBlob(testDataUrl);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles invalid dataUrl gracefully by returning fallback Blob', () => {
    const invalidUrl = 'not-a-valid-data-url';
    const blob = dataUrlToBlob(invalidUrl);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
  });
});
