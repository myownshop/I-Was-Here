import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  Navigation,
  MapPin,
  ExternalLink,
  Locate,
  Route,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Campaign, GeoLocationCoordinates } from '../../types/attendance';
import {
  calculateBearing,
  formatDistance,
  getGoogleMapsNavigationUrl,
} from '../../utils/geo';

interface VenueGuidanceMapProps {
  campaign: Campaign;
  userCoords: GeoLocationCoordinates | null;
  distanceMeters: number | null;
  isWithinGeofence: boolean;
  accentColor?: string;
  onRefreshGps?: () => void;
  isLoadingGps?: boolean;
}

export function VenueGuidanceMap({
  campaign,
  userCoords,
  distanceMeters,
  isWithinGeofence,
  accentColor = '#00FF66',
  onRefreshGps,
  isLoadingGps = false,
}: VenueGuidanceMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const venueMarkerRef = useRef<L.Marker | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const pathLineRef = useRef<L.Polyline | null>(null);
  const [copied, setCopied] = useState(false);

  // Calculate bearing and compass heading if user coords available
  const bearingInfo =
    userCoords && campaign.targetLatitude && campaign.targetLongitude
      ? calculateBearing(
          userCoords.latitude,
          userCoords.longitude,
          campaign.targetLatitude,
          campaign.targetLongitude
        )
      : null;

  // Initialize and update Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = userCoords?.latitude || campaign.targetLatitude;
      const initialLng = userCoords?.longitude || campaign.targetLongitude;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark CartoDB / OSM tiles
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Venue Marker with glowing neon badge
    const venueIcon = L.divIcon({
      className: 'venue-custom-icon',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
          <div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background: ${accentColor}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 28px; height: 28px; border-radius: 10px; background: #0a0d14; border: 2px solid ${accentColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${accentColor}80;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (venueMarkerRef.current) {
      venueMarkerRef.current.setLatLng([campaign.targetLatitude, campaign.targetLongitude]);
    } else {
      venueMarkerRef.current = L.marker(
        [campaign.targetLatitude, campaign.targetLongitude],
        { icon: venueIcon }
      )
        .addTo(map)
        .bindPopup(
          `<b style="color:#0a0c10">${campaign.name}</b><br><span style="font-size:11px; color:#555">CDS Designated Venue</span>`
        );
    }

    // 2. Allowed Geofence Circle around venue
    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setLatLng([campaign.targetLatitude, campaign.targetLongitude]);
      geofenceCircleRef.current.setRadius(campaign.allowedRadius);
    } else {
      geofenceCircleRef.current = L.circle(
        [campaign.targetLatitude, campaign.targetLongitude],
        {
          radius: campaign.allowedRadius,
          color: accentColor,
          fillColor: accentColor,
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '4, 6',
        }
      ).addTo(map);
    }

    // 3. User Marker (if GPS acquired)
    if (userCoords) {
      const userIcon = L.divIcon({
        className: 'user-custom-icon',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 9999px; background: #38bdf8; opacity: 0.3; animation: pulse 1.5s infinite;"></div>
            <div style="width: 16px; height: 16px; border-radius: 9999px; background: #0284c7; border: 2px solid #ffffff; box-shadow: 0 0 8px #38bdf8;"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userCoords.latitude, userCoords.longitude]);
      } else {
        userMarkerRef.current = L.marker(
          [userCoords.latitude, userCoords.longitude],
          { icon: userIcon }
        )
          .addTo(map)
          .bindPopup('<b style="color:#0a0c10">Your Live GPS Location</b>');
      }

      // 4. Connecting Trajectory Line between User and Venue
      const latlngs: L.LatLngExpression[] = [
        [userCoords.latitude, userCoords.longitude],
        [campaign.targetLatitude, campaign.targetLongitude],
      ];

      if (pathLineRef.current) {
        pathLineRef.current.setLatLngs(latlngs);
      } else {
        pathLineRef.current = L.polyline(latlngs, {
          color: isWithinGeofence ? accentColor : '#f59e0b',
          weight: 3,
          dashArray: '6, 8',
          opacity: 0.85,
        }).addTo(map);
      }

      // Auto fit bounds so both user and venue are visible
      try {
        const bounds = L.latLngBounds([
          [userCoords.latitude, userCoords.longitude],
          [campaign.targetLatitude, campaign.targetLongitude],
        ]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      } catch (err) {
        console.warn('Map bounds fit error:', err);
      }
    } else {
      map.setView([campaign.targetLatitude, campaign.targetLongitude], 16);
    }
  }, [campaign, userCoords, isWithinGeofence, accentColor]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleCenterUser = () => {
    if (mapInstanceRef.current && userCoords) {
      mapInstanceRef.current.setView([userCoords.latitude, userCoords.longitude], 17, {
        animate: true,
      });
    }
  };

  const handleCenterVenue = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [campaign.targetLatitude, campaign.targetLongitude],
        17,
        { animate: true }
      );
    }
  };

  const handleCopyCoords = () => {
    const text = `${campaign.targetLatitude}, ${campaign.targetLongitude}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const googleMapsUrl = getGoogleMapsNavigationUrl(
    campaign.targetLatitude,
    campaign.targetLongitude,
    campaign.name
  );

  return (
    <div
      id="venue-guidance-map-card"
      className="bg-[#0b0f17] border border-[#1b2536] rounded-2xl overflow-hidden shadow-lg space-y-0"
    >
      {/* Live Direction / Compass Banner */}
      <div className="p-3 bg-gradient-to-r from-[#111724] to-[#0c1119] border-b border-[#1c2738] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isWithinGeofence
                ? 'bg-[#00FF66]/20 text-[#00FF66]'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {isWithinGeofence ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Compass className="w-4 h-4 animate-spin-slow" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black uppercase text-white tracking-wide">
                {isWithinGeofence
                  ? 'Venue Presence Verified'
                  : bearingInfo
                  ? `Walk ${bearingInfo.label} (${bearingInfo.cardinal})`
                  : 'Venue Guidance & Routing'}
              </span>
              {distanceMeters !== null && (
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                    isWithinGeofence
                      ? 'bg-[#00FF66]/15 text-[#00FF66]'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {formatDistance(distanceMeters)} away
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {isWithinGeofence
                ? `Inside ${campaign.allowedRadius}m geofence radius. You can now take your biometric selfie.`
                : `Destination: ${campaign.name} (Within ${campaign.allowedRadius}m boundary)`}
            </p>
          </div>
        </div>

        {/* Live GPS Navigation Deeplink */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00FF66] hover:bg-[#00e55b] text-[#0a0c10] text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0"
          title="Open live walking directions in Google Maps"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Open Google Maps</span>
          <ExternalLink className="w-3 h-3 ml-0.5" />
        </a>
      </div>

      {/* Leaflet Map Frame */}
      <div className="relative w-full h-56 sm:h-64 bg-[#0a0d14]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Map Float Controls */}
        <div className="absolute top-2.5 right-2.5 z-[1000] flex flex-col gap-1.5">
          {userCoords && (
            <button
              type="button"
              onClick={handleCenterUser}
              className="w-8 h-8 rounded-lg bg-[#0e141e]/90 hover:bg-[#162030] text-sky-400 border border-[#233146] flex items-center justify-center shadow-md backdrop-blur transition-all"
              title="Locate My Position"
            >
              <Locate className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCenterVenue}
            className="w-8 h-8 rounded-lg bg-[#0e141e]/90 hover:bg-[#162030] text-[#00FF66] border border-[#233146] flex items-center justify-center shadow-md backdrop-blur transition-all"
            title="Center Venue Target"
          >
            <MapPin className="w-4 h-4" />
          </button>
        </div>

        {/* Live Status Legend on map bottom */}
        <div className="absolute bottom-2 left-2 z-[1000] bg-[#0c1018]/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-[#1e2a3c] flex items-center gap-3 text-[10px] font-mono text-slate-300 shadow-md">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-sm border"
              style={{ backgroundColor: accentColor, borderColor: accentColor }}
            />
            <span>Target ({campaign.allowedRadius}m)</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-[#0d121c] border-t border-[#1b2536] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">
            GPS: {campaign.targetLatitude.toFixed(4)}, {campaign.targetLongitude.toFixed(4)}
          </span>
          <button
            type="button"
            onClick={handleCopyCoords}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#151c28] transition-colors"
            title="Copy Coordinates"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#00FF66]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {onRefreshGps && (
          <button
            type="button"
            onClick={onRefreshGps}
            disabled={isLoadingGps}
            className="text-[11px] text-[#00FF66] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <Route className="w-3.5 h-3.5" />
            <span>{isLoadingGps ? 'Recalculating GPS...' : 'Re-check Position'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
