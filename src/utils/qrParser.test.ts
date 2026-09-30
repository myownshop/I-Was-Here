import { describe, it, expect } from 'vitest';
import { extractCodeFromQR } from './qrParser';

describe('extractCodeFromQR utility', () => {
  it('extracts code from hash shortCode URLs (standard app format)', () => {
    const res = extractCodeFromQR('https://ais-dev-preview.run.app/#/c/med24');
    expect(res.code).toBe('med24');
    expect(res.type).toBe('shortCode');
  });

  it('extracts code from path URLs', () => {
    const res = extractCodeFromQR('https://iwashere.internal/c/lagos01');
    expect(res.code).toBe('lagos01');
    expect(res.type).toBe('shortCode');
  });

  it('extracts code from query parameter URLs', () => {
    const res = extractCodeFromQR('https://iwashere.internal/?c=x7y8z9');
    expect(res.code).toBe('x7y8z9');
    expect(res.type).toBe('shortCode');
  });

  it('extracts campaign ID from attend links', () => {
    const res = extractCodeFromQR('https://iwashere.internal/#/attend/camp_abc123456789');
    expect(res.code).toBe('camp_abc123456789');
    expect(res.type).toBe('campaignId');
  });

  it('extracts code from JSON QR payloads', () => {
    const res = extractCodeFromQR(JSON.stringify({ shortCode: 'ny2024' }));
    expect(res.code).toBe('ny2024');
    expect(res.type).toBe('shortCode');
  });

  it('handles raw alphanumeric short codes cleanly', () => {
    const res = extractCodeFromQR('med24');
    expect(res.code).toBe('med24');
    expect(res.type).toBe('shortCode');
  });
});
