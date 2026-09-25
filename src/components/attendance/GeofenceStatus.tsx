import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Navigation, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Campaign, GeoLocationCoordinates } from '../../types/attendance';
import { calculateHaversineDistance, getCurrentCoordinates, formatDistance, getWalkingTimeEstimate } from '../../utils/geo';
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

  const onLocationUpdateRef = useRef(onLocationUpdate);
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  const checkLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const userCoords = await getCurrentCoordinates();
      setCoords(userCoords);

      const calculatedDistance = calculateHaversineDistance(
        userCoords.latitude,
        userCoords.longitude,
        campaign.targetLatitude,
        campaign.targetLongitude
      );

      setDistance(calculatedDistance);
      const isWithin = calculatedDistance <= campaign.allowedRadius;
      onLocationUpdateRef.current?.(userCoords, calculatedDistance, isWithin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to acquire high-accuracy GPS fix.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [campaign.targetLatitude, campaign.targetLongitude, campaign.allowedRadius]);

  useEffect(() => {
    checkLocation();
  }, [checkLocation]);

  const isWithin = distance !== null && distance <= campaign.allowedRadius;

  return (
    <div className="space-y-3">
      <div
        id="geofence-status-card"
        className={`rounded-2xl p-4 border transition-all ${
          error
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
                error
                  ? 'bg-rose-500/20 text-rose-400'
                  : isWithin
                  ? 'bg-[#00FF66]/20 text-[#00FF66]'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {error ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isWithin ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                CDS Venue Geofence Check
              </h4>
              <p className="text-sm font-semibold text-white">
                {loading
                  ? 'Acquiring GPS fix...'
                  : error
                  ? 'Location Error'
                  : isWithin
                  ? 'Physical Presence Verified'
                  : 'Outside Allowed Radius'}
              </p>
            </div>
          </div>

          <button
            id="btn-refresh-gps"
            type="button"
            onClick={checkLocation}
            disabled={loading}
            className="p-2 rounded-lg bg-[#141b27] hover:bg-[#1d2737] text-slate-300 border border-[#232e42] transition-colors cursor-pointer"
            title="Refresh GPS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00FF66]' : ''}`} />
          </button>
        </div>

        {/* Distance and Range Visualizer */}
        {!loading && !error && distance !== null && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#00FF66]" />
                Distance to Center:
              </span>
              <span className={`font-mono font-bold ${isWithin ? 'text-[#00FF66]' : 'text-amber-400'}`}>
                {formatDistance(distance)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
              <span>Allowed Limit: {campaign.allowedRadius}m</span>
              {coords?.accuracy && (
                <span>GPS Accuracy: ±{Math.round(coords.accuracy)}m</span>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#161e2b] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isWithin ? 'bg-[#00FF66]' : 'bg-amber-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(10, (campaign.allowedRadius / Math.max(distance, 1)) * 100))}%`,
                }}
              />
            </div>

            {!isWithin && (
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-amber-300 font-medium">
                <p>
                  ⚠️ You are {formatDistance(distance)} from venue. Follow map to step inside the {campaign.allowedRadius}m zone.
                </p>
                <span className="shrink-0 font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{getWalkingTimeEstimate(distance)}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-2 text-[11px] text-rose-300 leading-relaxed space-y-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={checkLocation}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry GPS Acquisition</span>
            </button>
          </div>
        )}
      </div>

      {/* Interactive Map and Navigation Guidance */}
      <VenueGuidanceMap
        campaign={campaign}
        userCoords={coords}
        distanceMeters={distance}
        isWithinGeofence={isWithin}
        accentColor={accentColor}
        onRefreshGps={checkLocation}
        isLoadingGps={loading}
      />
    </div>
  );
}
