import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Campaign, GeoLocationCoordinates } from '../../types/attendance';
import { calculateHaversineDistance, getCurrentCoordinates, formatDistance } from '../../utils/geo';

interface GeofenceStatusProps {
  campaign: Campaign;
  onLocationUpdate: (coords: GeoLocationCoordinates, distanceMeters: number, isWithinGeofence: boolean) => void;
}

export function GeofenceStatus({ campaign, onLocationUpdate }: GeofenceStatusProps) {
  const [coords, setCoords] = useState<GeoLocationCoordinates | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      onLocationUpdate(userCoords, calculatedDistance, isWithin);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to acquire high-accuracy GPS fix.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [campaign.targetLatitude, campaign.targetLongitude, campaign.allowedRadius, onLocationUpdate]);

  const handleSimulateVenue = () => {
    const simulatedCoords: GeoLocationCoordinates = {
      latitude: campaign.targetLatitude + 0.0001,
      longitude: campaign.targetLongitude + 0.0001,
      accuracy: 5,
    };
    setCoords(simulatedCoords);
    setDistance(15);
    setError(null);
    onLocationUpdate(simulatedCoords, 15, true);
  };

  useEffect(() => {
    checkLocation();
  }, [checkLocation]);

  const isWithin = distance !== null && distance <= campaign.allowedRadius;

  return (
    <div
      id="geofence-status-card"
      className={`rounded-2xl p-4 border transition-all mb-4 ${
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
          className="p-2 rounded-lg bg-[#141b27] hover:bg-[#1d2737] text-slate-300 border border-[#232e42] transition-colors"
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
            <div className="mt-2 flex flex-col items-start gap-1">
              <p className="text-[11px] text-amber-300 font-medium leading-tight">
                ⚠️ You are {formatDistance(distance)} away. Please move closer to the venue (within {campaign.allowedRadius}m) to complete attendance.
              </p>
              <button
                type="button"
                id="btn-simulate-venue"
                onClick={handleSimulateVenue}
                className="mt-1 text-[11px] text-[#00FF66] hover:underline font-semibold flex items-center gap-1 bg-[#00FF66]/10 px-2 py-1 rounded border border-[#00FF66]/20 transition-all"
              >
                <span>📍 Simulate Venue Location (1-Click Test)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-[11px] text-rose-300 leading-relaxed">
          <p>{error}</p>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-rose-500/20">
            <span className="text-[10px] text-slate-400">Testing without GPS?</span>
            <button
              type="button"
              id="btn-simulate-venue-error"
              onClick={handleSimulateVenue}
              className="text-[11px] text-[#00FF66] hover:underline font-semibold bg-[#00FF66]/10 px-2 py-1 rounded border border-[#00FF66]/20"
            >
              📍 Simulate Venue GPS (1-Click Test)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
