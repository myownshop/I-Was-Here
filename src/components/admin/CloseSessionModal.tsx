import { Lock, AlertTriangle, Users, Calendar, QrCode } from 'lucide-react';
import { Campaign } from '../../types/attendance';

interface CloseSessionModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  attendeeCount: number;
  onClose: () => void;
  onConfirmClose: () => void;
  isProcessing?: boolean;
}

export function CloseSessionModal({
  isOpen,
  campaign,
  attendeeCount,
  onClose,
  onConfirmClose,
  isProcessing = false,
}: CloseSessionModalProps) {
  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0e131d] border border-rose-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Glow Header Accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />

        {/* Icon & Title */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">End &amp; Close Session?</h3>
            <p className="text-xs text-slate-400">Move session out of active roll call to History</p>
          </div>
        </div>

        {/* Session Details Box */}
        <div className="bg-[#141b27] border border-[#222f42] rounded-2xl p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-semibold">Session Name:</span>
            <span className="font-bold text-white text-right truncate max-w-[200px]">{campaign.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Date:
            </span>
            <span className="font-mono font-bold text-slate-200">{campaign.date}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-slate-400" />
              Short Code:
            </span>
            <span className="font-mono font-bold text-[#00FF66] uppercase">{campaign.shortCode}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]">
            <span className="text-slate-300 font-semibold flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              Recorded Attendance:
            </span>
            <span className="font-mono font-black text-white text-sm">
              {attendeeCount} member{attendeeCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Informative Warning */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed">
            Ending this session will remove it from the active session dropdown menu. All verified attendance records will be safely archived in <strong>Session History</strong> and remain fully downloadable as CSV and auditable.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-[#151c28] hover:bg-[#1e2838] border border-[#273449] transition-all cursor-pointer"
          >
            Keep Active
          </button>

          <button
            type="button"
            onClick={onConfirmClose}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{isProcessing ? 'Ending Session...' : 'Confirm & End Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
