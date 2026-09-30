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
  parseCampaignDate,
  formatCountdownDuration,
  toDateTimeLocalInputString,
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

  it('should parse various date representations (ISO, Firestore Timestamp object, Date)', () => {
    const iso = '2026-09-27T08:00:00.000Z';
    const parsedIso = parseCampaignDate(iso);
    expect(parsedIso).toBeInstanceOf(Date);
    expect(parsedIso?.toISOString()).toBe(iso);

    const tsObj = { seconds: 1790500000, nanoseconds: 0 };
    const parsedTs = parseCampaignDate(tsObj);
    expect(parsedTs?.getTime()).toBe(1790500000000);

    const toDateObj = { toDate: () => new Date('2026-09-27T10:00:00.000Z') };
    const parsedToDate = parseCampaignDate(toDateObj);
    expect(parsedToDate?.toISOString()).toBe('2026-09-27T10:00:00.000Z');

    expect(parseCampaignDate(null)).toBeNull();
  });

  it('should format countdown durations properly', () => {
    // 1 hour, 20 minutes: 80 * 60 * 1000 = 4,800,000 ms -> "01:20:00"
    expect(formatCountdownDuration(4800000)).toBe('01:20:00');
    // 45 seconds -> "00:00:45"
    expect(formatCountdownDuration(45000)).toBe('00:00:45');
    // 0 or negative -> "00:00:00"
    expect(formatCountdownDuration(0)).toBe('00:00:00');
    expect(formatCountdownDuration(-500)).toBe('00:00:00');
  });

  it('should convert date to datetime-local input string', () => {
    const d = new Date(2026, 8, 27, 8, 30); // Sep 27, 2026, 08:30 local
    const str = toDateTimeLocalInputString(d);
    expect(str).toBe('2026-09-27T08:30');
  });
});
