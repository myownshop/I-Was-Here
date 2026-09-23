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
 * Asynchronously requests the user's high-accuracy GPS coordinates.
 * Employs a multi-tiered progressive fallback strategy:
 * 1. Fast High-Accuracy Satellite GPS Fix (timeout: 5s, maxAge: 10s)
 * 2. Standard Accuracy Network/Cell/WiFi Fallback (timeout: 8s, maxAge: 30s)
 * 3. Brief WatchPosition recovery stream (timeout: 4s)
 * Handles permissions, hardware delays, and outdoor mobile constraints.
 */
export async function getCurrentCoordinates(): Promise<GeoLocationCoordinates> {
  if (typeof window === 'undefined' || !navigator?.geolocation) {
    throw new Error('Geolocation is not supported by your mobile browser.');
  }

  // Helper promise for getCurrentPosition
  const requestPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  // Helper for watchPosition recovery
  const requestWatchFix = (timeoutMs: number): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      let watchId: number | null = null;
      const timer = setTimeout(() => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(new Error('GPS satellite watch timed out.'));
      }, timeoutMs);

      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            clearTimeout(timer);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timer);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            reject(err);
          },
          { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10000 }
        );
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  };

  // Tier 1: Try High Accuracy GPS with 5-second timeout
  try {
    const pos = await requestPosition({
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 5000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy || 10,
    };
  } catch (firstErr: unknown) {
    const isPermissionDenied =
      firstErr instanceof GeolocationPositionError &&
      firstErr.code === firstErr.PERMISSION_DENIED;

    if (isPermissionDenied) {
      throw new Error(
        'Location access was denied. Please enable GPS permissions in your browser settings to verify CDS presence.'
      );
    }

    console.info('High-accuracy GPS request delayed/unavailable, trying standard accuracy fallback...');
  }

  // Tier 2: Try Standard Accuracy (Cell/WiFi/Network) with 7-second timeout
  try {
    const pos = await requestPosition({
      enableHighAccuracy: false,
      timeout: 7000,
      maximumAge: 30000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy || 25,
    };
  } catch (secondErr: unknown) {
    const isPermissionDenied =
      secondErr instanceof GeolocationPositionError &&
      secondErr.code === secondErr.PERMISSION_DENIED;

    if (isPermissionDenied) {
      throw new Error(
        'Location access was denied. Please enable GPS permissions in your browser settings to verify CDS presence.'
      );
    }

    console.info('Standard accuracy position unavailable, attempting watchPosition stream recovery...');
  }

  // Tier 3: WatchPosition stream recovery
  try {
    const pos = await requestWatchFix(4000);
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy || 15,
    };
  } catch (finalErr: unknown) {
    let message = 'Unable to acquire accurate GPS position. Please ensure device location is switched on and retry.';
    if (finalErr instanceof GeolocationPositionError) {
      switch (finalErr.code) {
        case finalErr.PERMISSION_DENIED:
          message = 'Location access was denied. Please enable GPS permissions in your browser settings to verify CDS presence.';
          break;
        case finalErr.POSITION_UNAVAILABLE:
          message = 'GPS location is currently unavailable. Ensure device location service is turned on.';
          break;
        case finalErr.TIMEOUT:
          message = 'GPS location request timed out. Please step outdoors or into an open area and tap Retry GPS.';
          break;
      }
    }
    throw new Error(message);
  }
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
