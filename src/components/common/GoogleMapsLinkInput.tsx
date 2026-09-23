import React, { useState } from 'react';
import { MapPin, Link as LinkIcon, Check, AlertCircle, ExternalLink, Sparkles, ClipboardPaste } from 'lucide-react';
import { parseGoogleMapsUrlOrCoordinates, ParsedVenueLocation } from '../../utils/geo';

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
}

export function GoogleMapsLinkInput({
  onCoordinatesParsed,
  accentColor = '#00FF66',
  placeholder = 'Paste Google Maps link or GPS coordinates (e.g., https://maps.google.com/...)',
  className = '',
  currentLat,
  currentLng,
}: GoogleMapsLinkInputProps) {
  const [inputUrl, setInputUrl] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParsedVenueLocation | null>(null);
  const [hasCopiedFeedback, setHasCopiedFeedback] = useState<boolean>(false);

  const handleApply = (urlToParse = inputUrl) => {
    const trimmed = urlToParse.trim();
    if (!trimmed) {
      setParseResult(null);
      return;
    }

    const result = parseGoogleMapsUrlOrCoordinates(trimmed);
    setParseResult(result);

    if (result.success && result.latitude !== undefined && result.longitude !== undefined) {
      onCoordinatesParsed({
        latitude: result.latitude,
        longitude: result.longitude,
        venueName: result.venueName,
      });
      setHasCopiedFeedback(true);
      setTimeout(() => setHasCopiedFeedback(false), 2500);
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
      // Clipboard access might require user gesture or permission
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
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-sky-400" />
          <span>Paste Google Maps Venue Link</span>
        </label>
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

      {/* Input container with Paste button */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-slate-400 pointer-events-none">
          <MapPin className="w-4 h-4 text-sky-400" />
        </div>

        <input
          type="text"
          value={inputUrl}
          onChange={(e) => {
            setInputUrl(e.target.value);
            if (parseResult) setParseResult(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-24 py-2.5 bg-[#141b26] border border-[#223043] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 transition-colors"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {navigator.clipboard && (
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-2 py-1 bg-[#1e293b] hover:bg-[#28384f] text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-[#334155]"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="w-3 h-3 text-sky-400" />
              <span>Paste</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleApply()}
            disabled={!inputUrl.trim()}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              hasCopiedFeedback
                ? 'bg-[#00FF66] text-black font-extrabold shadow-[0_0_10px_rgba(0,255,102,0.3)]'
                : 'bg-sky-500 hover:bg-sky-400 text-black font-extrabold'
            }`}
          >
            {hasCopiedFeedback ? (
              <>
                <Check className="w-3 h-3" />
                <span>Extracted!</span>
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
          className={`p-2.5 rounded-xl text-xs border transition-all ${
            parseResult.success
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}
        >
          {parseResult.success ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between font-bold text-emerald-400">
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>GPS Coordinates Locked</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/30">
                  {parseResult.sourceType?.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] font-mono text-emerald-100 flex items-center gap-2">
                <span>Lat: {parseResult.latitude}</span>
                <span>•</span>
                <span>Lng: {parseResult.longitude}</span>
              </div>
              {parseResult.venueName && (
                <div className="text-[11px] text-slate-300 pt-0.5">
                  Venue: <strong className="text-white">{parseResult.venueName}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span>{parseResult.error}</span>
                {parseResult.sourceType === 'short_url' && (
                  <p className="mt-1 text-slate-300">
                    💡 <em>Tip:</em> Open the maps.app.goo.gl link in your browser tab, let it load, and copy the full URL from the top address bar.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-normal">
        Supports any Google Maps share link, <code>/@lat,lng</code> address bar URL, <code>?q=lat,lng</code>, DMS format, or raw GPS coordinates.
      </p>
    </div>
  );
}
