import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Compass,
  Navigation,
  MapPin,
  ExternalLink,
  Locate,
  Route,
  CheckCircle2,
  Copy,
  Check,
  Layers,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
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
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const venueMarkerRef = useRef<L.Marker | null>(null);
  const geofenceCircleRef = useRef<L.Circle | null>(null);
  const pathLineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [copied, setCopied] = useState(false);
  const [mapTheme, setMapTheme] = useState<'standard' | 'dark'>('standard');

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

  // OpenStreetMap URLs using exact member GPS coordinates
  const osmMemberExactUrl = userCoords
    ? `https://www.openstreetmap.org/?mlat=${userCoords.latitude}&mlon=${userCoords.longitude}#map=19/${userCoords.latitude}/${userCoords.longitude}`
    : `https://www.openstreetmap.org/?mlat=${campaign.targetLatitude}&mlon=${campaign.targetLongitude}#map=18/${campaign.targetLatitude}/${campaign.targetLongitude}`;

  const osmDirectionsUrl = userCoords
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${userCoords.latitude}%2C${userCoords.longitude}%3B${campaign.targetLatitude}%2C${campaign.targetLongitude}`
    : osmMemberExactUrl;

  const googleMapsUrl = userCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.latitude},${userCoords.longitude}&destination=${campaign.targetLatitude},${campaign.targetLongitude}&travelmode=walking`
    : getGoogleMapsNavigationUrl(
        campaign.targetLatitude,
        campaign.targetLongitude,
        campaign.name
      );

  // Initialize Leaflet map with OpenStreetMap
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = userCoords?.latitude || campaign.targetLatitude;
      const initialLng = userCoords?.longitude || campaign.targetLongitude;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      // Standard OpenStreetMap Tile Layer
      const osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      }).addTo(map);

      tileLayerRef.current = osmTileLayer;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Venue Marker with glowing neon badge
    const venueIcon = L.divIcon({
      className: 'venue-custom-icon',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
          <div style="position: absolute; width: 40px; height: 40px; border-radius: 9999px; background: ${accentColor}; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 32px; height: 32px; border-radius: 12px; background: #0a0d14; border: 2.5px solid ${accentColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px ${accentColor}90; cursor: pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (venueMarkerRef.current) {
      venueMarkerRef.current.setLatLng([campaign.targetLatitude, campaign.targetLongitude]);
    } else {
      venueMarkerRef.current = L.marker(
        [campaign.targetLatitude, campaign.targetLongitude],
        { icon: venueIcon, zIndexOffset: 1000 }
      )
        .addTo(map)
        .bindPopup(
          `<div style="font-family: inherit; padding: 4px;">
            <strong style="color: #0f172a; font-size: 13px;">${campaign.name}</strong><br/>
            <span style="color: #475569; font-size: 11px;">Designated CDS Roll Call Venue</span><br/>
            <span style="display:inline-block; margin-top:4px; font-size:10px; font-weight:700; background:#00FF6620; color:#047857; padding:2px 6px; border-radius:4px;">Allowed Radius: ${campaign.allowedRadius}m</span>
          </div>`
        );
    }

    // 2. Allowed Geofence Circle around venue
    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setLatLng([campaign.targetLatitude, campaign.targetLongitude]);
      geofenceCircleRef.current.setRadius(campaign.allowedRadius);
      geofenceCircleRef.current.setStyle({
        color: accentColor,
        fillColor: accentColor,
        fillOpacity: isWithinGeofence ? 0.22 : 0.12,
      });
    } else {
      geofenceCircleRef.current = L.circle(
        [campaign.targetLatitude, campaign.targetLongitude],
        {
          radius: campaign.allowedRadius,
          color: accentColor,
          fillColor: accentColor,
          fillOpacity: isWithinGeofence ? 0.22 : 0.12,
          weight: 2.5,
          dashArray: '6, 6',
        }
      ).addTo(map);
    }

    // 3. User Live Marker & Accuracy Circle (if GPS acquired)
    if (userCoords) {
      const userIcon = L.divIcon({
        className: 'user-custom-icon',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
            <div style="position: absolute; width: 32px; height: 32px; border-radius: 9999px; background: #0284c7; opacity: 0.35; animation: pulse 1.5s infinite;"></div>
            <div style="width: 18px; height: 18px; border-radius: 9999px; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 0 10px #38bdf8; cursor: pointer;"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userCoords.latitude, userCoords.longitude]);
      } else {
        userMarkerRef.current = L.marker(
          [userCoords.latitude, userCoords.longitude],
          { icon: userIcon, zIndexOffset: 900 }
        )
          .addTo(map)
          .bindPopup(
            `<div style="font-family: inherit; padding: 4px;">
              <strong style="color: #0284c7; font-size: 12px;">Your Live Position</strong><br/>
              <span style="color: #475569; font-size: 11px;">GPS Accuracy: ±${Math.round(userCoords.accuracy || 10)}m</span>
            </div>`
          );
      }

      // User Accuracy Radius Circle
      if (userCoords.accuracy && userCoords.accuracy > 5) {
        if (userAccuracyCircleRef.current) {
          userAccuracyCircleRef.current.setLatLng([userCoords.latitude, userCoords.longitude]);
          userAccuracyCircleRef.current.setRadius(userCoords.accuracy);
        } else {
          userAccuracyCircleRef.current = L.circle(
            [userCoords.latitude, userCoords.longitude],
            {
              radius: userCoords.accuracy,
              color: '#0284c7',
              fillColor: '#38bdf8',
              fillOpacity: 0.08,
              weight: 1,
              dashArray: '3, 4',
            }
          ).addTo(map);
        }
      }

      // 4. Connecting Trajectory Line between User and Venue
      const latlngs: L.LatLngExpression[] = [
        [userCoords.latitude, userCoords.longitude],
        [campaign.targetLatitude, campaign.targetLongitude],
      ];

      if (pathLineRef.current) {
        pathLineRef.current.setLatLngs(latlngs);
        pathLineRef.current.setStyle({
          color: isWithinGeofence ? accentColor : '#f59e0b',
        });
      } else {
        pathLineRef.current = L.polyline(latlngs, {
          color: isWithinGeofence ? accentColor : '#f59e0b',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.9,
        }).addTo(map);
      }

      // Auto fit bounds so both user and venue are visible
      try {
        const bounds = L.latLngBounds([
          [userCoords.latitude, userCoords.longitude],
          [campaign.targetLatitude, campaign.targetLongitude],
        ]);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 18 });
      } catch {
        // Ignore bounds fitting error
      }
    } else {
      map.setView([campaign.targetLatitude, campaign.targetLongitude], 17);
    }
  }, [campaign, userCoords, isWithinGeofence, accentColor]);

  // Handle tile theme changes (Standard OSM vs Dark Inverted OSM)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapTheme === 'dark') {
      mapContainerRef.current.classList.add('leaflet-dark-tiles');
    } else {
      mapContainerRef.current.classList.remove('leaflet-dark-tiles');
    }
  }, [mapTheme]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleCenterUser = useCallback(() => {
    if (mapInstanceRef.current && userCoords) {
      mapInstanceRef.current.setView([userCoords.latitude, userCoords.longitude], 18, {
        animate: true,
      });
    }
  }, [userCoords]);

  const handleCenterVenue = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [campaign.targetLatitude, campaign.targetLongitude],
        18,
        { animate: true }
      );
    }
  }, [campaign.targetLatitude, campaign.targetLongitude]);

  const handleFitBounds = useCallback(() => {
    if (mapInstanceRef.current && userCoords) {
      const bounds = L.latLngBounds([
        [userCoords.latitude, userCoords.longitude],
        [campaign.targetLatitude, campaign.targetLongitude],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    } else if (mapInstanceRef.current) {
      handleCenterVenue();
    }
  }, [userCoords, campaign.targetLatitude, campaign.targetLongitude, handleCenterVenue]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleCopyCoords = () => {
    const text = `${campaign.targetLatitude}, ${campaign.targetLongitude}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="venue-guidance-map-card"
      className="bg-[#0b0f17] border border-[#1b2536] rounded-2xl overflow-hidden shadow-lg space-y-0"
    >
      {/* Top Banner: Real-time Bearing & Geofence Navigation Info */}
      <div className="p-3.5 bg-gradient-to-r from-[#101622] to-[#0c1119] border-b border-[#1c2738] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
              isWithinGeofence
                ? 'bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}
          >
            {isWithinGeofence ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Compass className="w-5 h-5 animate-spin-slow" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black uppercase text-white tracking-wide">
                {isWithinGeofence
                  ? 'Venue Presence Verified'
                  : bearingInfo
                  ? `Walk ${bearingInfo.label} (${bearingInfo.cardinal})`
                  : 'OpenStreetMap Live Routing'}
              </span>
              {distanceMeters !== null && (
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                    isWithinGeofence
                      ? 'bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {formatDistance(distanceMeters)} away
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {isWithinGeofence
                ? `Inside ${campaign.allowedRadius}m geofence radius. Biometric camera is enabled.`
                : `Destination: ${campaign.name} (Requires entry into ${campaign.allowedRadius}m circle)`}
            </p>
          </div>
        </div>

        {/* Live Map External Routing Links */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <a
            href={osmDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141d2c] hover:bg-[#1d293d] text-slate-200 hover:text-white text-xs font-bold border border-[#27374d] transition-all cursor-pointer"
            title="Open walking route in OpenStreetMap"
          >
            <Route className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>OpenStreetMap</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00FF66] hover:bg-[#00e55b] text-[#0a0c10] text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            title="Open turn-by-turn navigation in Google Maps"
          >
            <Navigation className="w-3.5 h-3.5 text-black" />
            <span>Google Maps</span>
            <ExternalLink className="w-3 h-3 text-black" />
          </a>
        </div>
      </div>

      {/* Leaflet + OpenStreetMap Container */}
      <div className="relative w-full h-64 sm:h-72 bg-[#0a0d14]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Map Floating Action Controls */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
          {userCoords && (
            <button
              type="button"
              onClick={handleCenterUser}
              className="w-8 h-8 rounded-lg bg-[#0e141e]/95 hover:bg-[#162030] text-sky-400 border border-[#233146] flex items-center justify-center shadow-md backdrop-blur transition-all cursor-pointer"
              title="Locate My Position"
            >
              <Locate className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCenterVenue}
            className="w-8 h-8 rounded-lg bg-[#0e141e]/95 hover:bg-[#162030] text-[#00FF66] border border-[#233146] flex items-center justify-center shadow-md backdrop-blur transition-all cursor-pointer"
            title="Center Target Venue"
          >
            <MapPin className="w-4 h-4" />
          </button>

          {userCoords && (
            <button
              type="button"
              onClick={handleFitBounds}
              className="w-8 h-8 rounded-lg bg-[#0e141e]/95 hover:bg-[#162030] text-slate-300 border border-[#233146] flex items-center justify-center shadow-md backdrop-blur transition-all cursor-pointer"
              title="Fit Both You & Target"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="h-px bg-[#233146] my-0.5" />

          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-[#0e141e]/95 hover:bg-[#162030] text-slate-300 border border-[#233146] flex items-center justify-center shadow-md backdrop-blur transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-[#0e141e]/95 hover:bg-[#162030] text-slate-300 border border-[#233146] flex items-center justify-center shadow-md backdrop-blur transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        {/* Map Style Switcher (Standard OSM vs Dark OSM) */}
        <div className="absolute top-3 left-3 z-[1000]">
          <button
            type="button"
            onClick={() => setMapTheme(mapTheme === 'standard' ? 'dark' : 'standard')}
            className="px-2.5 py-1 rounded-lg bg-[#0e141e]/90 hover:bg-[#162030] text-slate-300 border border-[#233146] flex items-center gap-1.5 shadow-md backdrop-blur text-[10px] font-bold transition-all cursor-pointer"
            title="Toggle map visual style"
          >
            <Layers className="w-3 h-3 text-[#00FF66]" />
            <span>{mapTheme === 'standard' ? 'OSM Standard' : 'OSM Dark'}</span>
          </button>
        </div>

        {/* Live Map Legend & OSM Attribution */}
        <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-[#0c1018]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#1e2a3c] flex items-center gap-3 text-[10px] font-mono text-slate-300 shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse border border-white/50" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm border"
              style={{ backgroundColor: accentColor, borderColor: accentColor }}
            />
            <span>Geofence ({campaign.allowedRadius}m)</span>
          </div>
          <span className="text-slate-500 font-sans text-[9px] hidden sm:inline">
            • Powered by Leaflet &amp; OpenStreetMap
          </span>
        </div>
      </div>

      {/* Footer Info & Position Refresh Bar */}
      <div className="p-3 bg-[#0d121c] border-t border-[#1b2536] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          {userCoords ? (
            <span className="font-mono text-[11px] text-sky-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
              Member GPS: {userCoords.latitude.toFixed(6)}, {userCoords.longitude.toFixed(6)} (±{Math.round(userCoords.accuracy || 10)}m)
            </span>
          ) : (
            <span className="font-mono text-[11px] text-slate-300">
              Target Venue: {campaign.targetLatitude.toFixed(5)}, {campaign.targetLongitude.toFixed(5)}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopyCoords}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#151c28] transition-colors cursor-pointer"
            title="Copy Venue Coordinates to Clipboard"
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
            <Crosshair className={`w-3.5 h-3.5 ${isLoadingGps ? 'animate-spin' : ''}`} />
            <span>{isLoadingGps ? 'Recalculating GPS...' : 'Re-acquire Live GPS'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
