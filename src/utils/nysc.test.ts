import { describe, it, expect } from 'vitest';
import {
  isValidStateCode,
  formatStateCodeInput,
  generateShortCode,
  STATE_CODE_REGEX,
} from './nysc';

describe('NYSC State Code Utilities', () => {
  it('validates standard NYSC State Code formats', () => {
    expect(isValidStateCode('LA/23B/1234')).toBe(true);
    expect(isValidStateCode('AB/24A/0091')).toBe(true);
    expect(isValidStateCode('FC/22C/56789')).toBe(true);
    expect(isValidStateCode('OY/21B/4321')).toBe(true);

    // Invalid formats
    expect(isValidStateCode('INVALID')).toBe(false);
    expect(isValidStateCode('12/23B/1234')).toBe(false); // State letters must be alpha
    expect(isValidStateCode('LA/23D/1234')).toBe(false); // Batch only A, B, or C
    expect(isValidStateCode('LA/23B/12')).toBe(false); // Too short
    expect(isValidStateCode('')).toBe(false);
  });

  it('formats raw user inputs by inserting slashes and capitalizing', () => {
    expect(formatStateCodeInput('la23b1234')).toBe('LA/23B/1234');
    expect(formatStateCodeInput('fc24a900')).toBe('FC/24A/900');
    expect(formatStateCodeInput('oy')).toBe('OY');
    expect(formatStateCodeInput('oy2')).toBe('OY/2');
  });

  it('generates 5-character alphanumeric short code', () => {
    const code1 = generateShortCode();
    const code2 = generateShortCode();

    expect(code1).toHaveLength(5);
    expect(code2).toHaveLength(5);
    expect(code1).toMatch(/^[a-z0-9]{5}$/);
    // Should exclude confusing characters '0', 'o', '1', 'l'
    expect(code1).not.toMatch(/[0o1l]/);
  });
});
