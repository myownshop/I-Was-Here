import { ShieldCheck, Wifi, WifiOff, Users, QrCode, Building2, KeyRound } from 'lucide-react';
import { Organization } from '../../types/attendance';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface HeaderProps {
  currentView: 'attend' | 'admin' | 'auth';
  onViewChange: (view: 'attend' | 'admin' | 'auth') => void;
  activeCampaignName?: string;
  organization?: Organization | null;
}

export function Header({
  currentView,
  onViewChange,
  activeCampaignName,
  organization,
}: HeaderProps) {
  const isOnline = useOnlineStatus();
  const accentColor = organization?.accentColor || '#00FF66';

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 bg-[#0a0c10]/95 backdrop-blur-md border-b border-[#1f2633] px-3 sm:px-4 py-2.5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand identity */}
        <div
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => onViewChange('attend')}
        >
          <div
            id="brand-logo-badge"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all shadow-md shrink-0"
            style={{
              backgroundColor: `${accentColor}15`,
              borderColor: `${accentColor}40`,
              color: accentColor,
            }}
          >
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-extrabold tracking-wider text-white">IWasHere</span>
              <span
                className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border hidden xs:inline"
                style={{
                  backgroundColor: `${accentColor}15`,
                  borderColor: `${accentColor}30`,
                  color: accentColor,
                }}
              >
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[150px] sm:max-w-xs">
              {organization?.name || activeCampaignName || 'Multi-Tenant Biometric Attendance'}
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* PWA Install Button */}
          <PWAInstallButton accentColor={accentColor} />

          {/* Network status pill */}
          <div
            id="network-status-pill"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-3 h-3" />
                <span className="hidden md:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* View switcher */}
          <div
            id="view-toggle-group"
            className="flex items-center bg-[#131923] p-1 rounded-xl border border-[#222c3c]"
          >
            <button
              id="tab-attend-view"
              onClick={() => onViewChange('attend')}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'attend'
                  ? 'text-[#0a0c10] shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: currentView === 'attend' ? accentColor : 'transparent',
              }}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Attend</span>
            </button>

            <button
              id="tab-admin-view"
              onClick={() => onViewChange('admin')}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'admin'
                  ? 'text-[#0a0c10] shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: currentView === 'admin' ? accentColor : 'transparent',
              }}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>

            <button
              id="tab-auth-view"
              onClick={() => onViewChange('auth')}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'auth'
                  ? 'text-[#0a0c10] shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: currentView === 'auth' ? accentColor : 'transparent',
              }}
              title="Organization Portal / Sign In"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Auth</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
