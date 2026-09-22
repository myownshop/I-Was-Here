import { useState } from 'react';
import {
  ShieldCheck,
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
  ExternalLink,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Organization, UserProfile } from '../../types/attendance';

interface HomePageProps {
  organization: Organization | null;
  currentUserProfile: UserProfile | null;
  onNavigateToAuth: () => void;
  onNavigateToPortal: () => void;
  onNavigateToAttend: (code?: string) => void;
  onSignOut?: () => void;
}

export function HomePage({
  organization,
  currentUserProfile,
  onNavigateToAuth,
  onNavigateToPortal,
  onNavigateToAttend,
  onSignOut,
}: HomePageProps) {
  const [manualCode, setManualCode] = useState('');
  const accentColor = organization?.accentColor || '#00FF66';

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
      <section className="relative text-center py-8 sm:py-14 px-4 rounded-3xl bg-gradient-to-b from-[#0e141f] to-[#0a0c10] border border-[#1b2332] overflow-hidden shadow-2xl">
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />

        <div className="relative max-w-3xl mx-auto space-y-5">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border bg-[#121824] border-[#222d3f] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="text-slate-300">Location-Verified & Anti-Proxy Attendance SaaS</span>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              }}
            >
              PWA Ready
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Verify Physical Presence.{' '}
            <span
              className="bg-clip-text text-transparent bg-gradient-to-r"
              style={{
                backgroundImage: `linear-gradient(to right, ${accentColor}, #ffffff)`,
              }}
            >
              Eliminate Proxy Signing.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Engineered for NYSC CDS meetings, community outreach, and remote fieldwork.
            Combines sub-100m geofencing, facial liveness verification, and zero-connectivity
            AES-256 encrypted attendance packaging.
          </p>

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
                  style={{ backgroundColor: accentColor }}
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
              // Unauthenticated options - NO preview/demo buttons
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="btn-home-sign-in"
                  type="button"
                  onClick={onNavigateToAuth}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm text-[#0a0c10] shadow-lg flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
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
              <QrCode className="w-4 h-4" style={{ color: accentColor }} />
              <span>Attendee Roll Call</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Mark Attendance via QR Code or Session Link
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Scan the session QR code with your mobile camera, or enter the alphanumeric session code below to open the physical verification viewfinder.
            </p>
          </div>

          <form onSubmit={handleCodeSubmit} className="w-full md:w-auto flex flex-col sm:flex-row gap-2.5 shrink-0">
            <div className="relative">
              <input
                id="input-home-shortcode"
                type="text"
                placeholder="Enter Session Code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full sm:w-56 bg-[#090c12] border border-[#263142] text-white text-xs sm:text-sm rounded-xl px-3.5 py-3 outline-none focus:border-[#00FF66] placeholder:text-slate-500 font-mono uppercase"
              />
            </div>
            <button
              id="btn-home-attend-submit"
              type="submit"
              className="px-5 py-3 rounded-xl font-bold text-xs sm:text-sm text-[#0a0c10] flex items-center justify-center space-x-2 cursor-pointer transition-all"
              style={{ backgroundColor: accentColor }}
            >
              <span>Go to Attendance</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </form>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Engineered for High-Trust Attendance
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Five hardened architectural pillars ensuring zero proxy attendance even in remote conditions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Feature 1: Geofencing */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
              }}
            >
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Sub-100m Physical Geofencing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calculates precise high-accuracy GPS coordinates using the Haversine formula. If the
              corps member is outside the coordinator’s designated boundary, submission is locked.
            </p>
          </div>

          {/* Feature 2: Facial Liveness */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
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
                backgroundColor: `${accentColor}15`,
                color: accentColor,
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
                backgroundColor: `${accentColor}15`,
                color: accentColor,
              }}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Tenant-Isolated CDS Portals</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every CDS group or organizational branch manages their own isolated campaigns, custom brand
              colors, and verified rosters with zero cross-tenant data leaks.
            </p>
          </div>

          {/* Feature 5: Progressive Web App */}
          <div className="bg-[#0e131d] border border-[#1e2636] rounded-2xl p-5 sm:p-6 space-y-3.5 hover:border-slate-600 transition-colors">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
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
                backgroundColor: `${accentColor}15`,
                color: accentColor,
              }}
            >
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Audit & Tamper Proofing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every submission records verified timestamp, distance in meters, and facial frame data.
              Coordinators can inspect and export full roll-calls with one click.
            </p>
          </div>
        </div>
      </section>

      {/* How it works for CDS Roll Call */}
      <section className="bg-[#0c1018] border border-[#192230] rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Operational Workflow
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            How Attendance Works on CDS Day
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#141b26] border border-[#243042] flex items-center justify-center text-xs font-mono font-bold text-white">
              01
            </div>
            <h4 className="text-sm font-semibold text-white">Coordinator Displays QR</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              The CDS President or Coordinator opens their dashboard and projects or displays the active
              session QR code with an enforced radius (e.g. 100 meters).
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#141b26] border border-[#243042] flex items-center justify-center text-xs font-mono font-bold text-white">
              02
            </div>
            <h4 className="text-sm font-semibold text-white">Corps Member Scans & Verifies</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Attendees scan the code, allow camera and GPS, capture their live selfie, and input their NYSC
              State Code (e.g. LA/23B/1234).
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#141b26] border border-[#243042] flex items-center justify-center text-xs font-mono font-bold text-white">
              03
            </div>
            <h4 className="text-sm font-semibold text-white">Instant Validation & Cloud Sync</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              If online, records appear immediately on the coordinator’s dashboard. If offline, the encrypted
              .iwh package is transferred and verified on the coordinator’s device.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
