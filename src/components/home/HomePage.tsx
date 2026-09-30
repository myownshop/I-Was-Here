import { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Camera,
  WifiOff,
  Building2,
  Lock,
  ArrowRight,
  Sparkles,
  QrCode,
  Smartphone,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { Organization, OrganizationType, UserProfile } from '../../types/attendance';
import {
  AUDIENCE_SEGMENTS,
  DEFAULT_SEGMENT_ID,
  getSegmentById,
} from '../../config/audienceSegments';

interface HomePageProps {
  organization: Organization | null;
  currentUserProfile: UserProfile | null;
  initialSegmentId?: OrganizationType;
  onNavigateToAuth: () => void;
  onNavigateToPortal: () => void;
  onNavigateToAttend: (code?: string) => void;
  onSignOut?: () => void;
}

export function HomePage({
  organization,
  currentUserProfile,
  initialSegmentId = DEFAULT_SEGMENT_ID,
  onNavigateToAuth,
  onNavigateToPortal,
  onNavigateToAttend,
  onSignOut,
}: HomePageProps) {
  const [manualCode, setManualCode] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<OrganizationType>(initialSegmentId);

  // Synchronize when initialSegmentId changes (e.g. from hash deep link #/for/[segmentId])
  useEffect(() => {
    if (initialSegmentId) {
      setSelectedSegmentId(initialSegmentId);
    }
  }, [initialSegmentId]);

  const selectedSegment = useMemo(() => getSegmentById(selectedSegmentId), [selectedSegmentId]);

  // Dynamic theme accent color shifts together with the selected audience segment
  const activeColor = organization?.accentColor || selectedSegment.accentColor;

  const handleSelectSegment = (segmentId: OrganizationType) => {
    setSelectedSegmentId(segmentId);
    // Update the hash to #/for/[segmentId] seamlessly so visitors can bookmark/share without a page reload
    if (typeof window !== 'undefined') {
      if (window.location.hash.startsWith('#/for/') || window.location.hash === '' || window.location.hash === '#/') {
        window.history.replaceState(null, '', `#/for/${segmentId}`);
      }
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onNavigateToAttend(manualCode.trim());
    } else {
      onNavigateToAttend();
    }
  };

  return (
    <div id="home-landing-page" className="w-full max-w-6xl mx-auto px-4 py-4 sm:py-8 space-y-12">
      {/* Hero Section */}
      <section className="relative text-center py-8 sm:py-14 px-4 rounded-3xl bg-gradient-to-b from-[#0e141f] to-[#0a0c10] border border-[#1b2332] overflow-hidden shadow-2xl transition-all duration-300">
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-500"
          style={{ backgroundColor: activeColor }}
        />

        <div className="relative max-w-3xl mx-auto space-y-5">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border bg-[#121824] border-[#222d3f] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 transition-colors duration-300" style={{ color: activeColor }} />
            <span className="text-slate-300">Location-Verified &amp; Anti-Proxy Attendance SaaS</span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-300"
              style={{
                backgroundColor: `${activeColor}20`,
                color: activeColor,
              }}
            >
              PWA Ready
            </span>
          </div>

          {/* Generic, audience-agnostic Job-to-be-Done headline */}
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Verify Physical Presence.{' '}
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r transition-all duration-500"
              style={{
                backgroundImage: `linear-gradient(to right, ${activeColor}, #ffffff)`,
              }}
            >
              Eliminate Proxy Signing.
            </span>
          </h1>

          {/* Generic, audience-agnostic value proposition */}
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Engineered for high-trust roll calls, field operations, and verified gathering attendance.
            Combines sub-100m geofencing, facial liveness verification, and zero-connectivity
            AES-256 encrypted attendance packaging.
          </p>

          {/* Audience Segment Switcher Pill Buttons (No scrollbar, wraps neatly on mobile) */}
          <div className="pt-2 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Explore tailored workflows for your organization
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-1 px-1 max-w-full no-scrollbar">
              {AUDIENCE_SEGMENTS.map((segment) => {
                const isSelected = segment.id === selectedSegment.id;
                return (
                  <button
                    key={segment.id}
                    type="button"
                    onClick={() => handleSelectSegment(segment.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 cursor-pointer border shrink-0 ${
                      isSelected
                        ? 'shadow-lg scale-105'
                        : 'bg-[#121824] border-[#1e2738] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${segment.accentColor}25`,
                            borderColor: segment.accentColor,
                            color: segment.accentColor,
                            boxShadow: `0 0 16px ${segment.accentColor}30`,
                          }
                        : undefined
                    }
                  >
                    {segment.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Tailored Proof Line for Selected Segment */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#121825]/90 border text-xs sm:text-sm text-slate-200 shadow-md max-w-xl mx-auto transition-all duration-300"
            style={{ borderColor: `${activeColor}40` }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 transition-colors duration-300" style={{ color: activeColor }} />
            <span className="font-semibold text-slate-100">{selectedSegment.headlineProof}</span>
          </div>

          {/* Dynamic Auth & CTA Section */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentUserProfile ? (
              // Authenticated user controls
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="btn-home-open-portal"
                  type="button"
                  onClick={onNavigateToPortal}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm text-[#0a0c10] shadow-lg flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  style={{ backgroundColor: activeColor }}
                >
                  <Building2 className="w-4 h-4 text-black" />
                  <span>Open {organization?.name || 'Dashboard'}</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>

                {onSignOut && (
                  <button
                    id="btn-home-sign-out"
                    type="button"
                    onClick={onSignOut}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-semibold text-sm text-slate-300 hover:text-white bg-[#141b27] hover:bg-[#1c2637] border border-[#243144] flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-slate-400" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            ) : (
              // Unauthenticated options
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="btn-home-sign-in"
                  type="button"
                  onClick={onNavigateToAuth}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm text-[#0a0c10] shadow-lg flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  style={{ backgroundColor: activeColor }}
                >
                  <Building2 className="w-4 h-4 text-black" />
                  <span>Sign In / Register Organization</span>
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
              </div>
            )}
          </div>

          {/* Logged in status banner */}
          {currentUserProfile && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Active Session: <strong>{currentUserProfile.name}</strong> •{' '}
                {organization?.name || 'Coordinator'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Attend via QR or Code Section */}
      <section
        id="section-attend-access"
        className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 shadow-xl"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <QrCode className="w-4 h-4" style={{ color: activeColor }} />
              <span>Attendee Roll Call</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Mark Attendance via QR Code or Session Link
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Scan the session QR code with your mobile camera, or enter the alphanumeric session code below to open the physical verification viewfinder.
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2.5 shrink-0 items-stretch sm:items-center">
            <button
              id="btn-home-scan-qr"
              type="button"
              onClick={() => onNavigateToAttend()}
              className="px-4 py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#162030] hover:bg-[#1e2c42] text-white border border-[#2b3a52] flex items-center justify-center space-x-2 cursor-pointer transition-all shadow-sm"
              title="Open QR scanner to scan session code"
            >
              <QrCode className="w-4 h-4 text-[#00FF66]" />
              <span>Scan QR Code</span>
            </button>
            <form onSubmit={handleCodeSubmit} className="flex flex-col sm:flex-row gap-2.5 flex-1">
              <div className="relative flex-1">
                <input
                  id="input-home-shortcode"
                  type="text"
                  placeholder="Enter Session Code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full sm:w-52 bg-[#090c12] border border-[#263142] text-white text-xs sm:text-sm rounded-xl px-3.5 py-3 outline-none focus:border-[#00FF66] placeholder:text-slate-500 font-mono uppercase"
                />
              </div>
              <button
                id="btn-home-attend-submit"
                type="submit"
                className="px-5 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#0a0c10] flex items-center justify-center space-x-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(0,255,102,0.25)] hover:brightness-105"
                style={{ backgroundColor: activeColor }}
              >
                <span>Go to Attendance</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid - Generic and Audience Agnostic */}
      <section className="space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Engineered for High-Trust Attendance
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Hardened architectural pillars ensuring zero proxy attendance even in remote conditions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Feature 1: Geofencing */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${activeColor}15`,
                color: activeColor,
              }}
            >
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Sub-100m Physical Geofencing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calculates precise high-accuracy GPS coordinates using the Haversine formula. If the
              attendee is outside the coordinator’s designated boundary, submission is locked.
            </p>
          </div>

          {/* Feature 2: Facial Liveness */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${activeColor}15`,
                color: activeColor,
              }}
            >
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Live Facial Verification</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time front camera capture with instantaneous audit preview. Eliminates buddy-signing
              and sharing device credentials with absent members.
            </p>
          </div>

          {/* Feature 3: Offline AES-256 .iwh */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${activeColor}15`,
                color: activeColor,
              }}
            >
              <WifiOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Encrypted Offline Sync (.iwh)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When network reception is completely dead, attendance is packaged into a cryptographically
              signed, AES-GCM 256-bit encrypted file for batch import by the coordinator.
            </p>
          </div>

          {/* Feature 4: Multi-Tenant Isolation */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${activeColor}15`,
                color: activeColor,
              }}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Tenant-Isolated Organization Portals</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every organization or branch manages their own isolated campaigns, custom brand
              colors, and verified rosters with zero cross-tenant data leaks.
            </p>
          </div>

          {/* Feature 5: Progressive Web App */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${activeColor}15`,
                color: activeColor,
              }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Full PWA Offline Support</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Installable to Android and iOS home screens with zero app store friction. Pre-caches
              service worker assets so the app launches instantly in dead-zones.
            </p>
          </div>

          {/* Feature 6: Cryptographic Verification */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${activeColor}15`,
                color: activeColor,
              }}
            >
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Audit &amp; Tamper Proofing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every submission records verified timestamp, distance in meters, and facial frame data.
              Coordinators can inspect and export full roll calls with one click.
            </p>
          </div>
        </div>
      </section>

      {/* Dynamic Workflow for Selected Segment */}
      <section className="bg-[#0c1018] border border-[#192230] rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Operational Workflow • {selectedSegment.label}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            How Attendance Works for {selectedSegment.label}
          </h2>
          <p className="text-xs text-slate-400">
            Tailored check-in flow designed for {selectedSegment.label.toLowerCase()} environments.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {selectedSegment.exampleSteps.map((stepText, idx) => (
            <div key={idx} className="space-y-2">
              <div
                className="w-8 h-8 rounded-lg bg-[#141b26] border flex items-center justify-center text-xs font-mono font-bold transition-colors duration-300"
                style={{ color: activeColor, borderColor: `${activeColor}40` }}
              >
                0{idx + 1}
              </div>
              <h4 className="text-sm font-semibold text-white">
                Step 0{idx + 1}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {stepText}
              </p>
            </div>
          ))}
        </div>

        {/* Segment-specific scenario image container with wired exampleImageAlt */}
        <div className="mt-4 pt-4 border-t border-[#192230] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <Sparkles className="w-3.5 h-3.5 shrink-0 transition-colors duration-300" style={{ color: activeColor }} />
            <span>
              Scenario Preview: <strong className="text-white">{selectedSegment.label}</strong>
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 italic" title={selectedSegment.exampleImageAlt}>
            "{selectedSegment.exampleImageAlt}"
          </p>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
