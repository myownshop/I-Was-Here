import { describe, it, expect } from 'vitest';
import {
  WAT_TIMEZONE,
  getTodayWATDateString,
  getWATDateString,
  formatWATTime,
  formatWATDate,
  formatWATDateTime,
  getWATHour,
  isTimeInWindow,
} from './dateUtils';

describe('West Africa Time (WAT) Utilities', () => {
  it('should use Africa/Lagos as the WAT timezone', () => {
    expect(WAT_TIMEZONE).toBe('Africa/Lagos');
  });

  it('should extract correct WAT date string for a UTC timestamp', () => {
    // 2026-09-22 23:30:00 UTC is 2026-09-23 00:30:00 in WAT (UTC+1)
    const utcTimestamp = '2026-09-22T23:30:00.000Z';
    const watDate = getWATDateString(utcTimestamp);
    expect(watDate).toBe('2026-09-23');
  });

  it('should extract correct WAT hour for a UTC timestamp', () => {
    // 2026-09-22 08:15:00 UTC is 09:15:00 in WAT (UTC+1)
    const utcTimestamp = '2026-09-22T08:15:00.000Z';
    const hour = getWATHour(utcTimestamp);
    expect(hour).toBe(9);
  });

  it('should format WAT time properly with timezone suffix', () => {
    const utcTimestamp = '2026-09-22T08:15:30.000Z';
    const formatted = formatWATTime(utcTimestamp, { includeSeconds: true, includeTimezone: true });
    expect(formatted).toBe('09:15:30 WAT');
  });

  it('should format WAT date and time together', () => {
    const utcTimestamp = '2026-09-22T08:15:00.000Z';
    const formatted = formatWATDateTime(utcTimestamp);
    expect(formatted).toContain('2026');
    expect(formatted).toContain('09:15 WAT');
  });

  it('should accurately evaluate time windows', () => {
    expect(isTimeInWindow('08:15', '08:00', '09:00')).toBe(true);
    expect(isTimeInWindow('07:59', '08:00', '09:00')).toBe(false);
    expect(isTimeInWindow('09:01', '08:00', '09:00')).toBe(false);
  });
});
