import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/common/Header';
import { HomePage } from './components/home/HomePage';
import { AttendanceForm } from './components/attendance/AttendanceForm';
import { AdminPortal } from './components/admin/AdminPortal';
import { AuthPage } from './components/auth/AuthPage';
import { ToastContainer, showToast } from './components/common/Toast';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { Campaign, Organization, UserProfile } from './types/attendance';
import { setupAutoSyncOnReconnect } from './utils/indexedDB';
import {
  testConnection,
  subscribeToAuth,
  getUserProfile,
  getOrganization,
  signOutAdmin,
} from './services/firebase';

export type AppView = 'home' | 'attend' | 'portal' | 'auth';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [targetShortCode, setTargetShortCode] = useState<string | undefined>(undefined);
  const [targetCampaignId, setTargetCampaignId] = useState<string | undefined>(undefined);

  // Auth & Tenant State
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isFirstSetup, setIsFirstSetup] = useState<boolean>(false);
  const [initialPortalTab, setInitialPortalTab] = useState<'sessions' | 'settings'>('sessions');

  // Parse Route from URL hash, pathname, or search query parameters
  const parseRoute = useCallback(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const pathname = window.location.pathname.replace(/^\//, '');
    const routeStr = hash || pathname;

    // Check query parameters (e.g. ?view=attend or ?c=med24 or ?code=med24)
    if (typeof window !== 'undefined' && window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      const searchCode = searchParams.get('c') || searchParams.get('code');
      const searchCampaign = searchParams.get('campaign') || searchParams.get('attend');
      const searchView = searchParams.get('view');

      if (searchCode) {
        setTargetShortCode(searchCode);
        setView('attend');
        return;
      }
      if (searchCampaign) {
        setTargetCampaignId(searchCampaign);
        setView('attend');
        return;
      }
      if (searchView === 'attend') {
        setView('attend');
        return;
      }
      if (searchView === 'auth') {
        setView('auth');
        return;
      }
      if (searchView === 'portal' || searchView === 'admin' || searchView === 'cds') {
        setView('portal');
        return;
      }
    }

    if (routeStr.startsWith('auth') || routeStr.startsWith('login')) {
      setView('auth');
      return;
    }

    if (routeStr.startsWith('portal') || routeStr.startsWith('admin') || routeStr.startsWith('cds')) {
      setView('portal');
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

    // Direct manual attend link: /attend
    if (routeStr.startsWith('attend')) {
      setView('attend');
      return;
    }

    // Default view is the Home feature & capability overview
    setView('home');
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
        setCurrentUserProfile(null);
        setCurrentOrg(null);
      }
      setAuthLoading(false);
    });

    // Initialize PWA IndexedDB auto-sync on network reconnection
    const unsubscribeAutoSync = setupAutoSyncOnReconnect({
      onSyncComplete: (report) => {
        if (report.syncedCount > 0) {
          showToast(
            'success',
            `Reconnected! Synchronized ${report.syncedCount} queued attendance record${report.syncedCount > 1 ? 's' : ''} to Firebase.`,
            'PWA Cloud Sync'
          );
        }
      },
    });

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      unsubscribeAuth();
      unsubscribeAutoSync();
    };
  }, [parseRoute]);

  const handleViewChange = (newView: AppView) => {
    setView(newView);
    if (newView === 'portal') {
      window.location.hash = '#/portal';
    } else if (newView === 'auth') {
      window.location.hash = '#/auth';
    } else if (newView === 'attend') {
      if (activeCampaign?.shortCode) {
        window.location.hash = `#/c/${activeCampaign.shortCode}`;
      } else {
        window.location.hash = '#/attend';
      }
    } else {
      window.location.hash = '#/';
    }
  };

  const handleLaunchAttendeeFlow = (campaign: Campaign) => {
    setActiveCampaign(campaign);
    setTargetCampaignId(campaign.id);
    setTargetShortCode(campaign.shortCode);
    setView('attend');
    window.location.hash = `#/c/${campaign.shortCode}`;
  };

  const handleLaunchAttendeeFlowWithCode = (code?: string) => {
    if (code) {
      setTargetShortCode(code);
      window.location.hash = `#/c/${code}`;
    } else {
      window.location.hash = '#/attend';
    }
    setView('attend');
  };

  const handleSignOut = async () => {
    try {
      await signOutAdmin();
      setCurrentUserProfile(null);
      showToast('info', 'Signed out of organization portal.', 'Signed Out');
      handleViewChange('home');
    } catch {
      showToast('error', 'Error signing out.', 'Error');
    }
  };

  const handleAuthSuccess = (org: Organization, profile?: UserProfile, isNewSignUp?: boolean) => {
    setCurrentOrg(org);
    if (profile) setCurrentUserProfile(profile);
    // If newly signed up or profile details are not yet completed, redirect to settings page first
    if (isNewSignUp || !org.stateLga || !org.cdsBatch) {
      setIsFirstSetup(true);
      setInitialPortalTab('settings');
    } else {
      setIsFirstSetup(false);
      setInitialPortalTab('sessions');
    }
    // Navigate directly to the CDS / Body portal
    handleViewChange('portal');
  };

  const handleCampaignLoaded = useCallback((camp: Campaign) => {
    setActiveCampaign(camp);
  }, []);

  const handleBackToHome = useCallback(() => {
    handleViewChange('home');
  }, [handleViewChange]);

  const accentColor = currentOrg?.accentColor || '#00FF66';

  return (
    <div
      className="min-h-screen bg-[#0a0c10] text-[#f0f3f6] flex flex-col selection:bg-[#00FF66] selection:text-[#0a0c10]"
      style={{
        ['--org-accent' as string]: accentColor,
      }}
    >
      {/* Toast notification system */}
      <ToastContainer />

      {/* Global Navigation Header with CDS / Body Branding */}
      <Header
        currentView={view}
        onViewChange={handleViewChange}
        activeCampaignName={activeCampaign?.name}
        organization={currentOrg}
        currentUserProfile={currentUserProfile}
        onSignOut={currentUserProfile ? handleSignOut : undefined}
      />

      {/* Offline Status Warning & Action Bar */}
      <OfflineIndicator accentColor={accentColor} />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col justify-start py-4 sm:py-6">
        {view === 'home' ? (
          <HomePage
            organization={currentOrg}
            currentUserProfile={currentUserProfile}
            onNavigateToAuth={() => handleViewChange('auth')}
            onNavigateToPortal={() => handleViewChange('portal')}
            onNavigateToAttend={handleLaunchAttendeeFlowWithCode}
            onSignOut={currentUserProfile ? handleSignOut : undefined}
          />
        ) : view === 'attend' ? (
          <AttendanceForm
            initialCampaignId={targetCampaignId}
            initialShortCode={targetShortCode}
            onCampaignLoaded={handleCampaignLoaded}
            onBackToHome={handleBackToHome}
          />
        ) : view === 'auth' ? (
          <AuthPage
            onAuthSuccess={handleAuthSuccess}
            onNavigateToAttend={() => handleViewChange('attend')}
            onNavigateToHome={() => handleViewChange('home')}
          />
        ) : (
          <AdminPortal
            currentOrg={currentOrg}
            onLaunchAttendeeFlow={handleLaunchAttendeeFlow}
            onSignOut={currentUserProfile ? handleSignOut : undefined}
            onNavigateToAuth={() => handleViewChange('auth')}
            initialTab={initialPortalTab}
            isFirstSetup={isFirstSetup}
            onOrganizationUpdated={(updated) => setCurrentOrg(updated)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-5 border-t border-[#161c26] text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
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
