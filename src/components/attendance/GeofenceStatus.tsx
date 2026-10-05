import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin,
  Navigation,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  Compass,
} from 'lucide-react';
import { Campaign, GeoLocationCoordinates } from '../../types/attendance';
import {
  calculateHaversineDistance,
  getCurrentCoordinates,
  watchLiveCoordinates,
  isCoordinatesValid,
  formatDistance,
  getWalkingTimeEstimate,
  calculateBearing,
} from '../../utils/geo';
import { VenueGuidanceMap } from './VenueGuidanceMap';

interface GeofenceStatusProps {
  campaign: Campaign;
  accentColor?: string;
  onLocationUpdate: (coords: GeoLocationCoordinates, distanceMeters: number, isWithinGeofence: boolean) => void;
}

export function GeofenceStatus({
  campaign,
  accentColor = '#00FF66',
  onLocationUpdate,
}: GeofenceStatusProps) {
  const [coords, setCoords] = useState<GeoLocationCoordinates | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);

  const onLocationUpdateRef = useRef(onLocationUpdate);
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  const targetLat = Number(campaign.targetLatitude);
  const targetLng = Number(campaign.targetLongitude);
  const allowedRadius = Number(campaign.allowedRadius) || 100;
  const isVenueConfigured = isCoordinatesValid(targetLat, targetLng);

  // Manual GPS poll / refresh
  const refreshLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userCoords = await getCurrentCoordinates({ enableHighAccuracy: true });
      setCoords(userCoords);

      if (isVenueConfigured) {
        const calculatedDistance = calculateHaversineDistance(
          userCoords.latitude,
          userCoords.longitude,
          targetLat,
          targetLng
        );
        setDistance(calculatedDistance);
        const isWithin = calculatedDistance <= allowedRadius;
        onLocationUpdateRef.current?.(userCoords, calculatedDistance, isWithin);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to acquire high-accuracy GPS fix.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [targetLat, targetLng, allowedRadius, isVenueConfigured]);

  // Continuous Live GPS Stream Collector
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const unsubscribe = watchLiveCoordinates(
      (liveCoords) => {
        if (isCancelled) return;
        setCoords(liveCoords);
        setLoading(false);
        setError(null);
        setIsLiveStreaming(true);

        if (isVenueConfigured) {
          const calculatedDistance = calculateHaversineDistance(
            liveCoords.latitude,
            liveCoords.longitude,
            targetLat,
            targetLng
          );
          setDistance(calculatedDistance);
          const isWithin = calculatedDistance <= allowedRadius;
          onLocationUpdateRef.current?.(liveCoords, calculatedDistance, isWithin);
        }
      },
      (err) => {
        if (isCancelled) return;
        setLoading(false);
        setError(err.message);
      }
    );

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [targetLat, targetLng, allowedRadius, isVenueConfigured]);

  const isWithin = distance !== null && distance <= allowedRadius;

  // Real-time bearing from user to venue
  const bearingInfo =
    coords && isVenueConfigured
      ? calculateBearing(coords.latitude, coords.longitude, targetLat, targetLng)
      : null;

  return (
    <div className="space-y-3">
      <div
        id="geofence-status-card"
        className={`rounded-2xl p-4 border transition-all ${
          !isVenueConfigured
            ? 'bg-amber-500/10 border-amber-500/30'
            : error
            ? 'bg-rose-500/10 border-rose-500/30'
            : isWithin
            ? 'bg-[#00FF66]/5 border-[#00FF66]/30 shadow-[0_0_15px_rgba(0,255,102,0.1)]'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                !isVenueConfigured
                  ? 'bg-amber-500/20 text-amber-400'
                  : error
                  ? 'bg-rose-500/20 text-rose-400'
                  : isWithin
                  ? 'bg-[#00FF66]/20 text-[#00FF66]'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {!isVenueConfigured ? (
                <AlertTriangle className="w-5 h-5" />
              ) : error ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isWithin ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Venue Presence &amp; Positioning
                </h4>
                {isLiveStreaming && !error && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
                    LIVE GPS
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-white mt-0.5">
                {!isVenueConfigured
                  ? 'Intended Sign-in Area Not Set by Coordinator'
                  : loading && !coords
                  ? 'Acquiring satellite fix...'
                  : error
                  ? 'Location Error'
                  : isWithin
                  ? 'Physical Presence Verified'
                  : 'Outside Intended Sign-in Area'}
              </p>
            </div>
          </div>

          <button
            id="btn-refresh-gps"
            type="button"
            onClick={refreshLocation}
            disabled={loading}
            className="p-2 rounded-lg bg-[#141b27] hover:bg-[#1d2737] text-slate-300 border border-[#232e42] transition-colors cursor-pointer flex items-center gap-1"
            title="Force refresh GPS fix"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00FF66]' : ''}`} />
          </button>
        </div>

        {/* Intended Area vs User Location Breakdown */}
        {!isVenueConfigured ? (
          <div className="mt-3 pt-3 border-t border-white/5 text-xs text-amber-300 space-y-1">
            <p>
              The coordinator has not configured valid venue coordinates for &ldquo;{campaign.name}&rdquo;.
              Please contact your coordinator or update the session location in the admin portal.
            </p>
          </div>
        ) : (
          !error && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* User Positioning Info */}
                <div className="p-2 rounded-xl bg-[#0a0d14] border border-[#1b2332] space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                    Your Positioning
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white text-[11px]">
                      {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : 'Detecting...'}
                    </span>
                    {coords?.accuracy && (
                      <span className="text-[10px] font-mono text-[#38bdf8] font-bold">
                        ±{Math.round(coords.accuracy)}m
                      </span>
                    )}
                  </div>
                </div>

                {/* Intended Area Info */}
                <div className="p-2 rounded-xl bg-[#0a0d14] border border-[#1b2332] space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                    Intended Area (Venue)
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white text-[11px] truncate">
                      {targetLat.toFixed(5)}, {targetLng.toFixed(5)}
                    </span>
                    <span className="text-[10px] font-mono text-[#00FF66] font-bold">
                      {allowedRadius}m zone
                    </span>
                  </div>
                </div>
              </div>

              {/* Distance and Progress */}
              {distance !== null && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#00FF66]" />
                      Distance to Intended Sign-in Center:
                    </span>
                    <span className={`font-mono font-bold ${isWithin ? 'text-[#00FF66]' : 'text-amber-400'}`}>
                      {formatDistance(distance)}
                    </span>
                  </div>

                  {/* Progress bar towards allowed radius */}
                  <div className="w-full bg-[#161e2b] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isWithin ? 'bg-[#00FF66]' : 'bg-amber-400'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(8, (allowedRadius / Math.max(distance, 1)) * 100))}%`,
                      }}
                    />
                  </div>

                  {!isWithin && (
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-amber-300 font-medium">
                      <p className="flex items-center gap-1.5">
                        <Navigation className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>
                          Move {formatDistance(distance - allowedRadius)} closer to enter the {allowedRadius}m sign-in zone.
                          {bearingInfo && ` Walk ${bearingInfo.label} (${bearingInfo.cardinal}).`}
                        </span>
                      </p>
                      <span className="shrink-0 font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 ml-2">
                        <Clock className="w-3 h-3" />
                        <span>{getWalkingTimeEstimate(distance)}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}

        {error && (
          <div className="mt-2 text-[11px] text-rose-300 leading-relaxed space-y-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={refreshLocation}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry GPS Acquisition</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Map and Navigation Guidance */}
      {isVenueConfigured && (
        <VenueGuidanceMap
          campaign={campaign}
          userCoords={coords}
          distanceMeters={distance}
          isWithinGeofence={isWithin}
          accentColor={accentColor}
          onRefreshGps={refreshLocation}
          isLoadingGps={loading}
        />
      )}
    </div>
  );
}
