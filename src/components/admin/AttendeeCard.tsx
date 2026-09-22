import { MapPin, Clock, Globe, ShieldCheck, Eye } from 'lucide-react';
import { Attendee } from '../../types/attendance';
import { formatDistance } from '../../utils/geo';

interface AttendeeCardProps {
  attendee: Attendee;
  allowedRadius: number;
  onViewPhoto: (attendee: Attendee) => void;
}

export function AttendeeCard({ attendee, allowedRadius, onViewPhoto }: AttendeeCardProps) {
  const isCompliant = attendee.distanceMeters <= allowedRadius;

  const timeString = new Date(attendee.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateString = new Date(attendee.timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      id={`attendee-card-${attendee.id}`}
      className="bg-[#0e131c] hover:bg-[#121824] border border-[#1f2839] hover:border-[#2b374d] rounded-2xl p-4 transition-all duration-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
    >
      {/* Left: Biometric Face Thumbnail & Core Identity */}
      <div className="flex items-center space-x-3.5 min-w-0 w-full sm:w-auto">
        {/* Photo Thumbnail with quick zoom trigger */}
        <div
          onClick={() => onViewPhoto(attendee)}
          className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#2b374c] group-hover:border-[#00FF66] transition-all cursor-pointer shrink-0 shadow-sm"
          title="Click to view biometric verification photo"
        >
          <img
            src={attendee.photoUrl}
            alt={attendee.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Eye className="w-4 h-4 text-[#00FF66]" />
          </div>
          <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-[#00FF66] border border-[#0a0c10]" />
        </div>

        {/* Identity Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-extrabold text-white truncate">{attendee.name}</h4>
            <span className="shrink-0 inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-[10px] font-mono font-bold">
              <ShieldCheck className="w-3 h-3" />
              <span>PASS</span>
            </span>
            {attendee.isOfflineSync && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold">
                .IWH OFFLINE
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center space-x-2">
            <span className="font-mono text-xs font-bold text-[#00FF66] bg-[#00FF66]/15 px-2 py-0.5 rounded border border-[#00FF66]/20">
              {attendee.stateCode}
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              {dateString} • {timeString}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Geofence Distance & Audit Trail */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1a212f]">
        {/* Distance Badge */}
        <div className="flex items-center space-x-1.5 bg-[#141b27] px-3 py-1.5 rounded-xl border border-[#222d3f]">
          <MapPin className={`w-3.5 h-3.5 ${isCompliant ? 'text-[#00FF66]' : 'text-rose-400'}`} />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block leading-none">Proximity</span>
            <span className={`text-xs font-mono font-bold ${isCompliant ? 'text-[#00FF66]' : 'text-rose-400'}`}>
              {formatDistance(attendee.distanceMeters)}
            </span>
          </div>
        </div>

        {/* Audit IP Pill */}
        <div className="flex items-center space-x-1.5 bg-[#141b27] px-3 py-1.5 rounded-xl border border-[#222d3f]">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block leading-none">Logged IP</span>
            <span className="text-[11px] font-mono text-slate-300">
              {attendee.loggedIp}
            </span>
          </div>
        </div>

        {/* View Photo Button */}
        <button
          id={`btn-view-photo-${attendee.id}`}
          type="button"
          onClick={() => onViewPhoto(attendee)}
          className="p-2 rounded-xl bg-[#18202d] hover:bg-[#202b3c] text-slate-300 hover:text-white border border-[#263246] transition-colors"
          title="Inspect verified face"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
