import { WifiOff, ShieldCheck } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  accentColor?: string;
}

export function OfflineIndicator({ accentColor }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-auto z-50 flex items-center justify-between gap-3 rounded-xl bg-amber-950/95 border border-amber-500/40 p-3 shadow-2xl backdrop-blur-md text-amber-200 text-xs animate-in slide-in-from-bottom duration-300"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
          <WifiOff className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="font-semibold text-white flex items-center gap-1.5">
            <span>Offline Mode Active</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          </p>
          <p className="text-[11px] text-amber-300/80">
            Attendance will be packaged into a secure AES <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">.iwh</code> file.
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
        <ShieldCheck className="w-3 h-3" />
        <span>AES-GCM Guard</span>
      </div>
    </div>
  );
}
