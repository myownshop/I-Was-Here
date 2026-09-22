import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateDistanceAsync,
  formatDistance,
} from './geo';

describe('Haversine Distance Calculator', () => {
  it('returns 0 meters for identical coordinates', async () => {
    const lat = 6.5244;
    const lon = 3.3792;
    const distance = await calculateDistanceAsync(lat, lon, lat, lon);
    expect(distance).toBe(0);
  });

  it('correctly calculates distance between known points (Lagos Secretariat to Ikeja City Mall)', async () => {
    // Lagos State Secretariat Alausa: 6.6190, 3.3580
    // Ikeja City Mall: 6.6208, 3.3582
    // Expected distance ~200 meters
    const dist = await calculateDistanceAsync(6.6190, 3.3580, 6.6208, 3.3582);
    expect(dist).toBeGreaterThan(180);
    expect(dist).toBeLessThan(230);
  });

  it('correctly calculates long distance (Lagos to Abuja)', async () => {
    // Lagos: 6.5244, 3.3792
    // Abuja: 9.0765, 7.3986
    // Approximate distance ~530 km (530,000 meters)
    const dist = await calculateDistanceAsync(6.5244, 3.3792, 9.0765, 7.3986);
    expect(dist).toBeGreaterThan(500000);
    expect(dist).toBeLessThan(560000);
  });

  it('throws an error for invalid coordinates or non-numbers', () => {
    expect(() => calculateHaversineDistance(NaN, 3.37, 6.52, 3.38)).toThrow();
    expect(() => calculateHaversineDistance(95, 3.37, 6.52, 3.38)).toThrow('Invalid latitude');
    expect(() => calculateHaversineDistance(6.52, 200, 6.52, 3.38)).toThrow('Invalid longitude');
  });

  it('formats distance into human readable strings', () => {
    expect(formatDistance(45.2)).toBe('45 m');
    expect(formatDistance(950)).toBe('950 m');
    expect(formatDistance(1250)).toBe('1.25 km');
    expect(formatDistance(50000)).toBe('50.00 km');
  });
});
