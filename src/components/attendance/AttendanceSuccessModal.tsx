import { ShieldCheck, CheckCircle2, Download, RefreshCw, Calendar, MapPin, Hash, Building2, Send, Lock, Zap } from 'lucide-react';
import { Attendee, Campaign } from '../../types/attendance';
import { formatDistance } from '../../utils/geo';

interface AttendanceSuccessModalProps {
  attendee: Attendee;
  campaign: Campaign;
  organizationName?: string;
  accentColor?: string;
  isOfflinePackage?: boolean;
  offlineFilename?: string;
  durationSeconds?: number;
  onReset: () => void;
  onRedownloadIwh?: () => void;
}

export function AttendanceSuccessModal({
  attendee,
  campaign,
  organizationName,
  accentColor = '#00FF66',
  isOfflinePackage = false,
  offlineFilename,
  durationSeconds,
  onReset,
  onRedownloadIwh,
}: AttendanceSuccessModalProps) {
  const formattedDate = new Date(attendee.timestamp).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = new Date(attendee.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const handlePrintOrShare = () => {
    window.print();
  };

  return (
    <div
      id="attendance-success-screen"
      className="w-full max-w-md mx-auto p-4 sm:p-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Top glowing success badge */}
      <div className="relative mb-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center border-2 shadow-2xl transition-all"
          style={{
            backgroundColor: `${accentColor}20`,
            borderColor: accentColor,
            color: accentColor,
            boxShadow: `0 0 30px ${accentColor}40`,
          }}
        >
          {isOfflinePackage ? (
            <Lock className="w-10 h-10" />
          ) : (
            <CheckCircle2 className="w-10 h-10" />
          )}
        </div>
        <div
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full text-[#0a0c10] flex items-center justify-center font-black text-xs shadow-md"
          style={{ backgroundColor: accentColor }}
        >
          ✓
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
        <span
          className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
          style={{
            backgroundColor: `${accentColor}15`,
            borderColor: `${accentColor}40`,
            color: accentColor,
          }}
        >
          {isOfflinePackage ? 'OFFLINE AES-256 CLEARANCE' : 'OFFICIAL CLEARANCE'}
        </span>

        {durationSeconds !== undefined && durationSeconds > 0 && (
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Saved in {durationSeconds.toFixed(1)}s</span>
          </span>
        )}
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-white text-center tracking-tight mb-1">
        {isOfflinePackage ? 'Encrypted Package Generated!' : 'Attendance Confirmed!'}
      </h2>

      <p className="text-xs text-slate-300 text-center mb-6 max-w-xs leading-relaxed">
        {isOfflinePackage ? (
          <>
            Saved encrypted package <strong className="text-white font-mono">{offlineFilename}</strong>. Please deliver this file to your Admin to log your attendance.
          </>
        ) : (
          'Your physical presence and biometric facial signature have been verified and saved to the cloud.'
        )}
      </p>

      {/* Offline Transfer & Auto-Sync Guide Box */}
      {isOfflinePackage && (
        <div className="w-full mb-5 p-4 rounded-2xl bg-[#141b26] border border-amber-500/40 text-xs space-y-3 shadow-lg">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <Send className="w-4 h-4 shrink-0" />
            <span>Dual Offline Reliability Guarantee:</span>
          </div>

          <div className="space-y-2 text-slate-300 text-[11px] leading-relaxed">
            <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200">
              <strong className="text-white block mb-0.5">1. PWA IndexedDB Auto-Sync (Active)</strong>
              Your biometric roll call is stored securely in this browser&apos;s local IndexedDB. It will automatically upload to Firebase the moment your device reconnects to the internet.
            </div>

            <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-slate-300">
              <strong className="text-amber-200 block mb-0.5">2. Manual Coordinator Delivery (.iwh backup)</strong>
              We also downloaded <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">{offlineFilename}</code>. You can send this encrypted file to your coordinator via WhatsApp or Bluetooth for instant verification in the Admin Importer.
            </div>
          </div>
        </div>
      )}

      {/* Digital Clearance Certificate Card */}
      <div
        id="digital-clearance-card"
        className="w-full rounded-2xl bg-gradient-to-b from-[#111722] to-[#0d121b] border-2 p-5 relative overflow-hidden shadow-2xl"
        style={{
          borderColor: `${accentColor}40`,
        }}
      >
        {/* Organization Name Header */}
        <div className="flex items-center justify-between border-b border-[#202b3d] pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-white tracking-wider uppercase">
              {organizationName || 'NYSC CDS'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            ID: {attendee.id.substring(0, 12)}
          </span>
        </div>

        {/* Member Profile Snapshot */}
        <div className="flex items-center space-x-4 mb-4">
          <div
            className="relative w-16 h-16 rounded-xl overflow-hidden border shrink-0"
            style={{ borderColor: accentColor }}
          >
            <img
              src={attendee.photoUrl}
              alt={attendee.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold text-white truncate">{attendee.name}</h3>
            <div
              className="inline-block mt-0.5 px-2 py-0.5 rounded font-mono text-xs font-bold border"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
                color: accentColor,
              }}
            >
              {attendee.stateCode}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">{campaign.name}</p>
          </div>
        </div>

        {/* Detailed Verification Metadata */}
        <div className="space-y-2.5 text-xs bg-[#0b0e14] rounded-xl p-3 border border-[#1b2332]">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Date & Time:
            </span>
            <span className="font-semibold text-right">
              {formattedDate} • {formattedTime}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <MapPin className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Geofence Proximity:
            </span>
            <span className="font-mono font-bold" style={{ color: accentColor }}>
              {formatDistance(attendee.distanceMeters)} from venue
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              Submission Mode:
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {isOfflinePackage ? 'AES-GCM Encrypted (.iwh)' : 'Real-time Cloud Sync'}
            </span>
          </div>
        </div>

        {/* Official Verification Seal */}
        <div className="mt-4 pt-3 border-t border-[#1e2738] flex items-center justify-between">
          <span className="text-[10px] text-slate-400 font-mono uppercase">
            STATUS: {isOfflinePackage ? 'OFFLINE SECURED' : 'BIOMETRICALLY VERIFIED'}
          </span>
          <div className="flex items-center space-x-1 text-[10px] font-bold" style={{ color: accentColor }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AUTHENTICATED</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col sm:flex-row gap-3 mt-6">
        {isOfflinePackage && onRedownloadIwh ? (
          <button
            id="btn-redownload-iwh"
            type="button"
            onClick={onRedownloadIwh}
            className="flex-1 py-3 px-4 rounded-xl bg-[#17202d] hover:bg-[#1e293a] text-white border border-[#2b3950] text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Re-download .iwh</span>
          </button>
        ) : (
          <button
            id="btn-save-slip"
            type="button"
            onClick={handlePrintOrShare}
            className="flex-1 py-3 px-4 rounded-xl bg-[#17202d] hover:bg-[#1e293a] text-white border border-[#2b3950] text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" style={{ color: accentColor }} />
            <span>Save / Print Clearance</span>
          </button>
        )}

        <button
          id="btn-submit-another"
          type="button"
          onClick={onReset}
          className="flex-1 py-3 px-4 rounded-xl text-[#0a0c10] text-xs font-extrabold flex items-center justify-center space-x-2 transition-all shadow-md active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          <RefreshCw className="w-4 h-4 text-black" />
          <span className="text-black">New Attendance</span>
        </button>
      </div>
    </div>
  );
}
