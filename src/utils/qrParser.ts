/**
 * Utility to extract session codes or campaign IDs from diverse QR code formats:
 * - Direct codes (e.g., 'MED24', 'A12B34')
 * - Full app URLs (e.g., 'https://app.iwashere.internal/#/c/med24')
 * - Deep paths (e.g., '/c/med24', '/attend/camp_xyz123')
 * - Query strings (e.g., '?c=med24', '?campaign=camp_xyz123')
 * - JSON encoded payloads
 */

export interface ParsedQRResult {
  code: string;
  type: 'shortCode' | 'campaignId';
  raw: string;
}

export function extractCodeFromQR(rawInput: string): ParsedQRResult {
  const trimmed = rawInput.trim();

  // 1. JSON payload support
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      if (data.shortCode) {
        return { code: String(data.shortCode).trim(), type: 'shortCode', raw: trimmed };
      }
      if (data.campaignId) {
        return { code: String(data.campaignId).trim(), type: 'campaignId', raw: trimmed };
      }
      if (data.id) {
        return { code: String(data.id).trim(), type: 'campaignId', raw: trimmed };
      }
      if (data.code) {
        return { code: String(data.code).trim(), type: 'shortCode', raw: trimmed };
      }
    } catch {
      // ignore parse failure, fall through
    }
  }

  // 2. Query parameter: ?c=code or ?code=code or ?campaign=id
  const cParamMatch = trimmed.match(/[?&](?:c|code)=([a-zA-Z0-9_\-]+)/i);
  if (cParamMatch) {
    return { code: cParamMatch[1].trim(), type: 'shortCode', raw: trimmed };
  }

  const campParamMatch = trimmed.match(/[?&](?:campaign|camp|attend)=([a-zA-Z0-9_\-]+)/i);
  if (campParamMatch) {
    return { code: campParamMatch[1].trim(), type: 'campaignId', raw: trimmed };
  }

  // 3. Path / Hash alias: /#/c/code or /c/code
  const cPathMatch = trimmed.match(/(?:#\/|\/)c\/([a-zA-Z0-9_\-]+)/i);
  if (cPathMatch) {
    return { code: cPathMatch[1].trim(), type: 'shortCode', raw: trimmed };
  }

  // 4. Path / Hash attend: /#/attend/id or /attend/id
  const attendPathMatch = trimmed.match(/(?:#\/|\/)attend\/([a-zA-Z0-9_\-]+)/i);
  if (attendPathMatch) {
    return { code: attendPathMatch[1].trim(), type: 'campaignId', raw: trimmed };
  }

  // 5. Clean string / direct code
  const clean = trimmed
    .replace(/^https?:\/\/[^/]+/i, '') // strip protocol + host
    .replace(/^#\/?/, '')             // strip leading hash
    .replace(/^\//, '')               // strip leading slash
    .trim();

  // If long alphanumeric string (> 16 chars), likely a direct Firestore campaign ID
  if (clean.length > 16 && !clean.includes(' ')) {
    return { code: clean, type: 'campaignId', raw: trimmed };
  }

  return { code: clean, type: 'shortCode', raw: trimmed };
}
