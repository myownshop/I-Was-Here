import { GeoLocationCoordinates } from '../types/attendance';

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the standard Haversine formula.
 *
 * @param lat1 Latitude of point 1 in decimal degrees
 * @param lon1 Longitude of point 1 in decimal degrees
 * @param lat2 Latitude of point 2 in decimal degrees
 * @param lon2 Longitude of point 2 in decimal degrees
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const nLat1 = typeof lat1 === 'number' ? lat1 : Number(lat1);
  const nLon1 = typeof lon1 === 'number' ? lon1 : Number(lon1);
  const nLat2 = typeof lat2 === 'number' ? lat2 : Number(lat2);
  const nLon2 = typeof lon2 === 'number' ? lon2 : Number(lon2);

  if (
    isNaN(nLat1) ||
    isNaN(nLon1) ||
    isNaN(nLat2) ||
    isNaN(nLon2)
  ) {
    throw new Error('Invalid coordinates: all coordinates must be valid numbers.');
  }

  if (nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90) {
    throw new Error('Invalid latitude: latitude must be between -90 and 90 degrees.');
  }

  if (nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180) {
    throw new Error('Invalid longitude: longitude must be between -180 and 180 degrees.');
  }

  // Identical coordinates check
  if (nLat1 === nLat2 && nLon1 === nLon2) {
    return 0;
  }

  const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const phi1 = toRadians(nLat1);
  const phi2 = toRadians(nLat2);
  const deltaPhi = toRadians(nLat2 - nLat1);
  const deltaLambda = toRadians(nLon2 - nLon1);

  const sinDeltaPhiHalf = Math.sin(deltaPhi / 2);
  const sinDeltaLambdaHalf = Math.sin(deltaLambda / 2);

  const a =
    sinDeltaPhiHalf * sinDeltaPhiHalf +
    Math.cos(phi1) * Math.cos(phi2) * sinDeltaLambdaHalf * sinDeltaLambdaHalf;

  // Clamping to avoid numerical precision issues near antipodes
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

/**
 * Asynchronous wrapper for distance calculation with input validation.
 */
export async function calculateDistanceAsync(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number> {
  return Promise.resolve(calculateHaversineDistance(lat1, lon1, lat2, lon2));
}

/**
 * Formats a distance in meters into an intuitive human-readable string.
 */
export function formatDistance(meters: number): string {
  if (isNaN(meters) || meters < 0) return '0 m';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Returns estimated walking time in minutes based on average walking pace (1.3 m/s or 4.7 km/h)
 */
export function getWalkingTimeEstimate(meters: number): string {
  if (isNaN(meters) || meters <= 0) return '< 1 min';
  const seconds = meters / 1.3;
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return '~1 min walk';
  if (minutes < 60) return `~${minutes} mins walk`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `~${hours}h ${remainingMins}m walk`;
}

/**
 * Key for storing last known valid location in localStorage
 */
const LAST_KNOWN_GEO_KEY = 'cds_last_known_geo_v1';

interface StoredGeoData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

/**
 * Saves valid coordinates to local storage for quick recovery in deep indoor environments.
 */
function saveLastKnownCoordinates(coords: GeoLocationCoordinates): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data: StoredGeoData = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 15,
        timestamp: Date.now(),
      };
      localStorage.setItem(LAST_KNOWN_GEO_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Retrieves the last known coordinates if within recent validity window (e.g. 2 hours).
 */
export function getLastKnownCoordinates(maxAgeMs = 7200000): GeoLocationCoordinates | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(LAST_KNOWN_GEO_KEY);
      if (stored) {
        const parsed: StoredGeoData = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          return {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: Math.max(parsed.accuracy, 20),
          };
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Member Device Location Acquisition Engine:
 * Strictly acquires genuine real-time GPS / WiFi / Cell sensor coordinates directly
 * from the member's device using standard navigator.geolocation.
 *
 * Implements high-accuracy GNSS hardware satellite query, multi-attempt accuracy refinement,
 * and clear user instructions.
 */
export interface GetCoordinatesOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  allowCachedFallback?: boolean;
}

/**
 * Validates whether latitude and longitude are valid finite numbers within Earth bounds.
 */
export function isCoordinatesValid(lat: unknown, lng: unknown): boolean {
  const nLat = typeof lat === 'number' ? lat : Number(lat);
  const nLng = typeof lng === 'number' ? lng : Number(lng);
  return (
    !isNaN(nLat) &&
    !isNaN(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180 &&
    // Not unconfigured 0,0 Null Island
    !(nLat === 0 && nLng === 0)
  );
}

export type GpsErrorCode = 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';

export class GpsError extends Error {
  code: GpsErrorCode;
  constructor(message: string, code: GpsErrorCode = 'UNKNOWN') {
    super(message);
    this.name = 'GpsError';
    this.code = code;
  }
}

export type GeolocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

/**
 * Checks current browser geolocation permission status via Permissions API.
 */
export async function checkGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (typeof window === 'undefined' || !navigator?.permissions?.query) {
    return 'unsupported';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state as GeolocationPermissionState;
  } catch {
    return 'unsupported';
  }
}

/**
 * Robust Member Device Location Acquisition Engine:
 * Strictly acquires real-time GPS / WiFi / Cell sensor coordinates directly
 * from the member's device using standard navigator.geolocation.
 *
 * Implements high-accuracy GNSS hardware satellite query, multi-attempt accuracy refinement,
 * graceful fallback, and live continuous streaming.
 */
export async function getCurrentCoordinates(
  options: GetCoordinatesOptions = {}
): Promise<GeoLocationCoordinates> {
  if (typeof window === 'undefined' || !navigator?.geolocation) {
    throw new GpsError('Geolocation is not supported by your browser or device.', 'UNKNOWN');
  }

  const {
    enableHighAccuracy = true,
    timeout = 9000,
    maximumAge = 3000,
    allowCachedFallback = true,
  } = options;

  // Helper promise for browser getCurrentPosition
  const requestPosition = (opts: PositionOptions): Promise<GeoLocationCoordinates> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
            accuracy: Math.round(position.coords.accuracy || 10),
          });
        },
        (error) => reject(error),
        opts
      );
    });
  };

  let lastErrCode: GpsErrorCode = 'UNKNOWN';

  // Attempt 1: High-accuracy GNSS hardware sensor query
  if (enableHighAccuracy) {
    try {
      const highAccResult = await requestPosition({
        enableHighAccuracy: true,
        timeout: Math.min(timeout, 9000),
        maximumAge,
      });
      saveLastKnownCoordinates(highAccResult);
      return highAccResult;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const pErr = err as GeolocationPositionError;
        if (pErr.code === 1) {
          throw new GpsError(
            'Location permission was denied. Please allow location access in your browser settings so your actual attendance location can be verified.',
            'PERMISSION_DENIED'
          );
        }
        if (pErr.code === 2) lastErrCode = 'POSITION_UNAVAILABLE';
        if (pErr.code === 3) lastErrCode = 'TIMEOUT';
      }
      // Weak satellite or timeout indoors -> fall through to standard WiFi / Cell triangulation
    }
  }

  // Attempt 2: Standard Accuracy (WiFi / Cell Triangulation - fast & dependable indoors)
  try {
    const standardResult = await requestPosition({
      enableHighAccuracy: false,
      timeout: 7000,
      maximumAge: 15000,
    });
    saveLastKnownCoordinates(standardResult);
    return standardResult;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const pErr = err as GeolocationPositionError;
      if (pErr.code === 1) {
        throw new GpsError(
          'Location permission was denied. Please allow location access in your browser settings so your actual attendance location can be verified.',
          'PERMISSION_DENIED'
        );
      }
      if (pErr.code === 2) lastErrCode = 'POSITION_UNAVAILABLE';
      if (pErr.code === 3) lastErrCode = 'TIMEOUT';
    }
  }

  // Attempt 3: Cached fallback if recently acquired (within last 5 minutes)
  if (allowCachedFallback) {
    const recentCached = getLastKnownCoordinates(300000);
    if (recentCached) {
      return recentCached;
    }
  }

  if (lastErrCode === 'POSITION_UNAVAILABLE') {
    throw new GpsError(
      'Device GPS/Location services are currently turned off on your phone. Please toggle Location ON in your phone settings or quick controls.',
      'POSITION_UNAVAILABLE'
    );
  }

  if (lastErrCode === 'TIMEOUT') {
    throw new GpsError(
      'Satellite signal timeout. Move closer to a window or outdoors, and tap to retry GPS acquisition.',
      'TIMEOUT'
    );
  }

  throw new GpsError(
    'Unable to acquire device GPS coordinates. Please ensure Location is enabled in your phone/device settings and tap Refresh.',
    lastErrCode
  );
}

/**
 * Continuous Live GPS Stream Collector:
 * Continuously watches the member's GPS position as they move towards the signing-in area,
 * reporting refined coordinates with real-time accuracy updates.
 * Returns a cleanup unsubscribe function.
 */
export function watchLiveCoordinates(
  onUpdate: (coords: GeoLocationCoordinates) => void,
  onError?: (error: Error, code?: GpsErrorCode) => void
): () => void {
  if (typeof window === 'undefined' || !navigator?.geolocation) {
    onError?.(new GpsError('Geolocation is not supported by your browser or device.', 'UNKNOWN'), 'UNKNOWN');
    return () => {};
  }

  let watchId: number | null = null;
  let hasReceivedFix = false;

  // Immediately notify with recent cached fix if available (zero-latency instant start)
  const cached = getLastKnownCoordinates(120000);
  if (cached) {
    onUpdate(cached);
  }

  const successCallback: PositionCallback = (pos) => {
    hasReceivedFix = true;
    const fix: GeoLocationCoordinates = {
      latitude: Number(pos.coords.latitude.toFixed(6)),
      longitude: Number(pos.coords.longitude.toFixed(6)),
      accuracy: Math.round(pos.coords.accuracy || 10),
    };
    saveLastKnownCoordinates(fix);
    onUpdate(fix);
  };

  const errorCallback: PositionErrorCallback = (err) => {
    let code: GpsErrorCode = 'UNKNOWN';
    if (err.code === 1) code = 'PERMISSION_DENIED';
    else if (err.code === 2) code = 'POSITION_UNAVAILABLE';
    else if (err.code === 3) code = 'TIMEOUT';

    if (code === 'PERMISSION_DENIED') {
      onError?.(
        new GpsError(
          'Location permission was denied. Please allow location access in your browser settings.',
          'PERMISSION_DENIED'
        ),
        'PERMISSION_DENIED'
      );
    } else if (!hasReceivedFix && code === 'POSITION_UNAVAILABLE') {
      onError?.(
        new GpsError(
          'GPS signal unavailable. Please ensure location services are enabled on your device.',
          'POSITION_UNAVAILABLE'
        ),
        'POSITION_UNAVAILABLE'
      );
    } else if (!hasReceivedFix && code === 'TIMEOUT') {
      onError?.(
        new GpsError(
          'GPS satellite connection timed out. Retrying satellite lock...',
          'TIMEOUT'
        ),
        'TIMEOUT'
      );
    }
    // Sensor continues polling in background for position updates
  };

  try {
    watchId = navigator.geolocation.watchPosition(successCallback, errorCallback, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000,
    });
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)), 'UNKNOWN');
  }

  return () => {
    if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
}

/**
 * Computes initial compass bearing from point 1 (user) to point 2 (venue destination).
 * Returns bearing in degrees (0-360) and 8-point cardinal abbreviation.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { degrees: number; cardinal: string; label: string } {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const toDegrees = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  let bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  bearing = Math.round(bearing);

  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const index = Math.round(bearing / 45);
  const cardinal = cardinals[index % 8];

  const cardinalNames: Record<string, string> = {
    N: 'North',
    NE: 'North-East',
    E: 'East',
    SE: 'South-East',
    S: 'South',
    SW: 'South-West',
    W: 'West',
    NW: 'North-West',
  };

  return {
    degrees: bearing,
    cardinal,
    label: cardinalNames[cardinal] || cardinal,
  };
}

/**
 * Returns a universal navigation URL for Google Maps routing.
 */
export function getGoogleMapsNavigationUrl(
  destLat: number,
  destLng: number,
  venueName?: string
): string {
  const query = venueName
    ? encodeURIComponent(`${destLat},${destLng} (${venueName})`)
    : `${destLat},${destLng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=walking`;
}

/**
 * Returns Apple Maps navigation URL for iOS devices.
 */
export function getAppleMapsUrl(
  destLat: number,
  destLng: number,
  venueName?: string
): string {
  const q = venueName ? encodeURIComponent(venueName) : 'CDS Venue';
  return `https://maps.apple.com/?daddr=${destLat},${destLng}&q=${q}&dirflg=w`;
}

export interface ParsedVenueLocation {
  success: boolean;
  latitude?: number;
  longitude?: number;
  venueName?: string;
  sourceType?: 'google_maps_url' | 'coordinates' | 'dms' | 'data_param' | 'short_url';
  error?: string;
  originalInput: string;
}

/**
 * Converts a Degree-Minute-Second (DMS) coordinate component to decimal degrees.
 */
function dmsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number {
  let dd = Number(degrees) + Number(minutes) / 60 + Number(seconds || 0) / 3600;
  const dir = direction.toUpperCase();
  if (dir === 'S' || dir === 'W') {
    dd = dd * -1;
  }
  return dd;
}

/**
 * Parses Degrees Minutes Seconds coordinate string.
 * Example: 6°37'08.4"N 3°21'28.8"E or 6 37 8.4 N, 3 21 28.8 E
 */
function parseDMSString(text: string): { latitude: number; longitude: number } | null {
  // Regex for latitude DMS
  const latRegex = /(\d{1,2})[°\s]+(\d{1,2})['\s]+([\d.]+)?["\s]*([NSns])/;
  // Regex for longitude DMS
  const lngRegex = /(\d{1,3})[°\s]+(\d{1,2})['\s]+([\d.]+)?["\s]*([EWew])/;

  const latMatch = text.match(latRegex);
  const lngMatch = text.match(lngRegex);

  if (latMatch && lngMatch) {
    const lat = dmsToDecimal(
      parseFloat(latMatch[1]),
      parseFloat(latMatch[2]),
      parseFloat(latMatch[3] || '0'),
      latMatch[4]
    );
    const lng = dmsToDecimal(
      parseFloat(lngMatch[1]),
      parseFloat(lngMatch[2]),
      parseFloat(lngMatch[3] || '0'),
      lngMatch[4]
    );

    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
    }
  }

  return null;
}

/**
 * Intelligently extracts coordinates (latitude, longitude) and venue place name
 * from any Google Maps link, share link, embedded link, coordinates string, or DMS string.
 *
 * Supported formats:
 * - https://www.google.com/maps/place/NYSC+Secretariat/@6.6190,3.3580,17z/...
 * - https://www.google.com/maps/@6.6190,3.3580,17z
 * - https://maps.google.com/?q=6.6190,3.3580
 * - https://www.google.com/maps/search/?api=1&query=6.6190,3.3580
 * - https://www.google.com/maps/dir/?api=1&destination=6.6190,3.3580
 * - https://maps.google.com/maps?ll=6.6190,3.3580
 * - Links with !3d6.6190!4d3.3580 data parameters
 * - DMS Strings: 6°37'08.4"N 3°21'28.8"E
 * - Raw coordinate pairs: 6.619024, 3.358012
 */
export function parseGoogleMapsUrlOrCoordinates(input: string): ParsedVenueLocation {
  const originalInput = (input || '').trim();

  if (!originalInput) {
    return {
      success: false,
      error: 'Please paste a Google Maps link or coordinates.',
      originalInput,
    };
  }

  // Attempt URL-decoding in case pasted from browser address bar
  let decoded = originalInput;
  try {
    decoded = decodeURIComponent(originalInput);
  } catch {
    decoded = originalInput;
  }

  // 1. Check if raw coordinates: e.g. "6.619024, 3.358012" or "6.619024 3.358012"
  const rawCoordRegex = /^[\[\(]?\s*(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)\s*[\)\]]?$/;
  const rawMatch = decoded.match(rawCoordRegex);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        success: true,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        sourceType: 'coordinates',
        originalInput,
      };
    }
  }

  // 2. Check DMS (Degrees Minutes Seconds): e.g. 6°37'08.4"N 3°21'28.8"E
  const dmsResult = parseDMSString(decoded);
  if (dmsResult) {
    return {
      success: true,
      latitude: dmsResult.latitude,
      longitude: dmsResult.longitude,
      sourceType: 'dms',
      originalInput,
    };
  }

  // 3. Extract Place Name if present in /place/Venue+Name/
  let extractedVenueName: string | undefined = undefined;
  const placeNameMatch = decoded.match(/\/place\/([^/@?]+)/i);
  if (placeNameMatch && placeNameMatch[1]) {
    const rawPlace = placeNameMatch[1].replace(/\+/g, ' ').replace(/_/g, ' ').trim();
    // Ensure the place name isn't just coordinates or DMS
    if (!/^-?\d+(?:\.\d+)?,-?\d+/.test(rawPlace) && !rawPlace.includes('°')) {
      extractedVenueName = rawPlace;
    }
  }

  // 4. Check for Google Maps Protobuf Data parameters: !3d<lat>!4d<lng>
  // Frequently present in Google Maps place URLs: /data=!4m5!3m4!1s...!8m2!3d6.619024!4d3.358012
  const dataParamRegex = /!3d(-?\d{1,2}(?:\.\d+)?)[^!]*!4d(-?\d{1,3}(?:\.\d+)?)/;
  const dataMatch = decoded.match(dataParamRegex);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        success: true,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        venueName: extractedVenueName,
        sourceType: 'data_param',
        originalInput,
      };
    }
  }

  // 5. Check for @<lat>,<lng> pattern: e.g. /@6.619024,3.358012,17z
  const atMatch = decoded.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        success: true,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        venueName: extractedVenueName,
        sourceType: 'google_maps_url',
        originalInput,
      };
    }
  }

  // 6. Check for query parameters: ?q=lat,lng or ?ll=lat,lng or ?destination=lat,lng or ?center=lat,lng
  const queryParamRegex = /[?&](?:q|query|ll|destination|daddr|saddr|center)=(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i;
  const queryMatch = decoded.match(queryParamRegex);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        success: true,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        venueName: extractedVenueName,
        sourceType: 'google_maps_url',
        originalInput,
      };
    }
  }

  // 7. Check path-based coordinates: e.g. /search/6.6190,3.3580 or /dir//6.6190,3.3580
  const pathCoordRegex = /\/(?:search|place|dir)\/[^/]*?(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/i;
  const pathMatch = decoded.match(pathCoordRegex);
  if (pathMatch) {
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        success: true,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        venueName: extractedVenueName,
        sourceType: 'google_maps_url',
        originalInput,
      };
    }
  }

  // 8. If user pasted a short link like maps.app.goo.gl without visible coordinates in the string
  if (originalInput.includes('goo.gl') || originalInput.includes('maps.app') || originalInput.includes('g.page')) {
    return {
      success: false,
      error:
        'Resolving Google Maps short link...',
      sourceType: 'short_url',
      originalInput,
    };
  }

  return {
    success: false,
    error: 'Could not extract valid GPS coordinates from the provided link or text.',
    originalInput,
  };
}

/**
 * Asynchronously resolves any Google Maps link, including shortened links (maps.app.goo.gl, goo.gl/maps),
 * places, and coordinate strings by connecting to the backend unshortening endpoint.
 */
export async function parseGoogleMapsUrlOrCoordinatesAsync(input: string): Promise<ParsedVenueLocation> {
  const originalInput = (input || '').trim();
  if (!originalInput) {
    return {
      success: false,
      error: 'Please paste a Google Maps link or coordinates.',
      originalInput,
    };
  }

  // 1. Try local instantaneous regex parsing first
  const immediate = parseGoogleMapsUrlOrCoordinates(originalInput);
  if (immediate.success) {
    return immediate;
  }

  // 2. If it's a URL or short link, call our server-side resolver
  try {
    const response = await fetch('/api/resolve-maps-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: originalInput }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.latitude !== undefined && data.longitude !== undefined) {
        return {
          success: true,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          venueName: data.venueName,
          sourceType: data.sourceType || 'short_url',
          originalInput,
        };
      } else if (data.error) {
        return {
          success: false,
          error: data.error,
          sourceType: 'short_url',
          originalInput,
        };
      }
    }
  } catch (err) {
    console.warn('Backend link resolver unavailable:', err);
  }

  return immediate;
}

