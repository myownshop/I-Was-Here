import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Users,
  Calendar,
  MapPin,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Building2,
  LogOut,
  Sliders,
  Download,
  Settings,
  History,
  Lock,
  ArrowLeft,
  Edit3,
  Crown,
} from 'lucide-react';
import { Campaign, Attendee, Organization, UserProfile, CampaignWithOrg } from '../../types/attendance';
import { CampaignQRCard } from './CampaignQRCard';
import { AttendeeCard } from './AttendeeCard';
import { DashboardWidget } from './DashboardWidget';
import { CreateCampaignModal } from './CreateCampaignModal';
import { EditCampaignModal } from './EditCampaignModal';
import { PhotoAuditModal } from './PhotoAuditModal';
import { OfflineDataImporter } from './OfflineDataImporter';
import { OrganizationSettings } from './OrganizationSettings';
import { CloseSessionModal } from './CloseSessionModal';
import { SessionHistoryView } from './SessionHistoryView';
import { SuperUserHub } from './SuperUserHub';
import { exportAttendeesToCsv } from '../../utils/csvExport';
import { getWATDateString } from '../../utils/dateUtils';
import {
  getCampaignsForOrg,
  getAllCampaigns,
  getCampaignAttendees,
  closeCampaign,
  reopenCampaign,
  getAllOrganizations,
} from '../../services/firebase';
import { formatDistance } from '../../utils/geo';
import { showToast } from '../common/Toast';

interface AdminPortalProps {
  currentOrg: Organization | null;
  currentUserProfile?: UserProfile | null;
  onLaunchAttendeeFlow: (campaign: Campaign) => void;
  onSignOut?: () => void;
  onNavigateToAuth?: () => void;
  initialTab?: 'active' | 'history' | 'settings' | 'sessions' | 'superadmin';
  isFirstSetup?: boolean;
  onOrganizationUpdated?: (updated: Organization) => void;
}

export function AdminPortal({
  currentOrg,
  currentUserProfile,
  onLaunchAttendeeFlow,
  onSignOut,
  onNavigateToAuth,
  initialTab = 'active',
  isFirstSetup = false,
  onOrganizationUpdated,
}: AdminPortalProps) {
  const isSuperUser = currentUserProfile?.role === 'superuser' || currentOrg?.id === 'all';
  const defaultTab = isSuperUser && initialTab === 'active' ? 'superadmin' : (initialTab === 'sessions' ? 'active' : (initialTab || 'active'));

  const [activeOrg, setActiveOrg] = useState<Organization | null>(currentOrg);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'settings' | 'superadmin'>(defaultTab);
  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [closeModalCampaign, setCloseModalCampaign] = useState<Campaign | null>(null);
  const [isClosingSession, setIsClosingSession] = useState<boolean>(false);
  const [auditAttendee, setAuditAttendee] = useState<Attendee | null>(null);

  // Synchronize activeOrg if currentOrg prop updates
  useEffect(() => {
    if (currentOrg) {
      setActiveOrg(currentOrg);
    }
  }, [currentOrg]);

  // Load all organizations for Super User switcher
  useEffect(() => {
    if (isSuperUser) {
      getAllOrganizations().then((orgList) => {
        setAllOrgs(orgList);
      });
    }
  }, [isSuperUser]);

  // Synchronize initialTab if provided
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab === 'sessions' ? 'active' : initialTab);
    }
  }, [initialTab]);

  // Split campaigns into Active vs Closed History
  const activeCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.status !== 'closed' && !c.isClosed);
  }, [campaigns]);

  const historyCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.status === 'closed' || c.isClosed);
  }, [campaigns]);

  // Load campaigns for current tenant
  const loadCampaigns = useCallback(async () => {
    if (!activeOrg) return;
    try {
      let list: Campaign[] = [];
      if (activeOrg.id === 'all') {
        list = await getAllCampaigns();
      } else {
        list = await getCampaignsForOrg(activeOrg.id);
        if (list.length === 0) {
          list = await getAllCampaigns();
        }
      }
      setCampaigns(list);

      // Auto-select first active campaign if none selected or if selected is missing
      const activeList = list.filter((c) => c.status !== 'closed' && !c.isClosed);
      if (activeList.length > 0 && (!selectedCampaignId || !list.some((c) => c.id === selectedCampaignId))) {
        setSelectedCampaignId(activeList[0].id);
      } else if (list.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading tenant campaigns:', err);
    }
  }, [activeOrg, selectedCampaignId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Load attendees for selected campaign
  const loadAttendees = useCallback(async (campaignId: string) => {
    if (!campaignId) {
      setAttendees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const records = await getCampaignAttendees(campaignId);
      setAttendees(records);
    } catch (err) {
      console.error('Error loading attendees:', err);
      showToast('error', 'Failed to fetch attendees.', 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadAttendees(selectedCampaignId);
    } else {
      setAttendees([]);
      setLoading(false);
    }
  }, [selectedCampaignId, loadAttendees]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || activeCampaigns[0] || campaigns[0] || null;
  }, [campaigns, selectedCampaignId, activeCampaigns]);

  // Filtered Attendees list (by Search Query and Date in WAT)
  const filteredAttendees = useMemo(() => {
    return attendees.filter((att) => {
      const matchesSearch =
        !searchQuery ||
        att.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        att.stateCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDate = !selectedDate || getWATDateString(att.timestamp) === selectedDate;

      return matchesSearch && matchesDate;
    });
  }, [attendees, searchQuery, selectedDate]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = attendees.length;
    if (total === 0) {
      return { total: 0, compliantCount: 0, complianceRate: 100, avgDistance: 0, offlineSyncCount: 0, tamperedCount: 0, lateCount: 0 };
    }

    const radius = selectedCampaign?.allowedRadius || 100;
    const compliant = attendees.filter((a) => a.distanceMeters <= radius).length;
    const offlineSyncCount = attendees.filter((a) => a.isOfflineSync).length;
    const tamperedCount = attendees.filter((a) => a.tampered).length;
    const lateCount = attendees.filter((a) => a.attendanceStatus === 'late').length;
    const totalDist = attendees.reduce((acc, curr) => acc + curr.distanceMeters, 0);

    return {
      total,
      compliantCount: compliant,
      complianceRate: Math.round((compliant / total) * 100),
      avgDistance: Math.round(totalDist / total),
      offlineSyncCount,
      tamperedCount,
      lateCount,
    };
  }, [attendees, selectedCampaign]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedCampaignId) {
      loadAttendees(selectedCampaignId);
    }
    loadCampaigns();
    showToast('info', 'Refreshed attendance roster.', 'Synchronized');
  };

  const handleCampaignCreated = (newCamp: Campaign) => {
    setCampaigns((prev) => [newCamp, ...prev]);
    setSelectedCampaignId(newCamp.id);
    setActiveTab('active');
  };

  const handleCampaignUpdated = (updated: Campaign) => {
    setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedCampaignId === updated.id) {
      loadAttendees(updated.id);
    }
    loadCampaigns();
  };

  const handleCampaignDeleted = (campaignId: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    if (selectedCampaignId === campaignId) {
      const remaining = campaigns.filter((c) => c.id !== campaignId);
      const remainingActive = remaining.filter((c) => c.status !== 'closed' && !c.isClosed);
      if (remainingActive.length > 0) {
        setSelectedCampaignId(remainingActive[0].id);
      } else if (remaining.length > 0) {
        setSelectedCampaignId(remaining[0].id);
      } else {
        setSelectedCampaignId('');
      }
    }
    loadCampaigns();
  };

  // Close / End Session Logic
  const handleConfirmCloseSession = async () => {
    if (!closeModalCampaign) return;
    setIsClosingSession(true);

    try {
      const updated = await closeCampaign(closeModalCampaign.id);

      // Update campaigns state
      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );

      // Remove from active dropdown and pick the next available active session
      const remainingActive = activeCampaigns.filter((c) => c.id !== closeModalCampaign.id);
      if (remainingActive.length > 0) {
        setSelectedCampaignId(remainingActive[0].id);
      } else {
        setSelectedCampaignId('');
      }

      setCloseModalCampaign(null);
      showToast(
        'success',
        `Session "${updated.name}" was ended and moved to History.`,
        'Session Closed'
      );
    } catch (err) {
      console.error('Error closing session:', err);
      showToast('error', 'Failed to close session.', 'Error');
    } finally {
      setIsClosingSession(false);
    }
  };

  // Re-open a session from history
  const handleReopenSession = async (campaignToReopen: Campaign) => {
    try {
      const updated = await reopenCampaign(campaignToReopen.id);

      setCampaigns((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );

      setSelectedCampaignId(updated.id);
      setActiveTab('active');
      showToast(
        'success',
        `Session "${updated.name}" has been reactivated and added to Active Roll Call.`,
        'Session Reopened'
      );
    } catch (err) {
      console.error('Error reopening session:', err);
      showToast('error', 'Failed to reopen session.', 'Error');
    }
  };

  const handleInspectHistoryRoster = (camp: Campaign) => {
    setSelectedCampaignId(camp.id);
    setActiveTab('active');
  };

  const handleExportAttendance = () => {
    if (filteredAttendees.length === 0 && attendees.length === 0) {
      showToast('warning', 'No attendee records available to export.', 'Export Empty');
      return;
    }

    const listToExport = filteredAttendees.length > 0 ? filteredAttendees : attendees;

    try {
      const result = exportAttendeesToCsv({
        attendees: listToExport,
        campaign: selectedCampaign,
        organization: activeOrg,
      });

      showToast(
        'success',
        `Exported ${result.count} attendance record${result.count === 1 ? '' : 's'} as CSV (${result.filename}).`,
        'Download Started'
      );
    } catch (err) {
      console.error('Error exporting attendees CSV:', err);
      showToast('error', 'Failed to generate CSV export file.', 'Export Error');
    }
  };

  const handleOrgUpdated = (updated: Organization) => {
    setActiveOrg(updated);
    if (onOrganizationUpdated) {
      onOrganizationUpdated(updated);
    }
  };

  const accentColor = activeOrg?.accentColor || '#00FF66';
  const isSelectedClosed = selectedCampaign ? (selectedCampaign.status === 'closed' || selectedCampaign.isClosed) : false;

  if (!activeOrg) {
    return (
      <div id="portal-unauthenticated-state" className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="bg-[#0e131d] border border-[#1e2636] rounded-3xl p-8 space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66] mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Sign In Required</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Please sign in to access your organization's attendance roll call, active QR codes, and member records.
          </p>
          {onNavigateToAuth && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onNavigateToAuth}
                className="px-6 py-3 rounded-xl font-bold text-xs text-[#0a0c10] bg-[#00FF66] hover:bg-[#00FF66]/90 transition-all cursor-pointer shadow-lg inline-flex items-center space-x-2"
              >
                <Building2 className="w-4 h-4 text-black" />
                <span>Sign In / Register Organization</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="admin-portal-view" className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Organization Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d121b] border border-[#1e2738] p-4 sm:p-5 rounded-3xl relative overflow-hidden">
        <div
          className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />

        <div className="relative">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#0a0c10] font-black"
              style={{ backgroundColor: accentColor }}
            >
              <Building2 className="w-4 h-4 text-black" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {activeOrg.name}
            </h1>
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              {activeOrg.cdsBatch || 'COORDINATOR PORTAL'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              Coordinator:{' '}
              <strong className="text-slate-200">{activeOrg.adminName || 'Coordinator'}</strong>
            </span>
            {activeOrg.adminEmail && (
              <>
                <span>•</span>
                <span>{activeOrg.adminEmail}</span>
              </>
            )}
            {activeOrg.stateLga && (
              <>
                <span>•</span>
                <span className="text-slate-300">{activeOrg.stateLga}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          {/* Super User Organization Quick Switcher */}
          {isSuperUser && allOrgs.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#141b27] border border-purple-500/40 py-1 px-2 rounded-xl">
              <Crown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <select
                id="select-superuser-org"
                value={activeOrg.id}
                onChange={(e) => {
                  const targetId = e.target.value;
                  if (targetId === 'all') {
                    setActiveOrg({
                      id: 'all',
                      name: 'Global Super Admin (All Organizations)',
                      adminUid: 'superuser_admin_root',
                      adminEmail: 'admin@iwashere.internal',
                      adminName: 'Super Administrator',
                      accentColor: '#A855F7',
                      createdAt: new Date().toISOString(),
                    });
                    setActiveTab('superadmin');
                  } else {
                    const found = allOrgs.find((o) => o.id === targetId);
                    if (found) {
                      setActiveOrg(found);
                      setActiveTab('active');
                      showToast('info', `Switched view to ${found.name}`, 'Super User');
                    }
                  }
                }}
                className="bg-transparent text-xs font-bold text-purple-200 outline-none cursor-pointer max-w-[170px] truncate"
              >
                <option value="all" className="bg-[#0e1420] text-purple-300">
                  🌐 Super Admin Hub (All Orgs)
                </option>
                {allOrgs.map((o) => (
                  <option key={o.id} value={o.id} className="bg-[#0e1420] text-white">
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Session Selector dropdown: Lists ONLY active sessions */}
          {activeTab === 'active' && activeCampaigns.length > 1 && !isSelectedClosed && (
            <select
              id="select-active-campaign"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              aria-label="Select active campaign"
              className="bg-[#141b27] border border-[#243144] text-xs font-semibold text-white py-2.5 px-3 rounded-xl outline-none focus:border-[#00FF66] max-w-[200px] truncate"
            >
              {activeCampaigns.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0d121b]">
                  {c.name} ({c.shortCode})
                </option>
              ))}
            </select>
          )}

          {activeTab === 'active' && (
            <>
              {/* Edit Session Button in top bar */}
              {selectedCampaign && (
                <button
                  id="btn-edit-active-session"
                  type="button"
                  onClick={() => setEditingCampaign(selectedCampaign)}
                  className="py-2.5 px-3.5 rounded-xl bg-[#141b27] hover:bg-[#1c2637] text-slate-200 hover:text-white border border-[#243144] hover:border-[#384862] text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="Edit session details, venue, coordinates, radius, or date"
                >
                  <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Edit Session</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              )}

              {/* Close Session Button in top bar */}
              {selectedCampaign && !isSelectedClosed && (
                <button
                  id="btn-close-active-session"
                  type="button"
                  onClick={() => setCloseModalCampaign(selectedCampaign)}
                  className="py-2.5 px-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-800/60 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                  title="End and close this session (move to History)"
                >
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Close Session</span>
                  <span className="sm:hidden">Close</span>
                </button>
              )}

              <button
                id="btn-export-attendance"
                type="button"
                onClick={handleExportAttendance}
                disabled={attendees.length === 0}
                className="py-2.5 px-3.5 rounded-xl bg-[#141b27] hover:bg-[#1c2637] text-slate-200 hover:text-white border border-[#243144] hover:border-[#384862] text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                title="Export attendance records to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-300" />
                <span>Export CSV</span>
              </button>

              <button
                id="btn-refresh-admin"
                type="button"
                onClick={handleRefresh}
                className="p-2.5 rounded-xl bg-[#141b27] hover:bg-[#1a2436] text-slate-300 hover:text-white border border-[#243144] transition-colors"
                title="Refresh records"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                  style={{ color: refreshing ? accentColor : undefined }}
                />
              </button>

              <button
                id="btn-open-create-campaign-modal"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="py-2.5 px-4 rounded-xl text-[#0a0c10] text-xs font-extrabold flex items-center space-x-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                <Plus className="w-4 h-4 text-black" />
                <span className="text-black">New Session</span>
              </button>
            </>
          )}

          {onSignOut ? (
            <button
              id="btn-admin-signout"
              type="button"
              onClick={onSignOut}
              className="p-2.5 rounded-xl bg-[#141b27] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-[#243144] hover:border-rose-500/30 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="btn-switch-tenant"
              type="button"
              onClick={onNavigateToAuth}
              className="p-2.5 rounded-xl bg-[#141b27] hover:bg-[#1a2436] text-slate-400 hover:text-white border border-[#243144] transition-colors"
              title="Switch Organization / Login"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation Bar: Active Sessions | History | Profile & Settings | Super Admin Hub */}
      <div className="flex items-center space-x-2 border-b border-[#1b2332] pb-3 overflow-x-auto">
        {isSuperUser && (
          <button
            id="tab-btn-superadmin-hub"
            type="button"
            onClick={() => setActiveTab('superadmin')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'superadmin'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-300 hover:text-white bg-purple-950/30 border border-purple-500/30'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-purple-300" />
            <span>Super Admin Hub</span>
            {allOrgs.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black bg-purple-900/80 text-purple-200">
                {allOrgs.length} Orgs
              </span>
            )}
          </button>
        )}

        <button
          id="tab-btn-active-sessions"
          type="button"
          onClick={() => {
            setActiveTab('active');
            // If currently viewing a closed session, switch to the first active campaign
            if (isSelectedClosed && activeCampaigns.length > 0) {
              setSelectedCampaignId(activeCampaigns[0].id);
            }
          }}
          className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'active' && !isSelectedClosed
              ? 'text-[#0a0c10] shadow-md'
              : 'text-slate-400 hover:text-white bg-[#0e141f] border border-[#1e2738]'
          }`}
          style={activeTab === 'active' && !isSelectedClosed ? { backgroundColor: accentColor } : {}}
        >
          <QrCode className={`w-3.5 h-3.5 ${activeTab === 'active' && !isSelectedClosed ? 'text-black' : ''}`} />
          <span>Active Roll Call</span>
          {activeCampaigns.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'active' && !isSelectedClosed ? 'bg-black/25 text-black' : 'bg-[#182232] text-[#00FF66]'
              }`}
            >
              {activeCampaigns.length}
            </span>
          )}
        </button>

        <button
          id="tab-btn-session-history"
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'text-[#0a0c10] shadow-md'
              : 'text-slate-400 hover:text-white bg-[#0e141f] border border-[#1e2738]'
          }`}
          style={activeTab === 'history' ? { backgroundColor: accentColor } : {}}
        >
          <History className={`w-3.5 h-3.5 ${activeTab === 'history' ? 'text-black' : ''}`} />
          <span>Session History</span>
          {historyCampaigns.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black ${
                activeTab === 'history' ? 'bg-black/25 text-black' : 'bg-[#182232] text-slate-300'
              }`}
            >
              {historyCampaigns.length}
            </span>
          )}
        </button>

        <button
          id="tab-btn-settings"
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'text-[#0a0c10] shadow-md'
              : 'text-slate-400 hover:text-white bg-[#0e141f] border border-[#1e2738]'
          }`}
          style={activeTab === 'settings' ? { backgroundColor: accentColor } : {}}
        >
          <Settings className={`w-3.5 h-3.5 ${activeTab === 'settings' ? 'text-black' : ''}`} />
          <span>Profile &amp; Settings</span>
        </button>
      </div>

      {/* Tab 0: Super Admin Hub (Global Master Directory & Roll Calls) */}
      {activeTab === 'superadmin' && (
        <SuperUserHub
          onSelectOrganization={(org) => {
            setActiveOrg(org);
            setActiveTab('active');
            showToast('info', `Switched view to ${org.name}`, 'Organization Context');
          }}
          onSelectCampaignForRoster={(camp, org) => {
            if (org) setActiveOrg(org);
            setSelectedCampaignId(camp.id);
            setActiveTab('active');
          }}
          onLaunchCampaignSession={(camp) => {
            onLaunchAttendeeFlow(camp);
          }}
        />
      )}

      {/* Tab 1: Organization Settings & Profile */}
      {activeTab === 'settings' && (
        <OrganizationSettings
          organization={activeOrg}
          onOrganizationUpdated={handleOrgUpdated}
          onDataPurged={() => {
            loadCampaigns();
            setAttendees([]);
          }}
          isFirstSetup={isFirstSetup}
          onCompleteSetup={() => {
            setActiveTab('active');
            loadCampaigns();
          }}
        />
      )}

      {/* Tab 2: Session History */}
      {activeTab === 'history' && (
        <SessionHistoryView
          closedCampaigns={historyCampaigns}
          organization={activeOrg}
          accentColor={accentColor}
          onSelectCampaignForRoster={handleInspectHistoryRoster}
          onReopenCampaign={handleReopenSession}
          onEditCampaign={(camp) => setEditingCampaign(camp)}
        />
      )}

      {/* Tab 3: Active Roll Call Sessions & Roster */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          {/* Banner if inspecting a Closed session from history */}
          {isSelectedClosed && selectedCampaign && (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex items-center justify-between gap-3 text-slate-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  title="Return to History"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <span>Archived Session: {selectedCampaign.name}</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full border border-slate-600 font-mono">
                      CLOSED
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Viewing past session records. This session is ended and removed from active drop down.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCampaign(selectedCampaign)}
                  className="px-3 py-1.5 rounded-xl bg-[#141b27] hover:bg-[#1c2637] border border-[#243144] text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Edit Session</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleReopenSession(selectedCampaign)}
                  className="px-3 py-1.5 rounded-xl bg-[#00FF66] text-[#0a0c10] text-xs font-bold hover:bg-[#00e55b] transition-all cursor-pointer"
                >
                  Reopen Session
                </button>
              </div>
            </div>
          )}

          {/* Empty State when no active campaigns exist */}
          {activeCampaigns.length === 0 && !isSelectedClosed ? (
            <div className="bg-[#0e141f] border border-[#1e2738] rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner"
                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
              >
                <QrCode className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">No Active Roll Call Sessions</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {historyCampaigns.length > 0
                    ? `You have ${historyCampaigns.length} completed session(s) in History. Launch a new session when your next CDS meeting begins.`
                    : 'Start by launching your first attendance session to generate an encrypted QR code and geofence.'}
                </p>
              </div>
              <div className="pt-3 flex flex-wrap justify-center gap-3">
                <button
                  id="btn-create-first-session"
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="py-3 px-5 rounded-xl font-black text-xs text-[#0a0c10] shadow-lg flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus className="w-4 h-4 text-black" />
                  <span>Create New Session</span>
                </button>

                {historyCampaigns.length > 0 && (
                  <button
                    id="btn-view-history"
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="py-3 px-5 rounded-xl font-bold text-xs text-slate-300 bg-[#141b27] hover:bg-[#1f2838] border border-[#27344a] flex items-center space-x-2 cursor-pointer transition-all"
                  >
                    <History className="w-4 h-4" />
                    <span>View Past Session History ({historyCampaigns.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Featured QR & Short Link Card with Close & Edit Session Button */}
              {selectedCampaign && (
                <CampaignQRCard
                  campaign={selectedCampaign}
                  onOpenSession={() => onLaunchAttendeeFlow(selectedCampaign)}
                  onEditSession={() => setEditingCampaign(selectedCampaign)}
                  onCloseSession={() => setCloseModalCampaign(selectedCampaign)}
                  onReopenSession={() => handleReopenSession(selectedCampaign)}
                  isHistoryMode={isSelectedClosed}
                  accentColor={accentColor}
                />
              )}

              {/* Offline Data Importer (.iwh drag & drop) */}
              {selectedCampaign && (
                <OfflineDataImporter
                  campaign={selectedCampaign}
                  organization={activeOrg}
                  accentColor={accentColor}
                  onRecordsImported={() => {
                    if (selectedCampaignId) {
                      loadAttendees(selectedCampaignId);
                    }
                  }}
                />
              )}

              {/* Clock Tampering Security Alert Banner */}
              {stats.tamperedCount > 0 && (
                <div className="bg-rose-950/40 border-2 border-rose-500/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-200 animate-in fade-in shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 font-black text-lg">
                      ⚠️
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">
                        {stats.tamperedCount} Clock Manipulation Anomalies Detected!
                      </h4>
                      <p className="text-xs text-rose-300">
                        Hardware timer divergence checks caught attempts to alter device OS clocks backwards to spoof attendance time.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-rose-900/80 text-rose-100 px-3 py-1 rounded-lg border border-rose-500">
                    FLAGGED
                  </span>
                </div>
              )}

              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="bg-[#0d121a] border border-[#1e2738] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Total Present</span>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-2xl font-black text-white font-mono">{stats.total}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Members Scanned</span>
                </div>

                <div className="bg-[#0d121a] border border-[#1e2738] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Geofence Verified</span>
                    <ShieldCheck className="w-4 h-4" style={{ color: accentColor }} />
                  </div>
                  <p className="text-2xl font-black font-mono" style={{ color: accentColor }}>
                    {stats.complianceRate}%
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Within Allowed Radius</span>
                </div>

                <div className="bg-[#0d121a] border border-[#1e2738] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Proximity</span>
                    <MapPin className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-2xl font-black text-white font-mono">
                    {formatDistance(stats.avgDistance)}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">To Venue Coordinates</span>
                </div>

                <div className="bg-[#0d121a] border border-[#1e2738] rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Offline Sync (.iwh)</span>
                    <QrCode className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-black text-amber-400 font-mono">
                    {stats.offlineSyncCount}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Cryptographically Verified</span>
                </div>
              </div>

              {/* D3.js Visual Trends & Velocity Analytics Widget */}
              <DashboardWidget
                attendees={attendees}
                campaign={selectedCampaign}
                accentColor={accentColor}
                selectedDate={selectedDate}
                onFilterByDate={(dateStr) => setSelectedDate(dateStr)}
              />

              {/* Filter & Search Bar */}
              <div className="bg-[#0d121a] border border-[#1e2738] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="input-search-attendees"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search State Code or Name..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#141a24] border border-[#232f42] text-xs text-white placeholder-slate-500 outline-none focus:border-[#00FF66]"
                  />
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-[#00FF66]" />
                    <span className="text-[10px] font-mono text-slate-400 font-bold">WAT:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      title="Filter attendees by West Africa Time (WAT) date"
                      className="bg-[#141a24] border border-[#232f42] rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-[#00FF66]"
                    />
                    {selectedDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedDate('')}
                        className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-400">
                    Showing <span className="text-white font-black">{filteredAttendees.length}</span> of {attendees.length}
                  </span>
                </div>
              </div>

              {/* Verified Attendees Roster Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center space-x-2">
                    <Users className="w-4 h-4 text-[#00FF66]" />
                    <span>Roll Call Roster &amp; Member Liveness</span>
                  </h3>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
                    Synchronizing attendee records...
                  </div>
                ) : filteredAttendees.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredAttendees.map((att) => (
                      <AttendeeCard
                        key={att.id}
                        attendee={att}
                        allowedRadius={selectedCampaign?.allowedRadius || 100}
                        onViewPhoto={(target: Attendee) => setAuditAttendee(target)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0b0e14] border border-dashed border-[#1f2838] rounded-2xl p-8 text-center">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        borderColor: `${accentColor}40`,
                        color: accentColor,
                      }}
                    >
                      <Users className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">No Attendance Records Yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
                      Have members scan the session QR code or upload offline .iwh files to verify presence.
                    </p>
                    {selectedCampaign && !isSelectedClosed && (
                      <button
                        type="button"
                        onClick={() => onLaunchAttendeeFlow(selectedCampaign)}
                        className="px-4 py-2.5 rounded-xl text-[#0a0c10] text-xs font-extrabold flex items-center space-x-2 shadow-md transition-all active:scale-95 cursor-pointer mx-auto"
                        style={{ backgroundColor: accentColor }}
                      >
                        <QrCode className="w-4 h-4 text-black" />
                        <span className="text-black">Launch Roll Call Session</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        orgId={activeOrg?.id || 'org_default'}
        onClose={() => setIsCreateModalOpen(false)}
        onCampaignCreated={handleCampaignCreated}
        organization={activeOrg}
      />

      {/* Edit Campaign Modal */}
      <EditCampaignModal
        isOpen={Boolean(editingCampaign)}
        campaign={editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onCampaignUpdated={handleCampaignUpdated}
        onCampaignDeleted={handleCampaignDeleted}
        organization={activeOrg}
      />

      {/* Close Session Confirmation Modal */}
      <CloseSessionModal
        isOpen={Boolean(closeModalCampaign)}
        campaign={closeModalCampaign}
        attendeeCount={attendees.length}
        onClose={() => setCloseModalCampaign(null)}
        onConfirmClose={handleConfirmCloseSession}
        isProcessing={isClosingSession}
      />

      {/* Photo Audit Zoom Modal */}
      <PhotoAuditModal
        attendee={auditAttendee}
        onClose={() => setAuditAttendee(null)}
      />
    </div>
  );
}
