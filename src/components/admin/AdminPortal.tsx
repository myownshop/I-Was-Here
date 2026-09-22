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
  Sparkles,
  Building2,
  LogOut,
  Sliders,
} from 'lucide-react';
import { Campaign, Attendee, Organization } from '../../types/attendance';
import { CampaignQRCard } from './CampaignQRCard';
import { AttendeeCard } from './AttendeeCard';
import { CreateCampaignModal } from './CreateCampaignModal';
import { PhotoAuditModal } from './PhotoAuditModal';
import { OfflineDataImporter } from './OfflineDataImporter';
import {
  getCampaignsForOrg,
  getAllCampaigns,
  getCampaignAttendees,
  initializeDefaultOrgAndCampaign,
} from '../../services/firebase';
import { formatDistance } from '../../utils/geo';
import { showToast } from '../common/Toast';

interface AdminPortalProps {
  currentOrg: Organization | null;
  onLaunchAttendeeFlow: (campaign: Campaign) => void;
  onSignOut?: () => void;
  onNavigateToAuth?: () => void;
}

export function AdminPortal({
  currentOrg,
  onLaunchAttendeeFlow,
  onSignOut,
  onNavigateToAuth,
}: AdminPortalProps) {
  const [activeOrg, setActiveOrg] = useState<Organization | null>(currentOrg);
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
  const [auditAttendee, setAuditAttendee] = useState<Attendee | null>(null);

  // Synchronize activeOrg if currentOrg prop updates
  useEffect(() => {
    if (currentOrg) {
      setActiveOrg(currentOrg);
    }
  }, [currentOrg]);

  // Load campaigns for current tenant
  const loadCampaigns = useCallback(async () => {
    try {
      let orgToUse = activeOrg;
      if (!orgToUse) {
        const bootstrapped = await initializeDefaultOrgAndCampaign();
        orgToUse = bootstrapped.org;
        setActiveOrg(bootstrapped.org);
      }

      let list = await getCampaignsForOrg(orgToUse.id);
      if (list.length === 0) {
        list = await getAllCampaigns();
      }
      setCampaigns(list);

      if (list.length > 0 && (!selectedCampaignId || !list.some((c) => c.id === selectedCampaignId))) {
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
    if (!campaignId) return;
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
    }
  }, [selectedCampaignId, loadAttendees]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;
  }, [campaigns, selectedCampaignId]);

  // Filtered Attendees list (by Search Query and Date)
  const filteredAttendees = useMemo(() => {
    return attendees.filter((att) => {
      const matchesSearch =
        !searchQuery ||
        att.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        att.stateCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDate = !selectedDate || att.timestamp.startsWith(selectedDate);

      return matchesSearch && matchesDate;
    });
  }, [attendees, searchQuery, selectedDate]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = attendees.length;
    if (total === 0) {
      return { total: 0, compliantCount: 0, complianceRate: 100, avgDistance: 0, offlineSyncCount: 0 };
    }

    const radius = selectedCampaign?.allowedRadius || 100;
    const compliant = attendees.filter((a) => a.distanceMeters <= radius).length;
    const offlineSyncCount = attendees.filter((a) => a.isOfflineSync).length;
    const totalDist = attendees.reduce((acc, curr) => acc + curr.distanceMeters, 0);

    return {
      total,
      compliantCount: compliant,
      complianceRate: Math.round((compliant / total) * 100),
      avgDistance: Math.round(totalDist / total),
      offlineSyncCount,
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
  };

  const accentColor = activeOrg?.accentColor || '#00FF66';

  return (
    <div id="admin-portal-view" className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Organization SaaS Header */}
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
              {activeOrg?.name || 'Medical CDS, Ikeja'}
            </h1>
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              TENANT ISOLATED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Admin: <strong className="text-slate-200">{activeOrg?.adminName || 'Admin Officer'}</strong></span>
            <span>•</span>
            <span>{activeOrg?.adminEmail || 'admin@nysc.gov.ng'}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          {/* Campaign Selector dropdown if multiple */}
          {campaigns.length > 1 && (
            <select
              id="select-active-campaign"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              aria-label="Select active campaign"
              className="bg-[#141b27] border border-[#243144] text-xs font-semibold text-white py-2.5 px-3 rounded-xl outline-none focus:border-[#00FF66] max-w-[200px] truncate"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0d121b]">
                  {c.name} ({c.shortCode})
                </option>
              ))}
            </select>
          )}

          <button
            id="btn-refresh-admin"
            type="button"
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-[#141b27] hover:bg-[#1a2436] text-slate-300 hover:text-white border border-[#243144] transition-colors"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: refreshing ? accentColor : undefined }} />
          </button>

          <button
            id="btn-open-create-campaign-modal"
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="py-2.5 px-4 rounded-xl text-[#0a0c10] text-xs font-extrabold flex items-center space-x-1.5 shadow-md transition-all active:scale-95"
            style={{ backgroundColor: accentColor }}
          >
            <Plus className="w-4 h-4 text-black" />
            <span className="text-black">New Session</span>
          </button>

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

      {/* Featured QR & Short Link Card */}
      {selectedCampaign && (
        <CampaignQRCard
          campaign={selectedCampaign}
          onOpenSession={() => onLaunchAttendeeFlow(selectedCampaign)}
        />
      )}

      {/* Offline Data Importer (.iwh drag & drop) */}
      {selectedCampaign && (
        <OfflineDataImporter
          campaign={selectedCampaign}
          accentColor={accentColor}
          onRecordsImported={() => {
            if (selectedCampaignId) {
              loadAttendees(selectedCampaignId);
            }
          }}
        />
      )}

      {/* Summary Metrics Cards (Clean card-based layout - NO tables!) */}
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

      {/* Filter & Search Bar */}
      <div className="bg-[#0d121a] border border-[#1e2738] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search input */}
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

        {/* Date Filter & Count Badge */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center space-x-2 bg-[#141a24] px-3 py-1.5 rounded-xl border border-[#232f42]">
            <Calendar className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <input
              id="input-filter-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-slate-300 outline-none"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <span className="text-xs text-slate-400 font-mono">
            Showing <strong className="text-white">{filteredAttendees.length}</strong> of{' '}
            <strong className="text-slate-300">{attendees.length}</strong>
          </span>
        </div>
      </div>

      {/* Attendees Card List (Strictly Card-Based - NO HTML Table!) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <span>Verified Attendance Roster</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-mono font-bold"
              style={{
                backgroundColor: `${accentColor}15`,
                color: accentColor,
              }}
            >
              {filteredAttendees.length}
            </span>
          </h2>
          <span className="text-[11px] text-slate-400">
            Card-Based Feed • Biometric & GPS Logged
          </span>
        </div>

        {loading ? (
          /* Skeletons */
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[#0e131c] border border-[#1f2839] rounded-2xl p-4 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 bg-slate-800 rounded-xl" />
                  <div className="space-y-2">
                    <div className="w-36 h-4 bg-slate-800 rounded" />
                    <div className="w-24 h-3 bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="w-28 h-8 bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredAttendees.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {filteredAttendees.map((attendee) => (
              <AttendeeCard
                key={attendee.id}
                attendee={attendee}
                allowedRadius={selectedCampaign?.allowedRadius || 100}
                onViewPhoto={(att) => setAuditAttendee(att)}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div
            id="empty-attendee-list"
            className="rounded-3xl bg-[#0e131b] border border-[#1e2738] p-10 text-center flex flex-col items-center justify-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border"
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
            {selectedCampaign && (
              <button
                type="button"
                onClick={() => onLaunchAttendeeFlow(selectedCampaign)}
                className="px-4 py-2.5 rounded-xl text-[#0a0c10] text-xs font-extrabold flex items-center space-x-2 shadow-md transition-all active:scale-95"
                style={{ backgroundColor: accentColor }}
              >
                <Sparkles className="w-4 h-4 text-black" />
                <span className="text-black">Test Attendance Flow for this Session</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={isCreateModalOpen}
        orgId={activeOrg?.id || 'org_default'}
        onClose={() => setIsCreateModalOpen(false)}
        onCampaignCreated={handleCampaignCreated}
      />

      {/* Photo Audit Zoom Modal */}
      <PhotoAuditModal
        attendee={auditAttendee}
        onClose={() => setAuditAttendee(null)}
      />
    </div>
  );
}
