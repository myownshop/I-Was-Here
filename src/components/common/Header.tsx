import { ShieldCheck, LogOut } from 'lucide-react';
import { Organization, UserProfile } from '../../types/attendance';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentView: 'home' | 'attend' | 'portal' | 'auth';
  onViewChange: (view: 'home' | 'attend' | 'portal' | 'auth') => void;
  activeCampaignName?: string;
  organization?: Organization | null;
  currentUserProfile?: UserProfile | null;
  onSignOut?: () => void;
}

export function Header({
  currentView: _currentView,
  onViewChange,
  activeCampaignName,
  organization,
  currentUserProfile,
  onSignOut,
}: HeaderProps) {
  const accentColor = organization?.accentColor || '#00FF66';

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 bg-[#0a0c10]/95 backdrop-blur-md border-b border-[#1f2633] px-3 sm:px-4 py-2.5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand identity - Click goes to Home overview */}
        <div
          id="brand-logo-btn"
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => onViewChange('home')}
          title="Return to Home Overview"
        >
          <div
            id="brand-logo-badge"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all shadow-md shrink-0 group-hover:scale-105"
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
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[130px] sm:max-w-xs">
              {organization?.name || activeCampaignName || 'Anti-Proxy Biometric Attendance'}
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* PWA Install Button */}
          <PWAInstallButton accentColor={accentColor} />

          {/* Signed-in user sign out control if authenticated */}
          {currentUserProfile && onSignOut && (
            <button
              id="header-signout-btn"
              onClick={onSignOut}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-900/30 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px]">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
