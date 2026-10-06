import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  AlertOctagon,
  CheckCircle2,
  Building2,
  WifiOff,
  Download,
  Lock,
  Timer,
  Zap,
  Sparkles,
  Radio,
  ChevronDown,
  Clock,
  QrCode,
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
import { SessionTimer, useSessionTimer } from './SessionTimer';
import { QRScannerModal } from './QRScannerModal';
import { ParsedQRResult } from '../../utils/qrParser';
import { showToast } from '../common/Toast';
import { CompressionResult } from '../../utils/imageCompression';
import { formatStateCodeInput, isValidStateCode, getClientIpAddress } from '../../utils/nysc';
import { formatDistance, isCoordinatesValid } from '../../utils/geo';
import { encryptOfflineRecord, downloadIwhFile } from '../../utils/crypto';
import { serializeAndStoreAttendance } from '../../utils/indexedDB';
import { isTamperingDetected } from '../../utils/antiTampering';
import { formatWATDate, formatWATTime, getCurrentWATTimeHHMM } from '../../utils/dateUtils';
import {
  getCampaignById,
  resolveShortCode,
  checkStateCodeRegisteredToday,
  submitAttendance,
  getOrganization,
  getAllCampaigns,
  getOrCreateDefaultActiveCampaign,
  getCachedActiveCampaign,
  DEFAULT_STARTER_CAMPAIGN,
} from '../../services/firebase';

interface AttendanceFormProps {
  initialCampaignId?: string;
  initialShortCode?: string;
  onCampaignLoaded?: (campaign: Campaign) => void;
  onBackToHome?: () => void;
}

export function AttendanceForm({
  initialCampaignId,
  initialShortCode,
  onCampaignLoaded,
  onBackToHome,
}: AttendanceFormProps) {
  // Campaign & Org State - initialized synchronously with cached or default active campaign
  // so clicking the attendance link goes STRAIGHT into signing attendance without any "load session" prompt
  const [campaign, setCampaign] = useState<Campaign>(() =>
    getCachedActiveCampaign(initialShortCode, initialCampaignId)
  );
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [campaignLoading, setCampaignLoading] = useState<boolean>(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  // Live countdown and automated scheduling engine hook
  const sessionTimer = useSessionTimer(campaign);

  // Manual Short code fallback input
  const [shortCodeInput, setShortCodeInput] = useState<string>(initialShortCode || '');
  const [resolvingCode, setResolvingCode] = useState<boolean>(false);

  // Form inputs
  const [name, setName] = useState<string>('');
  const [stateCode, setStateCode] = useState<string>('');
  const [timeBlockCode, setTimeBlockCode] = useState<string>('');
  const [isFocusedTimeBlock, setIsFocusedTimeBlock] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string>('');
  const [stateCodeError, setStateCodeError] = useState<string>('');

  // Time Block Helpers & Active Window Detection
  const availableTimeBlocks = campaign?.timeBlocks && campaign.timeBlocks.length > 0 ? campaign.timeBlocks : [];
  const selectedBlock = availableTimeBlocks.find(
    (b) => b.code.toUpperCase() === timeBlockCode.trim().toUpperCase()
  );
  const isBlockActive = useCallback(
    (b: { startTime: string; endTime: string }) => {
      const now = getCurrentWATTimeHHMM();
      return now >= b.startTime && now <= b.endTime;
    },
    []
  );

  // Auto-select single or currently active time block when campaign loads
  useEffect(() => {
    if (campaign?.timeBlocks && campaign.timeBlocks.length > 0) {
      if (campaign.timeBlocks.length === 1) {
        setTimeBlockCode(campaign.timeBlocks[0].code);
      } else {
        const now = getCurrentWATTimeHHMM();
        const activeBlock = campaign.timeBlocks.find(
          (b) => now >= b.startTime && now <= b.endTime
        );
        if (activeBlock) {
          setTimeBlockCode(activeBlock.code);
        }
      }
    }
  }, [campaign]);

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
  const [savingElapsedSeconds, setSavingElapsedSeconds] = useState<number>(0);
  const [savingStage, setSavingStage] = useState<'biometrics' | 'auditing' | 'committing'>('biometrics');
  const [completedAttendee, setCompletedAttendee] = useState<Attendee | null>(null);
  const [isOfflinePackage, setIsOfflinePackage] = useState<boolean>(false);
  const [offlineFilename, setOfflineFilename] = useState<string>('');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState<boolean>(false);

  // 15-second submission progress timer
  useEffect(() => {
    let interval: number;
    if (isSubmitting) {
      setSavingElapsedSeconds(0);
      const start = performance.now();
      interval = window.setInterval(() => {
        const elapsed = (performance.now() - start) / 1000;
        setSavingElapsedSeconds(Number(elapsed.toFixed(1)));
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSubmitting]);

  // Accent color from organization
  const accentColor = organization?.accentColor || '#00FF66';

  // Keep onCampaignLoaded in a ref so its reference changes do not trigger re-fetches
  const onCampaignLoadedRef = useRef(onCampaignLoaded);
  useEffect(() => {
    onCampaignLoadedRef.current = onCampaignLoaded;
  }, [onCampaignLoaded]);

  // Resolve Campaign on mount or prop change
  useEffect(() => {
    let isCancelled = false;

    async function loadCampaign() {
      setCampaignLoading(true);
      setCampaignError(null);

      try {
        let loaded: Campaign | null = null;
        const codeToResolve = initialShortCode || initialCampaignId;

        // 1. If link contained a shortCode or campaignId, resolve it
        if (codeToResolve) {
          loaded = await resolveShortCode(codeToResolve);
          if (!loaded && initialCampaignId) {
            loaded = await getCampaignById(initialCampaignId);
          }
        }

        // 2. If not found by specific code or if link was generic, find active/latest session
        if (!loaded) {
          const all = await getAllCampaigns();
          const active = all.find((c) => c.status === 'active' || (!c.status && !c.isClosed));
          loaded = active || all[0] || null;
        }

        // 3. If zero campaigns exist in database, provision default active session
        if (!loaded) {
          loaded = await getOrCreateDefaultActiveCampaign();
        }

        if (!isCancelled && loaded) {
          setCampaign(loaded);
          onCampaignLoadedRef.current?.(loaded);

          // Fetch organization details asynchronously without blocking UI
          if (loaded.orgId) {
            getOrganization(loaded.orgId)
              .then((org) => {
                if (org && !isCancelled) setOrganization(org);
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('Campaign background resolve warning:', err);
          // Fallback to starter campaign so attendee is never stranded on load session screen
          try {
            const fallback = await getOrCreateDefaultActiveCampaign();
            if (!isCancelled && fallback) {
              setCampaign(fallback);
              onCampaignLoadedRef.current?.(fallback);
              return;
            }
          } catch {
            // Keep current campaign
          }
        }
      } finally {
        if (!isCancelled) setCampaignLoading(false);
      }
    }

    loadCampaign();

    return () => {
      isCancelled = true;
    };
  }, [initialCampaignId, initialShortCode]);

  // Handle scanned QR code result
  const handleCodeDetected = async (result: ParsedQRResult) => {
    setIsQRScannerOpen(false);
    setCampaignLoading(true);
    setCampaignError(null);

    try {
      let found: Campaign | null = null;
      if (result.type === 'campaignId') {
        found = await getCampaignById(result.code);
      } else {
        found = await resolveShortCode(result.code);
      }

      if (found) {
        setCampaign(found);
        onCampaignLoadedRef.current?.(found);
        if (found.orgId) {
          const org = await getOrganization(found.orgId);
          if (org) setOrganization(org);
        }
        showToast('success', `Joined session: ${found.name}`, 'Session Joined');
        window.location.hash = `#/c/${found.shortCode}`;
      } else {
        setCampaignError(`No roll call session found matching scanned QR code "${result.code}".`);
        showToast('error', `Session code "${result.code}" was not found. Please try again.`, 'Session Not Found');
      }
    } catch (err) {
      console.error('QR code resolve error:', err);
      setCampaignError('Network error while looking up scanned QR code.');
    } finally {
      setCampaignLoading(false);
    }
  };

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
        onCampaignLoadedRef.current?.(found);
        if (found.orgId) {
          const org = await getOrganization(found.orgId);
          if (org) setOrganization(org);
        }
        showToast('success', `Joined session: ${found.name}`, 'Session Found');
        window.location.hash = `#/c/${found.shortCode}`;
      } else {
        setCampaignError(`No CDS campaign matches short code "${shortCodeInput}".`);
        showToast('error', `Session code "${shortCodeInput}" is not recognized. Please check and try again.`, 'Code Not Found');
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

  // Location update from Geofence status (memoized to prevent render cascading)
  const handleLocationUpdate = useCallback(
    (coords: GeoLocationCoordinates, distanceMeters: number, within: boolean) => {
      setCurrentCoords(coords);
      setCurrentDistance(distanceMeters);
      setIsWithinGeofence(within);
    },
    []
  );

  const handleFaceCapture = useCallback((result: CompressionResult) => {
    setCapturedPhoto(result);
    showToast('success', 'Your photo has been captured successfully.', 'Photo Ready');
  }, []);

  // Submission handler with dual routing (Online vs. Offline .iwh)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaign) {
      showToast('error', 'No active attendance session found. Please reload or check your link.', 'Session Missing');
      return;
    }

    // Scheduling check
    if (sessionTimer.state !== 'active') {
      showToast(
        'error',
        sessionTimer.state === 'upcoming'
          ? 'This attendance session has not opened yet. Please wait for the start time.'
          : 'This attendance session has ended and is now closed.',
        'Session Closed'
      );
      return;
    }

    // 1. Name validation
    if (!name.trim() || name.trim().length < 2) {
      setNameError('Full name is required.');
      showToast('warning', 'Please enter your registered full name.', 'Name Needed');
      return;
    }

    // 2. State Code validation
    if (!isValidStateCode(stateCode)) {
      setStateCodeError('Invalid format. State Code must follow e.g. LA/23B/1234');
      showToast('warning', 'Please enter a valid State Code (e.g. LA/23B/1234).', 'Check State Code');
      return;
    }

    // 3. Member Geolocation constraint check
    if (!isCoordinatesValid(campaign.targetLatitude, campaign.targetLongitude)) {
      showToast(
        'error',
        'The coordinator has not configured meeting coordinates yet. Please ask your coordinator.',
        'Meeting Spot Not Set'
      );
      return;
    }

    if (
      !currentCoords ||
      typeof currentCoords.latitude !== 'number' ||
      typeof currentCoords.longitude !== 'number'
    ) {
      showToast(
        'error',
        'We need your current location to confirm attendance. Please allow location access.',
        'Location Needed'
      );
      return;
    }

    if (!isWithinGeofence || currentDistance === null || currentDistance > campaign.allowedRadius) {
      const distStr = currentDistance !== null ? formatDistance(currentDistance) : 'a short distance';
      showToast(
        'error',
        `You are currently ${distStr} away from the meeting place. Please walk closer (within ${campaign.allowedRadius}m) to sign attendance.`,
        'Location Check'
      );
      return;
    }

    // 4. Facial verification check
    if (!capturedPhoto) {
      showToast('warning', 'Please take your photo before submitting attendance.', 'Photo Needed');
      return;
    }

    setIsSubmitting(true);
    setSavingStage('biometrics');

    const isSystemOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const shouldSubmitOffline = forceOfflineMode || !isSystemOnline;

    const timestamp = new Date().toISOString();
    // Genuine member device coordinates (no placeholder fallbacks)
    const lat = currentCoords.latitude;
    const lng = currentCoords.longitude;
    const isTampered = isTamperingDetected();
    const cleanTimeBlock = timeBlockCode.trim().toUpperCase();

    // === OFFLINE ROUTING ===
    if (shouldSubmitOffline) {
      try {
        setSavingStage('auditing');
        await new Promise((r) => setTimeout(r, 100)); // allow UI tick

        setSavingStage('committing');
        // 1. Serialize and persist locally in PWA IndexedDB for automatic cloud synchronization
        const storedLocal = await serializeAndStoreAttendance({
          campaignId: campaign.id,
          orgId: campaign.orgId || organization?.id || '',
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          photoDataUrl: capturedPhoto.dataUrl,
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          loggedIp: 'Offline PWA Device',
          timestamp,
        });

        if (!storedLocal || !storedLocal.id) {
          throw new Error('IndexedDB storage failed to return valid persisted record ID.');
        }

        // 2. Also generate encrypted .iwh file for physical verification backup
        const offlineRecord: OfflineAttendanceRecord = {
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          timeBlockCode: cleanTimeBlock || undefined,
          campaignId: campaign.id,
          orgId: campaign.orgId || organization?.id || '',
          timestamp,
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          base64Image: capturedPhoto.dataUrl,
          version: '1.0',
          tampered: isTampered,
        };

        const encrypted = await encryptOfflineRecord(offlineRecord);
        const downloadedName = downloadIwhFile(encrypted);

        const syntheticAttendee: Attendee = {
          id: storedLocal.id,
          campaignId: campaign.id,
          orgId: campaign.orgId,
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          photoUrl: capturedPhoto.dataUrl,
          loggedIp: 'Offline IndexedDB Sync',
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          timestamp,
          verified: true,
          isOfflineSync: true,
          timeBlockCode: cleanTimeBlock || undefined,
          tampered: isTampered,
        };

        // Strictly trigger success UI only AFTER IndexedDB commit and .iwh generation succeed
        setIsOfflinePackage(true);
        setOfflineFilename(downloadedName);
        setCompletedAttendee(syntheticAttendee);
        showToast(
          'success',
          'Attendance saved on this device. It will automatically sync once you are back online.',
          'Saved Offline'
        );
      } catch (cryptoErr) {
        console.error('Offline storage/encryption error:', cryptoErr);
        setCompletedAttendee(null);
        showToast('error', 'Could not save attendance to this device. Please try again.', 'Save Failed');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // === ONLINE ROUTING ===
    try {
      setSavingStage('auditing');
      // 5. Uniqueness constraint check (Database check)
      const isAlreadyRegistered = await checkStateCodeRegisteredToday(
        campaign.id,
        stateCode,
        campaign.date
      );

      if (isAlreadyRegistered) {
        showToast(
          'error',
          `State Code ${stateCode} has already signed attendance for this session today!`,
          'Already Signed'
        );
        setIsSubmitting(false);
        return;
      }

      // 6. Fetch client IP address concurrently for audit
      const clientIp = await getClientIpAddress();

      setSavingStage('committing');

      // 7. Save to Firestore and Storage with tight timeouts
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
        timeBlockCode: cleanTimeBlock || undefined,
        tampered: isTampered,
      });

      if (!newAttendee || !newAttendee.id) {
        throw new Error('Firestore write failed to return confirmed attendee document.');
      }

      // Auto-generate and download .iwh encrypted backup alongside online submission
      try {
        const backupRecord: OfflineAttendanceRecord = {
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          timeBlockCode: cleanTimeBlock || undefined,
          campaignId: campaign.id,
          orgId: campaign.orgId || '',
          timestamp,
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          base64Image: capturedPhoto.dataUrl,
          version: '1.0',
          tampered: isTampered,
        };
        const encrypted = await encryptOfflineRecord(backupRecord);
        const downloadedName = downloadIwhFile(encrypted);
        setOfflineFilename(downloadedName);
      } catch (iwhErr) {
        console.warn('Optional automatic .iwh download notice:', iwhErr);
      }

      // Strictly trigger success UI only AFTER confirmed write
      setIsOfflinePackage(false);
      setCompletedAttendee(newAttendee);
      showToast('success', 'Attendance submitted successfully! A backup receipt has been downloaded.', 'Attendance Signed');
    } catch (err) {
      console.warn('Online submission failed, falling back to IndexedDB local serialization:', err);
      // Seamless auto-fallback to IndexedDB serialization and encrypted .iwh backup
      try {
        const storedLocal = await serializeAndStoreAttendance({
          campaignId: campaign.id,
          orgId: campaign.orgId || organization?.id || '',
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          photoDataUrl: capturedPhoto.dataUrl,
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          loggedIp: 'Offline Fallback',
          timestamp,
        });

        if (!storedLocal || !storedLocal.id) {
          throw new Error('IndexedDB fallback storage failed.');
        }

        const fallbackRecord: OfflineAttendanceRecord = {
          name: name.trim(),
          stateCode: stateCode.trim().toUpperCase(),
          timeBlockCode: cleanTimeBlock || undefined,
          campaignId: campaign.id,
          orgId: campaign.orgId || '',
          timestamp,
          latitude: lat,
          longitude: lng,
          distanceMeters: currentDistance,
          base64Image: capturedPhoto.dataUrl,
          version: '1.0',
          tampered: isTampered,
        };
        const encrypted = await encryptOfflineRecord(fallbackRecord);
        const downloadedName = downloadIwhFile(encrypted);

        const syntheticAttendee: Attendee = {
          id: storedLocal.id,
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
          timeBlockCode: cleanTimeBlock || undefined,
          tampered: isTampered,
        };

        // Strictly trigger success UI only AFTER fallback IndexedDB write succeeds
        setIsOfflinePackage(true);
        setOfflineFilename(downloadedName);
        setCompletedAttendee(syntheticAttendee);
        showToast(
          'info',
          'Internet connection was slow. Attendance saved on this device and backup receipt downloaded.',
          'Saved Offline'
        );
      } catch (fallbackErr) {
        console.error('Both Firestore and IndexedDB writes failed:', fallbackErr);
        setCompletedAttendee(null);
        showToast('error', 'Could not submit your attendance. Please check your internet connection and try again.', 'Submission Failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadIwhOnly = async () => {
    if (!name.trim()) {
      showToast('warning', 'Please enter your registered full name first.', 'Name Needed');
      return;
    }
    if (!isValidStateCode(stateCode)) {
      showToast('warning', 'Please enter a valid State Code (e.g. LA/24A/1234).', 'State Code Needed');
      return;
    }
    if (!capturedPhoto) {
      showToast('warning', 'Please take your photo before downloading.', 'Photo Needed');
      return;
    }
    if (
      !currentCoords ||
      typeof currentCoords.latitude !== 'number' ||
      typeof currentCoords.longitude !== 'number'
    ) {
      showToast(
        'error',
        'We need your current location to generate your offline attendance file.',
        'Location Needed'
      );
      return;
    }

    try {
      const isTampered = isTamperingDetected();
      const timestamp = new Date().toISOString();
      const lat = currentCoords.latitude;
      const lng = currentCoords.longitude;

      const offlineRecord: OfflineAttendanceRecord = {
        name: name.trim(),
        stateCode: stateCode.trim().toUpperCase(),
        timeBlockCode: timeBlockCode.trim().toUpperCase() || undefined,
        campaignId: campaign?.id || 'manual_session',
        orgId: campaign?.orgId || organization?.id || '',
        timestamp,
        latitude: lat,
        longitude: lng,
        distanceMeters: currentDistance || 0,
        base64Image: capturedPhoto.dataUrl,
        version: '1.0',
        tampered: isTampered,
      };

      const encrypted = await encryptOfflineRecord(offlineRecord);
      const downloadedName = downloadIwhFile(encrypted);
      showToast('success', `Your attendance backup file (${downloadedName}) has been downloaded!`, 'Receipt Saved');
    } catch (err) {
      console.error('Download error:', err);
      showToast('error', 'Could not create the backup file. Please try again.', 'Download Failed');
    }
  };

  const handleReset = () => {
    setCompletedAttendee(null);
    setIsOfflinePackage(false);
    setOfflineFilename('');
    setName('');
    setStateCode('');
    setTimeBlockCode('');
    setCapturedPhoto(null);
    setNameError('');
    setStateCodeError('');
  };

  const handleRedownloadIwhFromSuccess = async () => {
    if (!completedAttendee || !campaign) return;
    try {
      const offlineRecord: OfflineAttendanceRecord = {
        name: completedAttendee.name,
        stateCode: completedAttendee.stateCode,
        timeBlockCode: completedAttendee.timeBlockCode,
        campaignId: campaign.id,
        orgId: campaign.orgId || '',
        timestamp: completedAttendee.timestamp,
        latitude: completedAttendee.latitude,
        longitude: completedAttendee.longitude,
        distanceMeters: completedAttendee.distanceMeters,
        base64Image: completedAttendee.photoUrl,
        version: '1.0',
        tampered: completedAttendee.tampered,
      };
      const encrypted = await encryptOfflineRecord(offlineRecord);
      const downloadedName = downloadIwhFile(encrypted);
      showToast('success', `Your attendance backup file (${downloadedName}) has been downloaded!`, 'Receipt Saved');
    } catch (err) {
      console.error('Re-download error:', err);
      showToast('error', 'Could not create the backup file.', 'Download Failed');
    }
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
        durationSeconds={savingElapsedSeconds}
        onReset={handleReset}
        onRedownloadIwh={handleRedownloadIwhFromSuccess}
      />
    );
  }

  return (
    <div id="attendance-flow-container" className="w-full max-w-lg mx-auto p-4 sm:p-6 relative">
      {/* 15-Second High-Precision Save HUD Overlay */}
      {isSubmitting && (
        <div
          id="saving-progress-hud"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#0e131d] border border-[#232f44] p-6 shadow-2xl flex flex-col items-center text-center space-y-5">
            {/* Glowing Timer Ring */}
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-all shadow-[0_0_30px_rgba(0,255,102,0.25)]"
                style={{
                  borderColor: `${accentColor}40`,
                  borderTopColor: accentColor,
                  borderRightColor: accentColor,
                }}
              >
                <Timer className="w-6 h-6 text-white mb-0.5 animate-pulse" />
                <span className="text-base font-black font-mono text-white tracking-tight">
                  {savingElapsedSeconds.toFixed(1)}s
                </span>
              </div>
              <span className="absolute -bottom-2 inset-x-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#161f2e] border border-[#232f44] px-2 py-0.5 rounded-full mx-auto w-fit">
                Max 15s Target
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white">Saving Attendance</h3>
              <p className="text-xs text-slate-400">
                Verifying biometrics, geofence audit &amp; secure ledger
              </p>
            </div>

            {/* Live Step Progress Checklist */}
            <div className="w-full space-y-2 text-left bg-[#131924] p-3.5 rounded-2xl border border-[#1e2738]">
              <div className="flex items-center space-x-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-[#00FF66] shrink-0" />
                <span className="text-slate-200 font-medium">Biometric hash &amp; portrait compression</span>
              </div>

              <div className="flex items-center space-x-2.5 text-xs">
                {savingStage === 'biometrics' ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#00FF66] shrink-0" />
                )}
                <span className={savingStage === 'biometrics' ? 'text-amber-300 font-bold' : 'text-slate-200 font-medium'}>
                  GPS geofence &amp; tamper clearance
                </span>
              </div>

              <div className="flex items-center space-x-2.5 text-xs">
                {savingStage === 'committing' ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                )}
                <span className={savingStage === 'committing' ? 'text-[#00FF66] font-bold animate-pulse' : 'text-slate-400'}>
                  {forceOfflineMode ? 'IndexedDB offline packaging (.iwh)' : 'Real-time cloud database commit'}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#1b2332] h-2 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-200 ease-out rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(15, (savingElapsedSeconds / 15) * 100))}%`,
                  backgroundColor: accentColor,
                  boxShadow: `0 0 10px ${accentColor}`,
                }}
              />
            </div>

            <div className="flex items-center justify-between w-full text-[10px] text-slate-400 font-mono">
              <span>Elapsed: {savingElapsedSeconds.toFixed(1)}s</span>
              <span className="text-emerald-400 font-bold">Guaranteed &lt; 15s</span>
            </div>
          </div>
        </div>
      )}

      {onBackToHome && (
        <button
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-3 cursor-pointer py-1 px-2 rounded-lg hover:bg-[#141b26]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </button>
      )}

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
        sessionTimer.state === 'upcoming' ? (
          <SessionTimer
            campaign={campaign}
            organization={organization}
            onBackToHome={onBackToHome}
            variant="full"
          />
        ) : sessionTimer.state === 'expired' ? (
          <SessionTimer
            campaign={campaign}
            organization={organization}
            onBackToHome={onBackToHome}
            variant="full"
          />
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Active Schedule Session Indicator */}
          <div className="flex items-center justify-between">
            <SessionTimer campaign={campaign} variant="active-indicator" />
          </div>

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
                    {formatWATDate(campaign.date, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <h2 className="text-sm font-extrabold text-white truncate">{campaign.name}</h2>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Radius</span>
                  <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>
                    {campaign.allowedRadius}m Max
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="px-2 py-0.5 rounded-lg bg-[#182333] hover:bg-[#202e44] text-slate-200 border border-[#27384f] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Scan another session QR code"
                >
                  <QrCode className="w-3 h-3 text-[#00FF66]" />
                  <span>Scan QR</span>
                </button>
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
              label="State Code / Member ID"
              value={stateCode}
              onChange={handleStateCodeChange}
              error={stateCodeError}
              hint="Official membership or call-up ID"
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

            {/* Time-Block Selection (Dropdown Menu of Available Blocks provided by Admin) */}
            {availableTimeBlocks.length > 0 ? (
              <div className="relative w-full mb-3">
                <div
                  className={`relative w-full rounded-xl border transition-all duration-200 bg-[#0e1219] ${
                    isFocusedTimeBlock
                      ? 'border-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.2)]'
                      : timeBlockCode
                      ? 'border-[#2d3748]'
                      : 'border-[#222a38] hover:border-slate-700'
                  }`}
                  style={{
                    borderColor: isFocusedTimeBlock ? accentColor : timeBlockCode ? `${accentColor}99` : undefined,
                  }}
                >
                  <label
                    htmlFor="select-time-block"
                    className="absolute left-4 top-2 text-[10px] font-bold tracking-wider uppercase text-slate-400 pointer-events-none flex items-center gap-1.5"
                  >
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Time Block</span>
                  </label>
                  <select
                    id="select-time-block"
                    value={timeBlockCode}
                    onChange={(e) => setTimeBlockCode(e.target.value)}
                    onFocus={() => setIsFocusedTimeBlock(true)}
                    onBlur={() => setIsFocusedTimeBlock(false)}
                    className="w-full pt-6 pb-2.5 px-4 text-sm text-[#f0f3f6] bg-transparent outline-none cursor-pointer appearance-none pr-10 font-mono font-semibold"
                  >
                    <option value="" className="bg-[#0e1219] text-slate-400 font-sans">
                      -- Select Available Time Block --
                    </option>
                    {availableTimeBlocks.map((block) => {
                      const active = isBlockActive(block);
                      return (
                        <option
                          key={block.code}
                          value={block.code}
                          className="bg-[#0e1219] text-white py-1.5 font-sans"
                        >
                          {block.code}: {block.label || 'Session Window'} ({block.startTime} – {block.endTime} WAT){active ? ' ★ Active Now' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {selectedBlock ? (
                  <div className="mt-1.5 p-2.5 rounded-xl bg-[#121722] border border-[#1e2738] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: isBlockActive(selectedBlock) ? '#00FF66' : '#94A3B8',
                        }}
                      />
                      <span className="text-white font-semibold">{selectedBlock.label || selectedBlock.code}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        ({selectedBlock.startTime} – {selectedBlock.endTime} WAT)
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono ${
                        isBlockActive(selectedBlock)
                          ? 'bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isBlockActive(selectedBlock) ? 'Active Window' : 'Scheduled'}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1 pl-1">
                    Select from the {availableTimeBlocks.length} time block{availableTimeBlocks.length > 1 ? 's' : ''} provided by the coordinator
                  </p>
                )}
              </div>
            ) : (
              <FloatingInput
                id="input-time-block-code"
                label="Time-Block Code (Optional)"
                value={timeBlockCode}
                onChange={(e) => setTimeBlockCode(e.target.value.toUpperCase())}
                hint="No specific time blocks set by coordinator (optional)"
                isMono
                maxLength={6}
                autoComplete="off"
              />
            )}
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
                GPS Presence Verification & Navigation
              </h3>
            </div>

            <GeofenceStatus
              campaign={campaign}
              accentColor={accentColor}
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
              onCapture={handleFaceCapture}
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

            {/* Standalone Download .iwh Button */}
            {!forceOfflineMode && (
              <button
                id="btn-download-iwh-standalone"
                type="button"
                onClick={handleDownloadIwhOnly}
                disabled={!name.trim() || !isValidStateCode(stateCode) || !capturedPhoto}
                className={`w-full mt-2.5 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  name.trim() && isValidStateCode(stateCode) && capturedPhoto
                    ? 'bg-[#141c28] text-slate-200 border border-[#2b3a50] hover:bg-[#1a2536] hover:border-emerald-500/50 hover:text-white'
                    : 'bg-[#0f141e] text-slate-600 border border-[#1a2230] cursor-not-allowed'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Download Verified Attendance (.iwh File)</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

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
                  ✓ Offline Mode: Generates an AES-256 encrypted file for zero-data submission to your Coordinator.
                </p>
              ) : (
                <p className="text-[11px] font-medium" style={{ color: accentColor }}>
                  ✓ Submitting CDS Attendance automatically logs to cloud and downloads your verified <code className="font-mono bg-black/40 px-1 py-0.5 rounded">.iwh</code> backup.
                </p>
              )}
            </div>
          </div>
        </form>
        )
      ) : (
        /* Campaign Not Found / Manual Short Code Lookup Form */
        <div id="manual-campaign-lookup" className="rounded-2xl bg-[#0e121a] border border-[#1e273a] p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
            <QrCode className="w-6 h-6 text-[#00FF66]" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Scan or Enter Session Code</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-5 leading-relaxed">
            {campaignError || 'Scan the projected QR code or enter the session code displayed by your Coordinator.'}
          </p>

          {/* Primary Quick Action: Scan QR Code */}
          <div className="max-w-xs mx-auto mb-4">
            <button
              id="btn-scan-session-qr"
              type="button"
              onClick={() => setIsQRScannerOpen(true)}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 text-[#0a0c10] shadow-[0_0_20px_rgba(0,255,102,0.3)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <QrCode className="w-4 h-4 text-black" />
              <span>Scan Session QR Code</span>
            </button>

            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1e2738]" />
              </div>
              <span className="relative bg-[#0e121a] px-3 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Or enter session code
              </span>
            </div>
          </div>

          <form onSubmit={handleResolveManualShortCode} className="max-w-xs mx-auto space-y-3">
            <div className="relative">
              <input
                id="input-manual-short-code"
                type="text"
                value={shortCodeInput}
                onChange={(e) => setShortCodeInput(e.target.value.toLowerCase())}
                placeholder="Enter Session Code"
                maxLength={6}
                className="w-full py-3 px-4 rounded-xl bg-[#141a24] border border-[#232f42] text-center font-mono text-base font-bold uppercase tracking-widest text-[#00FF66] outline-none focus:border-[#00FF66] focus:shadow-[0_0_15px_rgba(0,255,102,0.2)]"
              />
            </div>

            <button
              id="btn-resolve-code"
              type="submit"
              disabled={resolvingCode || shortCodeInput.trim().length < 3}
              className="w-full py-3 px-4 rounded-xl bg-[#182333] hover:bg-[#202e44] border border-[#27384f] text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {resolvingCode ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#00FF66]" />
              ) : (
                <ArrowRight className="w-4 h-4 text-[#00FF66]" />
              )}
              <span>Start Attendance Check-In</span>
            </button>
            <button
              id="btn-direct-active-session"
              type="button"
              onClick={async () => {
                const camp = await getOrCreateDefaultActiveCampaign();
                setCampaign(camp);
              }}
              className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span>Go straight to active session &rarr;</span>
            </button>
          </form>
        </div>
      )}

      {/* QR Code Scanner Viewfinder Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanSuccess={handleCodeDetected}
        accentColor={accentColor}
      />
    </div>
  );
}
