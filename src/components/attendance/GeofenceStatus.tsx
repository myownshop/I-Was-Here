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
  ShieldAlert,
  ExternalLink,
  Lock,
  Smartphone,
  Check,
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
  GpsError,
  GpsErrorCode,
  checkGeolocationPermission,
  GeolocationPermissionState,
  getGoogleMapsNavigationUrl,
  getAppleMapsUrl,
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
  const [errorCode, setErrorCode] = useState<GpsErrorCode | null>(null);
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>('prompt');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);

  // Auto-retry up to 3 times before reloading page
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [isAutoRetrying, setIsAutoRetrying] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [reloadCountdown, setReloadCountdown] = useState<number>(3);

  const attemptCountRef = useRef<number>(1);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reloadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLocationRef = useRef<boolean>(false);

  const onLocationUpdateRef = useRef(onLocationUpdate);
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  const watchCleanupRef = useRef<(() => void) | null>(null);

  // Target Venue Coordinates (Fallback to Lagos CDS HQ if coordinator hasn't set one yet)
  const rawLat = Number(campaign.targetLatitude);
  const rawLng = Number(campaign.targetLongitude);
  const targetLat = isCoordinatesValid(rawLat, rawLng) ? rawLat : 6.5244;
  const targetLng = isCoordinatesValid(rawLat, rawLng) ? rawLng : 3.3792;
  const allowedRadius = Number(campaign.allowedRadius) || 100;
  const isVenueConfigured = isCoordinatesValid(rawLat, rawLng);

  // Clear timers helper
  const clearAllTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (reloadIntervalRef.current) {
      clearInterval(reloadIntervalRef.current);
      reloadIntervalRef.current = null;
    }
  }, []);

  // Check initial permission state
  useEffect(() => {
    checkGeolocationPermission().then((state) => {
      setPermissionState(state);
    });
  }, []);

  // Forward declaration of turnOnLocationAndStartGps
  const turnOnLocationAndStartGps = useCallback(
    async (targetAttempt?: number) => {
      const currentAttempt = targetAttempt ?? attemptCountRef.current;
      setLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        // 1. Actively request permission and acquire real-time GPS
        const userCoords = await getCurrentCoordinates({ enableHighAccuracy: true, timeout: 9000 });
        hasLocationRef.current = true;
        setCoords(userCoords);
        setPermissionState('granted');
        setIsLiveStreaming(true);
        setIsAutoRetrying(false);
        setIsReloading(false);
        attemptCountRef.current = 1;
        setAttemptCount(1);
        clearAllTimers();

        const calculatedDistance = calculateHaversineDistance(
          userCoords.latitude,
          userCoords.longitude,
          targetLat,
          targetLng
        );
        setDistance(calculatedDistance);
        const isWithin = calculatedDistance <= allowedRadius;
        onLocationUpdateRef.current?.(userCoords, calculatedDistance, isWithin);

        // 2. Make sure to turn on continuous live stream immediately after asking
        if (watchCleanupRef.current) {
          watchCleanupRef.current();
        }

        watchCleanupRef.current = watchLiveCoordinates(
          (liveCoords) => {
            hasLocationRef.current = true;
            setCoords(liveCoords);
            setLoading(false);
            setError(null);
            setErrorCode(null);
            setIsLiveStreaming(true);
            setIsAutoRetrying(false);
            setIsReloading(false);
            attemptCountRef.current = 1;
            setAttemptCount(1);
            clearAllTimers();

            const liveDistance = calculateHaversineDistance(
              liveCoords.latitude,
              liveCoords.longitude,
              targetLat,
              targetLng
            );
            setDistance(liveDistance);
            const liveWithin = liveDistance <= allowedRadius;
            onLocationUpdateRef.current?.(liveCoords, liveDistance, liveWithin);
          },
          (err, code) => {
            setError(err.message);
            if (code) {
              setErrorCode(code);
              if (code === 'PERMISSION_DENIED') setPermissionState('denied');
            }
            if (!hasLocationRef.current) {
              handleFailure(err.message, code);
            }
          }
        );
      } catch (err: unknown) {
        let msg = 'Unable to acquire location.';
        let code: GpsErrorCode = 'UNKNOWN';
        if (err instanceof GpsError) {
          msg = err.message;
          code = err.code;
          if (err.code === 'PERMISSION_DENIED') {
            setPermissionState('denied');
          }
        } else if (err instanceof Error) {
          msg = err.message;
        }
        setError(msg);
        setErrorCode(code);
        handleFailure(msg, code);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetLat, targetLng, allowedRadius, clearAllTimers]
  );

  // Failure handling logic: tries up to 3 times, then reloads the page
  const handleFailure = useCallback(
    (errMsg: string, code?: GpsErrorCode) => {
      if (hasLocationRef.current) return;

      if (code === 'PERMISSION_DENIED') {
        setIsAutoRetrying(false);
        setIsReloading(false);
        clearAllTimers();
        return;
      }

      const cur = attemptCountRef.current;
      if (cur < 3) {
        const next = cur + 1;
        attemptCountRef.current = next;
        setAttemptCount(next);
        setIsAutoRetrying(true);
        setIsReloading(false);

        clearAllTimers();
        retryTimerRef.current = setTimeout(() => {
          turnOnLocationAndStartGps(next);
        }, 2000);
      } else {
        // Reached 3 failed attempts: initiate automatic page refresh countdown
        setIsAutoRetrying(false);
        setIsReloading(true);
        setReloadCountdown(3);

        clearAllTimers();
        let timeLeft = 3;
        reloadIntervalRef.current = setInterval(() => {
          timeLeft -= 1;
          setReloadCountdown(timeLeft);
          if (timeLeft <= 0) {
            if (reloadIntervalRef.current) clearInterval(reloadIntervalRef.current);
            window.location.reload();
          }
        }, 1000);
      }
    },
    [clearAllTimers, turnOnLocationAndStartGps]
  );

  // Manual reset & try again
  const handleManualRetry = useCallback(() => {
    clearAllTimers();
    setIsReloading(false);
    setIsAutoRetrying(false);
    attemptCountRef.current = 1;
    setAttemptCount(1);
    turnOnLocationAndStartGps(1);
  }, [clearAllTimers, turnOnLocationAndStartGps]);

  // Initial background start of GPS collector
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    const unsubscribe = watchLiveCoordinates(
      (liveCoords) => {
        if (isCancelled) return;
        hasLocationRef.current = true;
        setCoords(liveCoords);
        setLoading(false);
        setError(null);
        setErrorCode(null);
        setPermissionState('granted');
        setIsLiveStreaming(true);
        setIsAutoRetrying(false);
        setIsReloading(false);
        attemptCountRef.current = 1;
        setAttemptCount(1);
        clearAllTimers();

        const calculatedDistance = calculateHaversineDistance(
          liveCoords.latitude,
          liveCoords.longitude,
          targetLat,
          targetLng
        );
        setDistance(calculatedDistance);
        const isWithin = calculatedDistance <= allowedRadius;
        onLocationUpdateRef.current?.(liveCoords, calculatedDistance, isWithin);
      },
      (err, code) => {
        if (isCancelled) return;
        setLoading(false);
        setError(err.message);
        if (code) {
          setErrorCode(code);
          if (code === 'PERMISSION_DENIED') setPermissionState('denied');
        }
        if (!hasLocationRef.current) {
          handleFailure(err.message, code);
        }
      }
    );

    watchCleanupRef.current = unsubscribe;

    return () => {
      isCancelled = true;
      unsubscribe();
      clearAllTimers();
    };
  }, [targetLat, targetLng, allowedRadius, clearAllTimers, handleFailure]);

  const isWithin = distance !== null && distance <= allowedRadius;

  // Real-time bearing from user to intended sign-in area
  const bearingInfo =
    coords
      ? calculateBearing(coords.latitude, coords.longitude, targetLat, targetLng)
      : null;

  const handleCopyUserCoordinates = () => {
    if (!coords) return;
    navigator.clipboard.writeText(`${coords.latitude}, ${coords.longitude}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const navigationUrl = isIos
    ? getAppleMapsUrl(targetLat, targetLng, campaign.name)
    : getGoogleMapsNavigationUrl(targetLat, targetLng, campaign.name);

  return (
    <div className="space-y-3">
      {/* Location Status Card */}
      <div
        id="geofence-status-card"
        className={`rounded-2xl p-4 sm:p-5 border transition-all ${
          !isVenueConfigured
            ? 'bg-amber-500/10 border-amber-500/30'
            : error || errorCode
            ? 'bg-rose-500/10 border-rose-500/30'
            : isWithin
            ? 'bg-[#00FF66]/5 border-[#00FF66]/30 shadow-[0_0_20px_rgba(0,255,102,0.12)]'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                !isVenueConfigured
                  ? 'bg-amber-500/20 text-amber-400'
                  : error || errorCode
                  ? 'bg-rose-500/20 text-rose-400'
                  : isWithin
                  ? 'bg-[#00FF66]/20 text-[#00FF66]'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {!isVenueConfigured ? (
                <AlertTriangle className="w-5 h-5" />
              ) : error || errorCode ? (
                <ShieldAlert className="w-5 h-5" />
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
                {isLiveStreaming && !error && coords && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
                    LIVE GPS ACTIVE
                  </span>
                )}
              </div>

              <p className="text-sm font-bold text-white mt-0.5">
                {!isVenueConfigured
                  ? 'Intended Sign-in Area Not Fully Configured'
                  : loading && !coords
                  ? 'Acquiring satellite fix...'
                  : error || errorCode
                  ? 'Location Positioning Inactive'
                  : isWithin
                  ? 'Physical Presence Verified — Inside Sign-in Area'
                  : 'Outside Intended Sign-in Area'}
              </p>
            </div>
          </div>

          <button
            id="btn-refresh-gps"
            type="button"
            onClick={handleManualRetry}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#141b27] hover:bg-[#1d2737] text-slate-300 border border-[#232e42] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Refresh GPS Positioning"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#00FF66]' : ''}`} />
            <span className="text-xs font-bold hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* AUTOMATIC 3-ATTEMPT FAILURE & PAGE RELOAD COUNTDOWN BANNER */}
        {isReloading && (
          <div
            id="gps-reload-countdown-banner"
            className="mt-3 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/60 text-amber-200 text-xs space-y-2.5 animate-in fade-in duration-200 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>GPS Failed After 3 Attempts</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-mono font-bold text-[11px]">
                Refreshing in {reloadCountdown}s
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              We couldn't lock your location after 3 attempts. The page will automatically reload in <strong className="text-white font-mono">{reloadCountdown} seconds</strong> to reset your device's location sensor and try again.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors cursor-pointer text-center shadow"
              >
                Reload Page Now
              </button>
              <button
                type="button"
                onClick={handleManualRetry}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-600 transition-colors cursor-pointer text-center"
              >
                Try 3 More Times
              </button>
            </div>
          </div>
        )}

        {/* AUTO RETRYING IN PROGRESS INDICATOR */}
        {isAutoRetrying && !isReloading && (
          <div
            id="gps-auto-retry-badge"
            className="mt-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 text-xs flex items-center justify-between space-x-2 animate-pulse"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400 animate-spin" />
              <div>
                <span className="font-bold text-white block">
                  Capturing GPS... (Attempt {attemptCount} of 3)
                </span>
                <span className="text-[11px] text-slate-400">
                  Waiting for satellite fix. Retrying automatically if needed.
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold">
              {attemptCount}/3
            </span>
          </div>
        )}

        {/* PROACTIVE PERMISSION REQUEST & TURN ON LOCATION BANNER (if GPS positioning didn't work) */}
        {(!coords || error || errorCode) && (
          <div
            id="location-permission-prompt"
            className="mt-4 p-4 rounded-xl bg-[#0c1017] border border-amber-500/30 text-left space-y-3"
          >
            <div className="flex items-start space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                {errorCode === 'PERMISSION_DENIED' ? (
                  <Lock className="w-4 h-4 text-rose-400" />
                ) : errorCode === 'POSITION_UNAVAILABLE' ? (
                  <Smartphone className="w-4 h-4 text-amber-400" />
                ) : (
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                  {errorCode === 'PERMISSION_DENIED'
                    ? 'Location Permission Needed to Sign In'
                    : errorCode === 'POSITION_UNAVAILABLE'
                    ? 'Device Location is Turned Off'
                    : 'Turn On Location to Position Device'}
                </h5>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {errorCode === 'PERMISSION_DENIED'
                    ? 'Your browser previously denied location access. Please allow location in your browser site settings, then tap Turn On Location.'
                    : errorCode === 'POSITION_UNAVAILABLE'
                    ? 'GPS hardware is disabled on your device. Please swipe down to your phone quick controls, turn on "Location", then tap Turn On Location.'
                    : 'Attendance check-in requires verifying your physical position at the venue. Please grant location access.'}
                </p>
              </div>
            </div>

            {/* Step-by-step unblock instructions if denied */}
            {errorCode === 'PERMISSION_DENIED' && (
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-300 space-y-1">
                <p className="font-semibold text-amber-300 flex items-center gap-1">
                  <span>How to enable in 2 seconds:</span>
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                  <li>Tap the <strong>lock 🔒 or tune icon</strong> in your browser address bar.</li>
                  <li>Tap <strong>Permissions</strong> or <strong>Site Settings</strong>.</li>
                  <li>Set <strong>Location</strong> to <strong>Allow</strong>.</li>
                </ol>
              </div>
            )}

            {/* Direct Action Button: Turn On Location & Activate GPS */}
            <div className="pt-1">
              <button
                id="btn-turn-on-location"
                type="button"
                onClick={handleManualRetry}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-[#0a0c10] shadow-[0_0_20px_rgba(0,255,102,0.3)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>Connecting to GPS Sensors...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4 text-black animate-pulse" />
                    <span>
                      {errorCode === 'PERMISSION_DENIED'
                        ? "I've Allowed Location — Turn On GPS"
                        : errorCode === 'POSITION_UNAVAILABLE'
                        ? 'Location Turned On — Connect GPS'
                        : 'Turn On Location & Enable GPS'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Break down: Location Positioning of the User AND Intended Area */}
        <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* 1. Location Positioning of User */}
            <div
              id="user-positioning-box"
              className="p-3 rounded-xl bg-[#0a0d14] border border-[#1b2332] space-y-1.5 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${coords ? 'bg-[#00FF66] animate-pulse' : 'bg-amber-400'}`} />
                  Your Device Positioning
                </span>
                {coords && (
                  <button
                    type="button"
                    onClick={handleCopyUserCoordinates}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                    title="Copy your coordinates"
                  >
                    {copiedCoords ? <Check className="w-3 h-3 text-[#00FF66]" /> : <span className="underline">Copy</span>}
                  </button>
                )}
              </div>

              <div className="flex items-baseline justify-between gap-1">
                <span className="font-mono text-white text-xs font-semibold">
                  {coords
                    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                    : loading
                    ? 'Acquiring GPS fix...'
                    : 'GPS not connected'}
                </span>
                {coords?.accuracy && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      coords.accuracy <= 25
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : coords.accuracy <= 50
                        ? 'bg-sky-500/15 text-sky-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    ±{Math.round(coords.accuracy)}m accuracy
                  </span>
                )}
              </div>
            </div>

            {/* 2. Intended Area of Signing In */}
            <div
              id="intended-area-box"
              className="p-3 rounded-xl bg-[#0a0d14] border border-[#1b2332] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#00FF66]" />
                  Intended Sign-In Area
                </span>
                <span className="text-[10px] font-mono text-[#00FF66] font-bold bg-[#00FF66]/10 px-1.5 py-0.5 rounded border border-[#00FF66]/20">
                  {allowedRadius}m zone
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-1">
                <span className="font-mono text-white text-xs font-semibold truncate" title={campaign.name}>
                  {targetLat.toFixed(5)}, {targetLng.toFixed(5)}
                </span>
                <a
                  href={navigationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 shrink-0 underline"
                  title="Open in Maps"
                >
                  <span>Map</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Distance and Live Positioning Relative to Allowed Area */}
          {coords && distance !== null && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#00FF66]" />
                  <span>Distance to Sign-In Center:</span>
                </span>
                <span className={`font-mono text-sm font-extrabold ${isWithin ? 'text-[#00FF66]' : 'text-amber-400'}`}>
                  {formatDistance(distance)}
                </span>
              </div>

              {/* Visual proximity progress meter */}
              <div className="w-full bg-[#161e2b] h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isWithin ? 'bg-[#00FF66]' : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(8, (allowedRadius / Math.max(distance, 1)) * 100))}%`,
                  }}
                />
              </div>

              {/* Guidance for outside attendees */}
              {!isWithin ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-300 font-medium bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  <p className="flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Move <strong>{formatDistance(distance - allowedRadius)}</strong> closer to enter the {allowedRadius}m zone.
                      {bearingInfo && ` Walk ${bearingInfo.label} (${bearingInfo.cardinal}).`}
                    </span>
                  </p>
                  <span className="shrink-0 font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 self-start sm:self-center">
                    <Clock className="w-3 h-3" />
                    <span>{getWalkingTimeEstimate(distance)}</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-[#00FF66] font-medium bg-[#00FF66]/10 p-2.5 rounded-xl border border-[#00FF66]/20">
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#00FF66] shrink-0" />
                    <span>You are inside the {allowedRadius}m intended sign-in zone. Location verified!</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Leaflet Map for spatial positioning and visual guidance */}
      <VenueGuidanceMap
        campaign={campaign}
        userCoords={coords}
        distanceMeters={distance}
        isWithinGeofence={isWithin}
        accentColor={accentColor}
        onRefreshGps={turnOnLocationAndStartGps}
        isLoadingGps={loading}
      />
    </div>
  );
}
