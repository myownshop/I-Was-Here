import { X, ShieldCheck, MapPin, Globe, Calendar, User, Download } from 'lucide-react';
import { Attendee } from '../../types/attendance';
import { formatDistance } from '../../utils/geo';
import { formatWATDateTime } from '../../utils/dateUtils';

interface PhotoAuditModalProps {
  attendee: Attendee | null;
  onClose: () => void;
}

export function PhotoAuditModal({ attendee, onClose }: PhotoAuditModalProps) {
  if (!attendee) return null;

  return (
    <div
      id="photo-audit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0e131d] border border-[#212c3e] rounded-3xl max-w-md w-full p-5 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2838] mb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#00FF66]" />
            <h3 className="text-sm font-extrabold text-white">Biometric Facial Audit</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2331]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Large Image Preview */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden border-2 border-[#00FF66] shadow-[0_0_25px_rgba(0,255,102,0.2)] mb-4 bg-black">
          <img
            src={attendee.photoUrl}
            alt={attendee.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-[#00FF66] text-[#0a0c10] text-[10px] font-extrabold flex items-center space-x-1 shadow-md">
            <span>BIOMETRIC PASS</span>
          </div>
        </div>

        {/* Corps Member Info */}
        <div className="space-y-2.5 text-xs bg-[#090c12] rounded-xl p-3.5 border border-[#1b2332] mb-4">
          <div className="flex justify-between items-center text-white">
            <span className="text-slate-400">Corps Member:</span>
            <span className="font-bold">{attendee.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">State Code:</span>
            <span className="font-mono text-xs font-bold text-[#00FF66] bg-[#00FF66]/10 px-2 py-0.5 rounded border border-[#00FF66]/20">
              {attendee.stateCode}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Proximity to Venue:</span>
            <span className="font-mono text-[#00FF66] font-semibold">
              {formatDistance(attendee.distanceMeters)}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Timestamp (WAT):</span>
            <span className="font-mono text-[11px] font-semibold text-slate-200">
              {formatWATDateTime(attendee.timestamp, { includeSeconds: true, includeTimezone: true })}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Logged IP:</span>
            <span className="font-mono text-slate-400">{attendee.loggedIp}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={attendee.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={`${attendee.stateCode.replace(/\//g, '_')}_face.jpg`}
            className="flex-1 py-2.5 rounded-xl bg-[#141c28] hover:bg-[#1a2536] text-white border border-[#263449] text-xs font-bold flex items-center justify-center space-x-2"
          >
            <Download className="w-3.5 h-3.5 text-[#00FF66]" />
            <span>Download Photo</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#00FF66] text-[#0a0c10] text-xs font-extrabold flex items-center justify-center space-x-2 shadow-[0_0_12px_rgba(0,255,102,0.25)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
