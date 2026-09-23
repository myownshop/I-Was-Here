import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateDistanceAsync,
  formatDistance,
  parseGoogleMapsUrlOrCoordinates,
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

describe('Google Maps URL & Coordinates Parser', () => {
  it('parses standard @lat,lng Google Maps URLs and extracts place name', () => {
    const url = 'https://www.google.com/maps/place/NYSC+Secretariat/@6.619024,3.358012,17z/data=!3m1!4b1';
    const result = parseGoogleMapsUrlOrCoordinates(url);
    expect(result.success).toBe(true);
    expect(result.latitude).toBeCloseTo(6.619024);
    expect(result.longitude).toBeCloseTo(3.358012);
    expect(result.venueName).toBe('NYSC Secretariat');
  });

  it('parses Google Maps URLs with query parameters (?q=lat,lng)', () => {
    const url = 'https://maps.google.com/?q=6.619024,3.358012';
    const result = parseGoogleMapsUrlOrCoordinates(url);
    expect(result.success).toBe(true);
    expect(result.latitude).toBe(6.619024);
    expect(result.longitude).toBe(3.358012);
  });

  it('parses Google Maps destination / direction links', () => {
    const url = 'https://www.google.com/maps/dir/?api=1&destination=9.0833,7.4950';
    const result = parseGoogleMapsUrlOrCoordinates(url);
    expect(result.success).toBe(true);
    expect(result.latitude).toBe(9.0833);
    expect(result.longitude).toBe(7.495);
  });

  it('parses raw coordinate string', () => {
    const result = parseGoogleMapsUrlOrCoordinates('6.619024, 3.358012');
    expect(result.success).toBe(true);
    expect(result.latitude).toBe(6.619024);
    expect(result.longitude).toBe(3.358012);
  });

  it('parses DMS coordinate format', () => {
    const result = parseGoogleMapsUrlOrCoordinates(`6°37'08.4"N 3°21'28.8"E`);
    expect(result.success).toBe(true);
    expect(result.latitude).toBeCloseTo(6.619, 2);
    expect(result.longitude).toBeCloseTo(3.358, 2);
  });

  it('returns informative guide for shortened share links', () => {
    const result = parseGoogleMapsUrlOrCoordinates('https://maps.app.goo.gl/abcdef123');
    expect(result.success).toBe(false);
    expect(result.sourceType).toBe('short_url');
  });
});

