import React, { useState } from 'react';
import {
  MapPin,
  Link as LinkIcon,
  Check,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ClipboardPaste,
  Loader2,
  Navigation,
} from 'lucide-react';
import {
  parseGoogleMapsUrlOrCoordinatesAsync,
  getCurrentCoordinates,
  ParsedVenueLocation,
} from '../../utils/geo';
import { showToast } from './Toast';

interface GoogleMapsLinkInputProps {
  onCoordinatesParsed: (coords: {
    latitude: number;
    longitude: number;
    venueName?: string;
  }) => void;
  accentColor?: string;
  placeholder?: string;
  className?: string;
  currentLat?: number | string;
  currentLng?: number | string;
  showUseCurrentLocationBtn?: boolean;
}

export function GoogleMapsLinkInput({
  onCoordinatesParsed,
  accentColor = '#00FF66',
  placeholder = 'Paste Google Maps link (e.g., https://maps.app.goo.gl/... or https://maps.google.com/...)',
  className = '',
  currentLat,
  currentLng,
  showUseCurrentLocationBtn = false,
}: GoogleMapsLinkInputProps) {
  const [inputUrl, setInputUrl] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParsedVenueLocation | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [hasCopiedFeedback, setHasCopiedFeedback] = useState<boolean>(false);
  const [capturingGps, setCapturingGps] = useState<boolean>(false);

  const handleApply = async (urlToParse = inputUrl) => {
    const trimmed = urlToParse.trim();
    if (!trimmed) {
      setParseResult(null);
      return;
    }

    setIsResolving(true);
    try {
      const result = await parseGoogleMapsUrlOrCoordinatesAsync(trimmed);
      setParseResult(result);

      if (result.success && result.latitude !== undefined && result.longitude !== undefined) {
        onCoordinatesParsed({
          latitude: result.latitude,
          longitude: result.longitude,
          venueName: result.venueName,
        });
        setHasCopiedFeedback(true);
        setTimeout(() => setHasCopiedFeedback(false), 2500);

        showToast(
          'success',
          `Coordinates locked: ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}${
            result.venueName ? ` (${result.venueName})` : ''
          }`,
          'Location Extracted'
        );
      } else if (result.error) {
        showToast('error', result.error, 'Location Parse Error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve location link.';
      setParseResult({
        success: false,
        error: msg,
        originalInput: trimmed,
      });
      showToast('error', msg, 'Link Resolution Error');
    } finally {
      setIsResolving(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputUrl(text);
          handleApply(text);
        }
      }
    } catch {
      showToast('info', 'Please paste the link into the box manually.', 'Clipboard Notice');
    }
  };

  const handleUseDeviceGps = async () => {
    setCapturingGps(true);
    try {
      const coords = await getCurrentCoordinates();
      const lat = coords.latitude;
      const lng = coords.longitude;
      setInputUrl(`${lat}, ${lng}`);
      onCoordinatesParsed({
        latitude: lat,
        longitude: lng,
      });
      setParseResult({
        success: true,
        latitude: lat,
        longitude: lng,
        sourceType: 'coordinates',
        originalInput: `${lat}, ${lng}`,
      });
      showToast('success', `Live GPS coordinates locked: ${lat}, ${lng} (±${Math.round(coords.accuracy)}m)`, 'Device Location Locked');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not acquire GPS.';
      showToast('error', msg, 'GPS Acquisition Failed');
    } finally {
      setCapturingGps(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  // Preview URL for Google Maps
  const testMapUrl =
    parseResult?.success && parseResult.latitude !== undefined && parseResult.longitude !== undefined
      ? `https://www.google.com/maps/search/?api=1&query=${parseResult.latitude},${parseResult.longitude}`
      : currentLat && currentLng && !isNaN(Number(currentLat)) && !isNaN(Number(currentLng))
      ? `https://www.google.com/maps/search/?api=1&query=${currentLat},${currentLng}`
      : null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
          <span>Google Maps Location Finder &amp; Short Link Parser</span>
        </label>
        <div className="flex items-center space-x-2">
          {showUseCurrentLocationBtn && (
            <button
              type="button"
              onClick={handleUseDeviceGps}
              disabled={capturingGps}
              className="text-[11px] text-[#00FF66] hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-50"
            >
              <Navigation className={`w-3 h-3 ${capturingGps ? 'animate-spin' : ''}`} />
              <span>{capturingGps ? 'Locking GPS...' : 'Use My GPS'}</span>
            </button>
          )}
          {testMapUrl && (
            <a
              href={testMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline font-medium"
              title="Open coordinates in Google Maps"
            >
              <span>Preview Pin</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Input container with Paste & Extract buttons */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-slate-400 pointer-events-none">
          <MapPin className="w-4 h-4 text-sky-400" />
        </div>

        <input
          type="text"
          value={inputUrl}
          onChange={(e) => {
            const val = e.target.value;
            setInputUrl(val);
            if (parseResult) setParseResult(null);
            // Auto-trigger if a full URL or coordinates were pasted directly
            if (val.includes('maps.app.goo.gl') || val.includes('goo.gl/maps') || val.includes('google.com/maps')) {
              handleApply(val);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isResolving}
          className="w-full pl-9 pr-28 py-2.5 bg-[#141b26] border border-[#223043] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 transition-colors disabled:opacity-60"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {typeof navigator !== 'undefined' && navigator.clipboard && (
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              disabled={isResolving}
              className="px-2 py-1 bg-[#1e293b] hover:bg-[#28384f] text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-[#334155] disabled:opacity-40"
              title="Paste link from clipboard"
            >
              <ClipboardPaste className="w-3 h-3 text-sky-400" />
              <span>Paste</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleApply()}
            disabled={!inputUrl.trim() || isResolving}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              hasCopiedFeedback
                ? 'bg-[#00FF66] text-black font-extrabold shadow-[0_0_10px_rgba(0,255,102,0.3)]'
                : 'bg-sky-500 hover:bg-sky-400 text-black font-extrabold'
            }`}
          >
            {isResolving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Resolving...</span>
              </>
            ) : hasCopiedFeedback ? (
              <>
                <Check className="w-3 h-3" />
                <span>Locked!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                <span>Extract</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Parse Feedback / Extraction Result */}
      {parseResult && (
        <div
          className={`p-3 rounded-xl text-xs border transition-all ${
            parseResult.success
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}
        >
          {parseResult.success ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-bold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#00FF66]" />
                  <span>Venue GPS Coordinates Acquired</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-emerald-300">
                  {parseResult.sourceType?.replace(/_/g, ' ') || 'Resolved'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-emerald-100 flex items-center gap-2">
                <span>Latitude: <strong>{parseResult.latitude}</strong></span>
                <span>•</span>
                <span>Longitude: <strong>{parseResult.longitude}</strong></span>
              </div>
              {parseResult.venueName && (
                <div className="text-[11px] text-slate-300 pt-0.5">
                  Venue Name: <strong className="text-white">{parseResult.venueName}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span>{parseResult.error}</span>
                <p className="mt-1 text-slate-300">
                  💡 <em>Supported links:</em> Short share links (<code>maps.app.goo.gl/...</code>, <code>goo.gl/maps/...</code>), full browser links (<code>maps.google.com/.../@lat,lng</code>), or raw coordinates (<code>6.5954, 3.3421</code>).
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-normal flex items-center justify-between">
        <span>Accepts <strong>short share links</strong> (<code>maps.app.goo.gl</code>), full URLs, and coordinate pairs.</span>
      </p>
    </div>
  );
}

