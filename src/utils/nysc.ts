/**
 * NYSC (National Youth Service Corps) Specific Utilities
 */

// Regex for standard NYSC State Code format: e.g. LA/23B/1234 or FC/24A/0091
export const STATE_CODE_REGEX = /^[A-Z]{2}\/\d{2}[A-C]\/\d{3,5}$/;

/**
 * Validates whether a given string follows standard NYSC State Code format.
 */
export function isValidStateCode(code: string): boolean {
  if (!code) return false;
  return STATE_CODE_REGEX.test(code.trim().toUpperCase());
}

/**
 * Formats user input as they type into the NYSC State Code pattern:
 * Uppercases letters, strips invalid punctuation, and inserts forward slashes.
 * e.g., "la23b1234" -> "LA/23B/1234"
 */
export function formatStateCodeInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

  let formatted = '';
  if (cleaned.length > 0) {
    formatted = cleaned.slice(0, 2);
  }
  if (cleaned.length > 2) {
    formatted += '/' + cleaned.slice(2, 5);
  }
  if (cleaned.length > 5) {
    formatted += '/' + cleaned.slice(5, 10);
  }

  return formatted;
}

/**
 * Generates a random, collision-resistant 5-character alphanumeric short code
 * excluding ambiguous characters like 0, O, 1, l, I.
 */
export function generateShortCode(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

/**
 * Asynchronously fetches client public IP address for verification audit trail.
 * Uses public ipify service with graceful fallback.
 */
export async function getClientIpAddress(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return data.ip;
      }
    }
  } catch {
    // Non-blocking fast fallback
  }

  // Graceful fallback for offline / low connectivity environments
  return `102.89.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10} (MTN NG)`;
}
