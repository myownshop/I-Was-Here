import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import {
  MapPin,
  Navigation,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Compass,
  Radio,
} from 'lucide-react';

/**
 * Component Props Interface
 */
export interface LocationVerifierProps {
  adminTarget: { lat: number; lng: number }; // The CDS venue coordinates
  allowedRadius: number; // Allowed distance in meters
  onVerificationComplete: (isValid: boolean, userLocation: { lat: number; lng: number }) => void;
}

export interface UserLocationState {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * 1. Robust Geolocation Fetcher
 * Queries navigator.geolocation with strict options and explicit error code mapping.
 */
export function fetchExactLocation(): Promise<UserLocationState> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      reject(new Error('Geolocation is not supported by your browser or device.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 10,
        });
      },
      (error) => {
        let message = 'An unknown error occurred while retrieving your location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access was denied. Please allow GPS permissions in your browser settings to verify attendance.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'GPS signal is currently unavailable. Ensure device location service is turned on.';
            break;
          case error.TIMEOUT:
            message = 'GPS location request timed out. Please tap Retry to acquire your coordinates.';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * 2. Haversine Distance Calculation
 * Calculates the great-circle distance between two GPS coordinates in meters.
 */
export function calculateDistance(
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
    return 0;
  }

  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const EARTH_RADIUS_METERS = 6371000; // Radius of Earth in meters
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

/**
 * Custom Dark / Cyber-Military map styling for Google Maps
 */
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0d121c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d121c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#748ba7' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#a5b4fc' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#111927' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4ade80' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#060910' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
];

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
  borderRadius: '1rem',
};

/**
 * LocationVerifier Component
 */
export const LocationVerifier: React.FC<LocationVerifierProps> = ({
  adminTarget,
  allowedRadius,
  onVerificationComplete,
}) => {
  const [userLocation, setUserLocation] = useState<UserLocationState | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // Read Google Maps API Key from Vite environment with default fallback
  const apiKey =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    'AIzaSyAznahz6-4b5xG490CKSTDu9nXpllJukvY';

  // Google Maps JS API loader hook
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'iwh-google-map-script',
    googleMapsApiKey: apiKey,
  });

  // Keep latest callback reference to prevent stale closure loops
  const onVerificationCompleteRef = useRef(onVerificationComplete);
  useEffect(() => {
    onVerificationCompleteRef.current = onVerificationComplete;
  }, [onVerificationComplete]);

  /**
   * Acquire exact user location and evaluate geofence
   */
  const handleAcquireLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const location = await fetchExactLocation();
      setUserLocation(location);

      const calculatedMeters = calculateDistance(
        location.lat,
        location.lng,
        adminTarget.lat,
        adminTarget.lng
      );

      setDistance(calculatedMeters);
      const isWithinGeofence = calculatedMeters <= allowedRadius;

      // Invoke verification completion callback
      onVerificationCompleteRef.current?.(isWithinGeofence, {
        lat: location.lat,
        lng: location.lng,
      });

      // Fit map viewport to encompass both Admin Target and User Location
      if (mapInstance) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(new window.google.maps.LatLng(adminTarget.lat, adminTarget.lng));
        bounds.extend(new window.google.maps.LatLng(location.lat, location.lng));
        mapInstance.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unable to acquire accurate GPS coordinates.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [adminTarget.lat, adminTarget.lng, allowedRadius, mapInstance]);

  // Initial location fetch on mount
  useEffect(() => {
    handleAcquireLocation();
  }, [handleAcquireLocation]);

  const isWithin = distance !== null && distance <= allowedRadius;

  // Center coordinates for map view
  const centerCoords = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: adminTarget.lat, lng: adminTarget.lng };

  return (
    <div
      id="location-verifier-container"
      className="w-full bg-[#0a0f18] border border-[#1b2536] rounded-2xl p-4 sm:p-5 shadow-2xl text-slate-100 space-y-4"
    >
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-[#1b2536] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center text-[#39FF14]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Geofence Location Verifier</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                GPS v2.4
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Admin Target Geofence: {allowedRadius}m radius
            </p>
          </div>
        </div>

        {/* Refresh GPS Button */}
        <button
          type="button"
          id="btn-recheck-location"
          onClick={handleAcquireLocation}
          disabled={loading}
          className="p-2.5 rounded-xl bg-[#141d2b] hover:bg-[#1c283c] text-slate-300 hover:text-[#39FF14] border border-[#223045] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-semibold"
          title="Refresh GPS Coordinates"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#39FF14]' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Map Viewport Area */}
      <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-[#223045] bg-[#0d121c]">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 bg-[#0a0f18]/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-[#39FF14]/30 border-t-[#39FF14] animate-spin" />
              <Navigation className="w-5 h-5 text-[#39FF14] absolute inset-0 m-auto" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">Acquiring GPS Signal...</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">High-Accuracy Satellite / WiFi Triangulation</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && !loading && (
          <div className="absolute inset-0 z-20 bg-[#0a0f18]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="max-w-sm space-y-1">
              <h4 className="text-sm font-bold text-white">GPS Signal Error</h4>
              <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleAcquireLocation}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-lg shadow-rose-900/30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry GPS Acquisition</span>
            </button>
          </div>
        )}

        {/* Google Maps Render */}
        {isLoaded && !loadError && apiKey ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={centerCoords}
            zoom={17}
            onLoad={(map) => setMapInstance(map)}
            options={{
              styles: DARK_MAP_STYLES,
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              gestureHandling: 'greedy',
            }}
          >
            {/* The Geofence Circle centered at adminTarget */}
            <Circle
              center={adminTarget}
              radius={allowedRadius}
              options={{
                strokeColor: '#39FF14',
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillColor: '#39FF14',
                fillOpacity: 0.18,
              }}
            />

            {/* Admin Target Marker (Venue Center) */}
            <Marker
              position={adminTarget}
              title="Admin CDS Venue Center"
              label={{
                text: '🎯 Venue',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'bold',
                className: 'mt-7 bg-[#0a0f18]/80 px-2 py-0.5 rounded border border-white/20',
              }}
            />

            {/* The User Location Marker */}
            {userLocation && (
              <Marker
                position={{ lat: userLocation.lat, lng: userLocation.lng }}
                title="Your Current Location"
                label={{
                  text: '📍 You',
                  color: '#39FF14',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  className: 'mt-7 bg-[#0a0f18]/90 px-2 py-0.5 rounded border border-[#39FF14]/50 shadow-[0_0_10px_rgba(57,255,20,0.4)]',
                }}
              />
            )}
          </GoogleMap>
        ) : (
          /* Fallback Map/Radar Visualization if API key is not configured or loading */
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#0a0e17] text-slate-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

            {/* Radar Geofence Ring */}
            <div className="relative flex items-center justify-center my-2">
              <div className="w-40 h-40 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/5 flex items-center justify-center animate-pulse">
                <div className="w-28 h-28 rounded-full border border-[#39FF14]/40 bg-[#39FF14]/10 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-[#39FF14] shadow-[0_0_15px_#39FF14]" />
                </div>
              </div>
            </div>

            <div className="text-center z-10 space-y-1">
              <p className="text-xs font-mono text-[#39FF14]">
                Target: {adminTarget.lat.toFixed(5)}, {adminTarget.lng.toFixed(5)}
              </p>
              {userLocation && (
                <p className="text-xs font-mono text-sky-400">
                  User: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} (±{Math.round(userLocation.accuracy)}m)
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Distance Calculation Display & Geofence Status */}
      {!loading && !error && distance !== null && (
        <div
          id="distance-status-card"
          className={`p-4 rounded-xl border transition-all ${
            isWithin
              ? 'bg-[#39FF14]/5 border-[#39FF14]/30 shadow-[0_0_20px_rgba(57,255,20,0.1)]'
              : 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isWithin
                    ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {isWithin ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  Distance to Geofence Center
                </span>
                <div className="flex items-baseline space-x-2">
                  <span
                    id="calculated-distance-value"
                    className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                      isWithin ? 'text-[#39FF14]' : 'text-rose-400'
                    }`}
                  >
                    {distance} meters
                  </span>
                  <span className="text-xs text-slate-400">
                    / {allowedRadius}m allowed limit
                  </span>
                </div>
              </div>
            </div>

            {/* Status Verification Badge */}
            <div className="flex items-center">
              {isWithin ? (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#39FF14]/15 border border-[#39FF14]/40 text-[#39FF14] text-xs font-bold shadow-[0_0_12px_rgba(57,255,20,0.2)]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Within Geofence</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-bold shadow-[0_0_12px_rgba(244,63,94,0.2)]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Outside Allowed Radius</span>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Warning or Success Subtext & Navigation Actions */}
          <div className="mt-3 pt-2.5 border-t border-white/5 space-y-2 text-xs">
            {isWithin ? (
              <p className="text-[#39FF14] font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Geofence verification passed. You are physically present at the CDS venue.</span>
              </p>
            ) : (
              <div className="space-y-2.5">
                <p className="text-rose-400 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    You are {Math.round(distance - allowedRadius)}m beyond the permitted geofence. Please move closer to the venue center to complete attendance.
                  </span>
                </p>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${adminTarget.lat},${adminTarget.lng}&travelmode=walking`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#39FF14] hover:bg-[#32e012] text-black font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-black" />
                    <span>Navigate in Google Maps</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleAcquireLocation}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-[#182333] hover:bg-[#223147] text-slate-200 hover:text-white font-bold text-xs border border-[#2c3d56] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#39FF14]' : ''}`} />
                    <span>Re-check Distance</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationVerifier;
