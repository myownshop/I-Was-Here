import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/common/Header';
import { AttendanceForm } from './components/attendance/AttendanceForm';
import { AdminPortal } from './components/admin/AdminPortal';
import { AuthPage } from './components/auth/AuthPage';
import { ToastContainer, showToast } from './components/common/Toast';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { Campaign, Organization, UserProfile } from './types/attendance';
import {
  testConnection,
  subscribeToAuth,
  getUserProfile,
  getOrganization,
  signOutAdmin,
  initializeDefaultOrgAndCampaign,
} from './services/firebase';

export default function App() {
  const [view, setView] = useState<'attend' | 'admin' | 'auth'>('attend');
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [targetShortCode, setTargetShortCode] = useState<string | undefined>(undefined);
  const [targetCampaignId, setTargetCampaignId] = useState<string | undefined>(undefined);

  // Auth & Tenant State
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Parse Route from URL path or hash
  const parseRoute = useCallback(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const pathname = window.location.pathname.replace(/^\//, '');

    const routeStr = hash || pathname;

    if (routeStr.startsWith('auth') || routeStr.startsWith('login')) {
      setView('auth');
      return;
    }

    if (routeStr.startsWith('admin')) {
      setView('admin');
      return;
    }

    // Match short code alias: /c/[short_code]
    const shortCodeMatch = routeStr.match(/^c\/([a-zA-Z0-9]+)/i);
    if (shortCodeMatch) {
      setTargetShortCode(shortCodeMatch[1]);
      setView('attend');
      return;
    }

    // Match campaign ID: /attend/[campaign_id]
    const campaignMatch = routeStr.match(/^attend\/([a-zA-Z0-9_\-]+)/i);
    if (campaignMatch) {
      setTargetCampaignId(campaignMatch[1]);
      setView('attend');
      return;
    }

    // Default view
    setView('attend');
  }, []);

  useEffect(() => {
    testConnection();
    parseRoute();

    const handleLocationChange = () => {
      parseRoute();
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Subscribe to Firebase Auth state
    const unsubscribeAuth = subscribeToAuth(async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            setCurrentUserProfile(profile);
            const org = await getOrganization(profile.orgId);
            if (org) {
              setCurrentOrg(org);
            }
          }
        } catch (err) {
          console.error('Error fetching auth user profile:', err);
        }
      } else {
        // Fallback or seed default NYSC tenant if none logged in
        try {
          const bootstrapped = await initializeDefaultOrgAndCampaign();
          setCurrentOrg((prev) => prev || bootstrapped.org);
        } catch (e) {
          console.error('Bootstrap error:', e);
        }
      }
      setAuthLoading(false);
    });

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      unsubscribeAuth();
    };
  }, [parseRoute]);

  const handleViewChange = (newView: 'attend' | 'admin' | 'auth') => {
    setView(newView);
    if (newView === 'admin') {
      window.location.hash = '#/admin';
    } else if (newView === 'auth') {
      window.location.hash = '#/auth';
    } else {
      if (activeCampaign?.shortCode) {
        window.location.hash = `#/c/${activeCampaign.shortCode}`;
      } else {
        window.location.hash = '#/';
      }
    }
  };

  const handleLaunchAttendeeFlow = (campaign: Campaign) => {
    setActiveCampaign(campaign);
    setTargetCampaignId(campaign.id);
    setTargetShortCode(campaign.shortCode);
    setView('attend');
    window.location.hash = `#/c/${campaign.shortCode}`;
  };

  const handleSignOut = async () => {
    try {
      await signOutAdmin();
      setCurrentUserProfile(null);
      showToast('info', 'Signed out of organization portal.', 'Signed Out');
      handleViewChange('auth');
    } catch {
      showToast('error', 'Error signing out.', 'Error');
    }
  };

  const handleAuthSuccess = (org: Organization, profile?: UserProfile) => {
    setCurrentOrg(org);
    if (profile) setCurrentUserProfile(profile);
    handleViewChange('admin');
  };

  const accentColor = currentOrg?.accentColor || '#00FF66';

  return (
    <div
      className="min-h-screen bg-[#0a0c10] text-[#f0f3f6] flex flex-col selection:bg-[#00FF66] selection:text-[#0a0c10]"
      style={{
        // Dynamic custom accent highlight css variable if needed
        ['--org-accent' as string]: accentColor,
      }}
    >
      {/* Toast notification system */}
      <ToastContainer />

      {/* Global Navigation Header */}
      <Header
        currentView={view}
        onViewChange={handleViewChange}
        activeCampaignName={activeCampaign?.name}
        organization={currentOrg}
      />

      {/* Offline Status Warning & Action Bar */}
      <OfflineIndicator accentColor={accentColor} />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col justify-start py-4 sm:py-6">
        {view === 'attend' ? (
          <AttendanceForm
            initialCampaignId={targetCampaignId}
            initialShortCode={targetShortCode}
            onCampaignLoaded={(camp) => setActiveCampaign(camp)}
          />
        ) : view === 'auth' ? (
          <AuthPage onAuthSuccess={handleAuthSuccess} />
        ) : (
          <AdminPortal
            currentOrg={currentOrg}
            onLaunchAttendeeFlow={handleLaunchAttendeeFlow}
            onSignOut={currentUserProfile ? handleSignOut : undefined}
            onNavigateToAuth={() => handleViewChange('auth')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-[#161c26] text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium tracking-wide">
            {currentOrg?.name || 'IWasHere'} • Multi-Tenant Biometric Attendance PWA
          </p>
          <p className="text-[11px] text-slate-400">
            Encrypted Offline Sync (.iwh) • Precise Geofencing • Liveness Verification
          </p>
        </div>
      </footer>
    </div>
  );
}
