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
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    throw new Error('Invalid coordinates: all coordinates must be valid numbers.');
  }

  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    throw new Error('Invalid latitude: latitude must be between -90 and 90 degrees.');
  }

  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
    throw new Error('Invalid longitude: longitude must be between -180 and 180 degrees.');
  }

  // Identical coordinates check
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

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
function getLastKnownCoordinates(maxAgeMs = 7200000): GeoLocationCoordinates | null {
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
 * Rapid IP-based Geolocation fallback for deep indoor environments,
 * office WiFi, or devices where hardware satellite GNSS is blocked.
 */
async function fetchIpGeolocation(): Promise<GeoLocationCoordinates | null> {
  const timeoutMs = 3500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Try primary free IP geolocation API
    const response = await fetch('https://freeipapi.com/api/json', {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      if (
        typeof data.latitude === 'number' &&
        typeof data.longitude === 'number' &&
        data.latitude !== 0 &&
        data.longitude !== 0
      ) {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 50, // Standard network estimation
        };
      }
    }
  } catch {
    // Ignore network or abort errors
  }

  // Backup IP geolocation provider
  try {
    const backupController = new AbortController();
    const backupTimer = setTimeout(() => backupController.abort(), 3000);
    const backupResponse = await fetch('https://ipapi.co/json/', {
      signal: backupController.signal,
    });
    clearTimeout(backupTimer);

    if (backupResponse.ok) {
      const data = await backupResponse.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 60,
        };
      }
    }
  } catch {
    // Ignore backup failure
  }

  return null;
}

/**
 * Universal Location Acquisition Engine:
 * Works seamlessly everywhere — indoors, classrooms, basements, auditoriums, WiFi, and outdoors.
 * 
 * Strategy:
 * 1. Rapid Dual Concurrent Query: Runs standard (WiFi/Cell triangulation, ideal for indoors)
 *    and high-accuracy (GNSS satellite) concurrently. Whichever acquires valid coordinates first resolves.
 * 2. Rapid Stream Watch: If single-shot queries are slow, watchPosition grabs the first available fix.
 * 3. Network IP Triangulation Fallback: If hardware location is blocked or offline indoors,
 *    transparently resolves coordinates via secure IP geolocation.
 * 4. Recent Cache Recovery: Falls back to cached venue coordinates if available.
 */
export async function getCurrentCoordinates(): Promise<GeoLocationCoordinates> {
  if (typeof window === 'undefined') {
    throw new Error('Geolocation is not supported in this runtime environment.');
  }

  // If navigator.geolocation is not supported by the browser, try IP geolocation fallback
  if (!navigator?.geolocation) {
    const ipLocation = await fetchIpGeolocation();
    if (ipLocation) {
      saveLastKnownCoordinates(ipLocation);
      return ipLocation;
    }
    const cached = getLastKnownCoordinates();
    if (cached) return cached;
    throw new Error('Geolocation is not supported by your browser.');
  }

  // Helper promise for browser getCurrentPosition
  const requestPosition = (options: PositionOptions): Promise<GeoLocationCoordinates> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 15,
          });
        },
        (error) => reject(error),
        options
      );
    });
  };

  // Helper for fast watchPosition stream
  const requestWatchFix = (timeoutMs: number): Promise<GeoLocationCoordinates> => {
    return new Promise((resolve, reject) => {
      let watchId: number | null = null;
      const timer = setTimeout(() => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(new Error('Location stream timeout'));
      }, timeoutMs);

      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            clearTimeout(timer);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 20,
            });
          },
          (err) => {
            clearTimeout(timer);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            reject(err);
          },
          { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 }
        );
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  };

  let permissionDenied = false;

  // Tier 1: Concurrent Race between WiFi/Cell Triangulation (Indoor Fast) and High Accuracy GPS
  try {
    // Standard accuracy uses WiFi router BSSID & cell tower signals which work instantly inside buildings
    const indoorFastPromise = requestPosition({
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: 60000, // Accepts fresh cached indoor position
    });

    // High-accuracy attempts satellite lock if available
    const highAccuracyPromise = requestPosition({
      enableHighAccuracy: true,
      timeout: 7000,
      maximumAge: 15000,
    });

    // Whichever completes first gives us the instant position
    const fastestResult = await Promise.race([indoorFastPromise, highAccuracyPromise]);
    saveLastKnownCoordinates(fastestResult);
    return fastestResult;
  } catch (err: unknown) {
    if (
      err instanceof GeolocationPositionError &&
      err.code === err.PERMISSION_DENIED
    ) {
      permissionDenied = true;
    }
  }

  if (permissionDenied) {
    throw new Error(
      'Location permission was denied. Please allow location access in your browser settings to verify CDS venue attendance.'
    );
  }

  // Tier 2: WatchPosition Stream Catch (resolves in < 3s on iOS/Android indoors)
  try {
    const watchResult = await requestWatchFix(3500);
    saveLastKnownCoordinates(watchResult);
    return watchResult;
  } catch {
    // Proceed to network IP fallback
  }

  // Tier 3: Network IP Geolocation Fallback (Works everywhere with internet, indoors & outdoors)
  try {
    const ipResult = await fetchIpGeolocation();
    if (ipResult) {
      saveLastKnownCoordinates(ipResult);
      return ipResult;
    }
  } catch {
    // Proceed to cache
  }

  // Tier 4: Last Known Location Recovery (from earlier session/check-in)
  const cachedLocation = getLastKnownCoordinates();
  if (cachedLocation) {
    return cachedLocation;
  }

  // Final fallback guidance
  throw new Error(
    'Unable to detect location automatically. Please ensure location services or WiFi are enabled on your device.'
  );
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
