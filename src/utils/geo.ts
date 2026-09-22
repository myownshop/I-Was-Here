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
 * Handles permissions, timeouts, and hardware errors with clear user feedback.
 */
export async function getCurrentCoordinates(): Promise<GeoLocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your mobile browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 10,
        });
      },
      (error) => {
        let message = 'Unable to retrieve your current location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access was denied. Please enable GPS permissions in your browser settings to verify CDS presence.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'GPS location information is currently unavailable. Ensure device location service is turned on.';
            break;
          case error.TIMEOUT:
            message = 'GPS location request timed out. Please step into an open area outdoors and retry.';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}
