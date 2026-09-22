import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  Loader2,
  Search,
  AlertOctagon,
  CheckCircle2,
  Building2,
  WifiOff,
  Download,
  Lock,
} from 'lucide-react';
import {
  Campaign,
  Attendee,
  GeoLocationCoordinates,
  Organization,
  OfflineAttendanceRecord,
} from '../../types/attendance';
import { FloatingInput } from '../common/FloatingInput';
import { CameraViewfinder } from './CameraViewfinder';
import { GeofenceStatus } from './GeofenceStatus';
import { AttendanceSuccessModal } from './AttendanceSuccessModal';
import { showToast } from '../common/Toast';
import { CompressionResult } from '../../utils/imageCompression';
import { formatStateCodeInput, isValidStateCode, getClientIpAddress } from '../../utils/nysc';
import { formatDistance } from '../../utils/geo';
import { encryptOfflineRecord, downloadIwhFile } from '../../utils/crypto';
import {
  getCampaignById,
  resolveShortCode,
  checkStateCodeRegisteredToday,
  submitAttendance,
  initializeDefaultOrgAndCampaign,
  getOrganization,
} from '../../services/firebase';

interface AttendanceFormProps {
  initialCampaignId?: string;
  initialShortCode?: string;
  onCampaignLoaded?: (campaign: Campaign) => void;
}

export function AttendanceForm({
  initialCampaignId,
  initialShortCode,
  onCampaignLoaded,
}: AttendanceFormProps) {
  // Campaign & Org State
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [campaignLoading, setCampaignLoading] = useState<boolean>(true);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // Manual Short code fallback input
  const [shortCodeInput, setShortCodeInput] = useState<string>(initialShortCode || '');
  const [resolvingCode, setResolvingCode] = useState<boolean>(false);

  // Form inputs
  const [name, setName] = useState<string>('');
  const [stateCode, setStateCode] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');
  const [stateCodeError, setStateCodeError] = useState<string>('');

  // Geolocation & Geofence
  const [currentCoords, setCurrentCoords] = useState<GeoLocationCoordinates | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean>(false);

  // Captured Face
  const [capturedPhoto, setCapturedPhoto] = useState<CompressionResult | null>(null);

  // Offline Mode Switcher
  const [forceOfflineMode, setForceOfflineMode] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedAttendee, setCompletedAttendee] = useState<Attendee | null>(null);
  const [isOfflinePackage, setIsOfflinePackage] = useState<boolean>(false);
  const [offlineFilename, setOfflineFilename] = useState<string>('');

  // Accent color from organization
  const accentColor = organization?.accentColor || '#00FF66';

  // Resolve Campaign on mount or prop change
  useEffect(() => {
    let isCancelled = false;

    async function loadCampaign() {
      setCampaignLoading(true);
      setCampaignError(null);

      try {
        let loaded: Campaign | null = null;

        if (initialShortCode) {
          loaded = await resolveShortCode(initialShortCode);
        } else if (initialCampaignId) {
          loaded = await getCampaignById(initialCampaignId);
        }

        // If no URL param, load the default org & campaign
        if (!loaded) {
          const bootstrapped = await initializeDefaultOrgAndCampaign();
          loaded = bootstrapped.campaign;
          if (!isCancelled) {
            setOrganization(bootstrapped.org);
          }
        }

        if (!isCancelled) {
          if (loaded) {
            setCampaign(loaded);
            if (onCampaignLoaded) onCampaignLoaded(loaded);

            // Fetch organization details for dynamic branding
            if (loaded.orgId) {
              const org = await getOrganization(loaded.orgId);
              if (org) setOrganization(org);
            }
          } else {
            setCampaignError('Attendance session not found. Please check your link or short code.');
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Campaign load error:', err);
          setCampaignError('Failed to load attendance campaign.');
        }
      } finally {
        if (!isCancelled) setCampaignLoading(false);
      }
    }

    loadCampaign();

    return () => {
      isCancelled = true;
    };
  }, [initialCampaignId, initialShortCode, onCampaignLoaded]);

  // Handle manual short code lookup
  const handleResolveManualShortCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortCodeInput.trim()) return;

    setResolvingCode(true);
    setCampaignError(null);

    try {
      const found = await resolveShortCode(shortCodeInput);
      if (found) {
        setCampaign(found);
        if (onCampaignLoaded) onCampaignLoaded(found);
        if (found.orgId) {
          const org = await getOrganization(found.orgId);
          if (org) setOrganization(org);
        }
        showToast('success', `Joined session: ${found.name}`, 'Session Found');
        window.location.hash = `#/c/${found.shortCode}`;
      } else {
        setCampaignError(`No CDS campaign matches short code "${shortCodeInput}".`);
        showToast('error', `Short code "${shortCodeInput}" is invalid.`, 'Lookup Failed');
      }
    } catch {
      setCampaignError('Network error while resolving short code.');
    } finally {
      setResolvingCode(false);
    }
  };

  // State Code input formatter
  const handleStateCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatStateCodeInput(e.target.value);
    setStateCode(formatted);

    if (formatted.length >= 8 && !isValidStateCode(formatted)) {
      setStateCodeError('Format must be e.g. LA/23B/1234');
    } else {
      setStateCodeError('');
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (e.target.value.trim().length < 2) {
      setNameError('Please enter your full name as registered with NYSC.');
    } else {
      setNameError('');
    }
  };

  // Location update from Geofence status
  const handleLocationUpdate = (
    coords: GeoLocationCoordinates,
    distanceMeters: number,
    within: boolean
  ) => {
    setCurrentCoords(coords);
    setCurrentDistance(distanceMeters);
    setIsWithinGeofence(within);
  };

  // Submission handler with dual routing (Online vs. Offline .iwh)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaign) {
      showToast('error', 'No active attendance campaign loaded.', 'Error');
      return;
    }

    // 1. Name validation
    if (!name.trim() || name.trim().length < 2) {
      setNameError('Full name is required.');
      showToast('warning', 'Please enter your registered name.', 'Name Required');
      return;
    }

    // 2. State Code validation
    if (!isValidStateCode(stateCode)) {
      setStateCodeError('Invalid format. State Code must follow e.g. LA/23B/1234');
      showToast('warning', 'Please enter a valid State Code (e.g. LA/23B/1234).', 'Invalid State Code');
      return;
    }

    // 3. Geofence constraint check
    if (!isWithinGeofence || currentDistance === null || currentDistance > campaign.allowedRadius) {
      const distStr = currentDistance !== null ? formatDistance(currentDistance) : 'unknown';
      showToast(
        'error',
        `You are ${distStr} away from the venue. Please move within ${campaign.allowedRadius}m to submit.`,
        'Geofence Violation'
      );
      return;
    }

    // 4. Facial verification check
    if (!capturedPhoto) {
      showToast('warning', 'Please align your face and capture verification photo.', 'Photo Required');
      return;
    }

    setIsSubmitting(true);

    const isSystemOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const shouldSubmitOffline = forceOfflineMode || !isSystemOnline;

    const timestamp = new Date().toISOString();
    const lat = currentCoords ? currentCoords.latitude : campaign.targetLatitude;
    const lng = currentCoords ? currentCoords.longitude : campaign.targetLongitude;

    // === OFFLINE ROUTING ===
    if (shouldSubmitOffline) {
      try {
        const offlineRecord: OfflineAttendanceRecord = {
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          campaignId: campaign.id,
          orgId: campaign.orgId || organization?.id || '',
          timestamp,
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          base64Image: capturedPhoto.dataUrl,
          version: '1.0',
        };

        const encrypted = await encryptOfflineRecord(offlineRecord);
        const downloadedName = downloadIwhFile(encrypted);

        const syntheticAttendee: Attendee = {
          id: `att_offline_${Date.now()}`,
          campaignId: campaign.id,
          orgId: campaign.orgId,
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          photoUrl: capturedPhoto.dataUrl,
          loggedIp: 'Offline Device Sync',
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          timestamp,
          verified: true,
          isOfflineSync: true,
        };

        setIsOfflinePackage(true);
        setOfflineFilename(downloadedName);
        setCompletedAttendee(syntheticAttendee);
        showToast('success', `Encrypted package ${downloadedName} downloaded.`, 'Offline Attendance Saved');
      } catch (cryptoErr) {
        console.error('Encryption error:', cryptoErr);
        showToast('error', 'Failed to generate offline .iwh package.', 'Offline Error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // === ONLINE ROUTING ===
    try {
      // 5. Uniqueness constraint check (Database check)
      const isAlreadyRegistered = await checkStateCodeRegisteredToday(
        campaign.id,
        stateCode,
        campaign.date
      );

      if (isAlreadyRegistered) {
        showToast(
          'error',
          `State Code ${stateCode} has already registered attendance for this session today!`,
          'Duplicate Entry Blocked'
        );
        setIsSubmitting(false);
        return;
      }

      // 6. Fetch client IP address for audit
      const clientIp = await getClientIpAddress();

      // 7. Save to Firestore and Storage
      const newAttendee = await submitAttendance({
        campaignId: campaign.id,
        orgId: campaign.orgId,
        name: name.trim(),
        stateCode: stateCode.trim().toUpperCase(),
        photoBlob: capturedPhoto.blob,
        photoDataUrl: capturedPhoto.dataUrl,
        latitude: lat,
        longitude: lng,
        distanceMeters: currentDistance,
        loggedIp: clientIp,
      });

      setIsOfflinePackage(false);
      setCompletedAttendee(newAttendee);
      showToast('success', 'Attendance and biometrics logged successfully!', 'Verified');
    } catch (err) {
      console.warn('Online submission failed, offering offline fallback:', err);
      // Seamless auto-fallback to offline encryption if network dropped mid-submission
      try {
        const fallbackRecord: OfflineAttendanceRecord = {
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          campaignId: campaign.id,
          orgId: campaign.orgId || '',
          timestamp,
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          base64Image: capturedPhoto.dataUrl,
          version: '1.0',
        };
        const encrypted = await encryptOfflineRecord(fallbackRecord);
        const downloadedName = downloadIwhFile(encrypted);

        const syntheticAttendee: Attendee = {
          id: `att_offline_${Date.now()}`,
          campaignId: campaign.id,
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          photoUrl: capturedPhoto.dataUrl,
          loggedIp: 'Offline Fallback',
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          timestamp,
          verified: true,
          isOfflineSync: true,
        };

        setIsOfflinePackage(true);
        setOfflineFilename(downloadedName);
        setCompletedAttendee(syntheticAttendee);
        showToast('info', 'Cloud unavailable: Generated secure .iwh file for manual delivery.', 'Offline Fallback');
      } catch {
        showToast('error', 'Submission failed. Please check device connectivity.', 'Error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setCompletedAttendee(null);
    setIsOfflinePackage(false);
    setOfflineFilename('');
    setName('');
    setStateCode('');
    setCapturedPhoto(null);
    setNameError('');
    setStateCodeError('');
  };

  // If completed, display prominent success certificate screen
  if (completedAttendee && campaign) {
    return (
      <AttendanceSuccessModal
        attendee={completedAttendee}
        campaign={campaign}
        organizationName={organization?.name}
        accentColor={accentColor}
        isOfflinePackage={isOfflinePackage}
        offlineFilename={offlineFilename}
        onReset={handleReset}
      />
    );
  }

  return (
    <div id="attendance-flow-container" className="w-full max-w-lg mx-auto p-4 sm:p-6">
      {/* Session Loading Skeleton */}
      {campaignLoading ? (
        <div id="campaign-loading-skeleton" className="rounded-2xl bg-[#0e121a] border border-[#1b2332] p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-800 rounded animate-pulse w-1/2" />
            </div>
          </div>
          <div className="h-40 bg-slate-800/40 rounded-xl animate-pulse" />
        </div>
      ) : campaign ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prominent Dynamic Organization & Campaign Header Card */}
          <div
            id="active-campaign-banner"
            className="rounded-2xl bg-gradient-to-r from-[#101622] to-[#0c1017] border border-[#1e273a] p-4 shadow-sm relative overflow-hidden"
          >
            <div
              className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
              style={{ backgroundColor: accentColor }}
            />

            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {organization?.name ? `${organization.name} - Attendance` : 'CDS Attendance Verification'}
                </span>
              </div>

              {/* Offline mode toggle */}
              <button
                type="button"
                onClick={() => setForceOfflineMode((prev) => !prev)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                  forceOfflineMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="Toggle zero-data offline attendance (.iwh export)"
              >
                <WifiOff className="w-3 h-3" />
                <span>{forceOfflineMode ? 'Zero-Data Active' : 'Go Offline'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center space-x-2 mb-1">
                  <span
                    className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: `${accentColor}15`,
                      borderColor: `${accentColor}40`,
                      color: accentColor,
                    }}
                  >
                    CODE: {campaign.shortCode}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {new Date(campaign.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <h2 className="text-sm font-extrabold text-white truncate">{campaign.name}</h2>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">Radius</span>
                <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>
                  {campaign.allowedRadius}m Max
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Member Identity */}
          <div className="bg-[#0f141d] rounded-2xl p-4 border border-[#1e2738] shadow-sm">
            <div className="flex items-center space-x-2 mb-3">
              <span
                className="w-5 h-5 rounded-full text-xs font-extrabold flex items-center justify-center text-[#0a0c10]"
                style={{ backgroundColor: accentColor }}
              >
                1
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Member Identity
              </h3>
            </div>

            {/* State Code Input with automatic uppercase & slash formatting */}
            <FloatingInput
              id="input-state-code"
              label="State Code (e.g. LA/23B/1234)"
              value={stateCode}
              onChange={handleStateCodeChange}
              error={stateCodeError}
              hint="State / Batch / Call-up number"
              isMono
              maxLength={14}
              autoComplete="off"
            />

            {/* Full Name Input */}
            <FloatingInput
              id="input-full-name"
              label="Full Name (Surname First)"
              value={name}
              onChange={handleNameChange}
              error={nameError}
              autoComplete="name"
            />
          </div>

          {/* Section 2: Real-time Geofence Verification */}
          <div className="bg-[#0f141d] rounded-2xl p-4 border border-[#1e2738] shadow-sm">
            <div className="flex items-center space-x-2 mb-3">
              <span
                className="w-5 h-5 rounded-full text-xs font-extrabold flex items-center justify-center text-[#0a0c10]"
                style={{ backgroundColor: accentColor }}
              >
                2
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                GPS Presence Verification
              </h3>
            </div>

            <GeofenceStatus
              campaign={campaign}
              onLocationUpdate={handleLocationUpdate}
            />
          </div>

          {/* Section 3: Live Facial Detection & Liveness Camera */}
          <div className="bg-[#0f141d] rounded-2xl p-4 border border-[#1e2738] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span
                  className="w-5 h-5 rounded-full text-xs font-extrabold flex items-center justify-center text-[#0a0c10]"
                  style={{ backgroundColor: accentColor }}
                >
                  3
                </span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Facial Liveness Verification
                </h3>
              </div>

              {capturedPhoto && (
                <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: accentColor }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Captured
                </span>
              )}
            </div>

            <CameraViewfinder
              onCapture={(result) => {
                setCapturedPhoto(result);
                showToast('success', 'Face captured and compressed for submission.', 'Face Verified');
              }}
              disabled={!isWithinGeofence}
            />
          </div>

          {/* Submit Attendance Button */}
          <div className="pt-2">
            <button
              id="btn-submit-attendance"
              type="submit"
              disabled={
                isSubmitting ||
                !name.trim() ||
                !isValidStateCode(stateCode) ||
                !isWithinGeofence ||
                !capturedPhoto
              }
              className={`w-full py-4 px-5 rounded-2xl font-black text-sm tracking-wide flex items-center justify-center space-x-2 transition-all duration-300 ${
                !isSubmitting &&
                name.trim() &&
                isValidStateCode(stateCode) &&
                isWithinGeofence &&
                capturedPhoto
                  ? 'text-[#0a0c10] shadow-xl hover:opacity-95 active:scale-[0.99] cursor-pointer'
                  : 'bg-[#151c27] text-slate-500 border border-[#232d3d] cursor-not-allowed'
              }`}
              style={{
                backgroundColor:
                  !isSubmitting &&
                  name.trim() &&
                  isValidStateCode(stateCode) &&
                  isWithinGeofence &&
                  capturedPhoto
                    ? accentColor
                    : undefined,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#0a0c10]" />
                  <span>{forceOfflineMode ? 'Packaging Encrypted .iwh...' : 'Verifying & Saving Record...'}</span>
                </>
              ) : forceOfflineMode ? (
                <>
                  <Lock className="w-5 h-5 text-black" />
                  <span className="text-black">Download Encrypted Attendance (.iwh)</span>
                  <Download className="w-4 h-4 text-black" />
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-black" />
                  <span className="text-black">Submit CDS Attendance</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </>
              )}
            </button>

            {/* Explanatory notes under submit */}
            <div className="mt-2 text-center">
              {!isWithinGeofence && currentDistance !== null ? (
                <p className="text-[11px] text-amber-400 font-medium">
                  ⚠️ Cannot submit: You are currently outside the {campaign.allowedRadius}m geofence.
                </p>
              ) : !capturedPhoto ? (
                <p className="text-[11px] text-slate-400">
                  Look into front camera and capture face verification to enable submission.
                </p>
              ) : forceOfflineMode ? (
                <p className="text-[11px] text-amber-300 font-medium">
                  ✓ Offline Mode: Generates an AES-256 encrypted file for zero-data submission to your Admin.
                </p>
              ) : (
                <p className="text-[11px] font-medium" style={{ color: accentColor }}>
                  ✓ All verification parameters satisfied. Tap above to log attendance.
                </p>
              )}
            </div>
          </div>
        </form>
      ) : (
        /* Campaign Not Found / Manual Short Code Lookup Form */
        <div id="manual-campaign-lookup" className="rounded-2xl bg-[#0e121a] border border-[#1e273a] p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Enter CDS Session Code</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-5 leading-relaxed">
            {campaignError || 'Enter the 5-character alphanumeric short code displayed by your CDS Coordinator.'}
          </p>

          <form onSubmit={handleResolveManualShortCode} className="max-w-xs mx-auto space-y-3">
            <div className="relative">
              <input
                id="input-manual-short-code"
                type="text"
                value={shortCodeInput}
                onChange={(e) => setShortCodeInput(e.target.value.toLowerCase())}
                placeholder="e.g. xyz12"
                maxLength={5}
                className="w-full py-3 px-4 rounded-xl bg-[#141a24] border border-[#232f42] text-center font-mono text-base font-bold uppercase tracking-widest text-[#00FF66] outline-none focus:border-[#00FF66] focus:shadow-[0_0_15px_rgba(0,255,102,0.2)]"
              />
            </div>

            <button
              id="btn-resolve-code"
              type="submit"
              disabled={resolvingCode || shortCodeInput.trim().length < 3}
              className="w-full py-3 px-4 rounded-xl bg-[#00FF66] text-[#0a0c10] font-bold text-xs flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(0,255,102,0.3)] disabled:opacity-50"
            >
              {resolvingCode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Load CDS Session</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
