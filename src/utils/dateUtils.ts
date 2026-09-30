/**
 * West Africa Time (WAT) Date & Time Utilities
 * Time Zone: Africa/Lagos (UTC+1, Standard Time across Nigeria and West Africa)
 */

export const WAT_TIMEZONE = 'Africa/Lagos';
export const WAT_LABEL = 'WAT (UTC+1)';

/**
 * Returns the current date in YYYY-MM-DD format according to West Africa Time (WAT).
 */
export function getTodayWATDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: WAT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns YYYY-MM-DD for any date/timestamp in West Africa Time.
 */
export function getWATDateString(timestamp: string | number | Date): string {
  if (!timestamp) return getTodayWATDateString();
  const d = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WAT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Formats a timestamp to a localized time string in West Africa Time (WAT).
 * Example: "09:45 AM" or "09:45:12 AM"
 */
export function formatWATTime(
  timestamp: string | number | Date,
  options?: {
    includeSeconds?: boolean;
    includeTimezone?: boolean;
    hour12?: boolean;
  }
): string {
  if (!timestamp) return 'N/A';
  const d = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return 'N/A';

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: WAT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: options?.includeSeconds ? '2-digit' : undefined,
    hour12: options?.hour12 ?? false,
  }).format(d);

  return options?.includeTimezone ? `${timeStr} WAT` : timeStr;
}

/**
 * Formats a timestamp to a localized date string in West Africa Time (WAT).
 * Example: "22 Sep 2026" or "Tuesday, 22 Sep 2026"
 */
export function formatWATDate(
  timestamp: string | number | Date,
  options?: {
    weekday?: 'long' | 'short';
    month?: 'numeric' | '2-digit' | 'long' | 'short';
    year?: 'numeric' | '2-digit';
    day?: 'numeric' | '2-digit';
  }
): string {
  if (!timestamp) return 'N/A';
  const d = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: WAT_TIMEZONE,
    day: options?.day ?? '2-digit',
    month: options?.month ?? 'short',
    year: options?.year ?? 'numeric',
    weekday: options?.weekday,
  }).format(d);
}

/**
 * Formats a timestamp to both Date & Time in West Africa Time (WAT).
 * Example: "22 Sep 2026, 09:45 WAT"
 */
export function formatWATDateTime(
  timestamp: string | number | Date,
  options?: {
    includeSeconds?: boolean;
    includeTimezone?: boolean;
  }
): string {
  if (!timestamp) return 'N/A';
  const d = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return 'N/A';

  const datePart = formatWATDate(d, { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = formatWATTime(d, {
    includeSeconds: options?.includeSeconds,
    includeTimezone: false,
  });

  const tzSuffix = options?.includeTimezone !== false ? ' WAT' : '';
  return `${datePart}, ${timePart}${tzSuffix}`;
}

/**
 * Gets the hour (0-23) of a timestamp in West Africa Time.
 */
export function getWATHour(timestamp: string | number | Date): number {
  const d = typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return 0;
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: WAT_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).format(d);
  return parseInt(hourStr, 10);
}

/**
 * Returns current time in WAT as HH:mm.
 */
export function getCurrentWATTimeHHMM(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: WAT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/**
 * Checks if a current HH:mm time is within a startTime and endTime window.
 */
export function isTimeInWindow(
  currentHHMM: string,
  startHHMM: string,
  endHHMM: string
): boolean {
  if (!startHHMM || !endHHMM) return true;
  return currentHHMM >= startHHMM && currentHHMM <= endHHMM;
}

/**
 * Safely parses a Firestore Timestamp, object with seconds/nanoseconds, Date, number, or ISO string into a JavaScript Date.
 */
export function parseCampaignDate(
  val?: string | number | Date | { seconds?: number; nanoseconds?: number; toDate?: () => Date } | null
): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof (val as any).toDate === 'function') {
    return (val as any).toDate();
  }
  if (typeof (val as any).seconds === 'number') {
    return new Date((val as any).seconds * 1000);
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Converts a Date or ISO string into standard YYYY-MM-DDTHH:mm format for datetime-local inputs.
 */
export function toDateTimeLocalInputString(dateOrVal?: Date | string | null): string {
  if (!dateOrVal) return '';
  if (typeof dateOrVal === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateOrVal)) {
    return dateOrVal;
  }
  const d = dateOrVal instanceof Date ? dateOrVal : parseCampaignDate(dateOrVal);
  if (!d || isNaN(d.getTime())) return '';

  const pad = (n: number) => n.toString().padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
}

/**
 * Formats a duration in milliseconds into a formatted countdown string.
 * Example: "01:20:00" or "2d 04:15:30"
 */
export function formatCountdownDuration(diffMs: number): string {
  if (diffMs <= 0) return '00:00:00';

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

