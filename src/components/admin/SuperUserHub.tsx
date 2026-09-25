import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Users,
  QrCode,
  ShieldCheck,
  Search,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  Plus,
  ShieldAlert,
  ChevronRight,
  Download,
  Sliders,
  KeyRound,
  Crown,
} from 'lucide-react';
import { Organization, CampaignWithOrg, Attendee } from '../../types/attendance';
import {
  getAllOrganizations,
  getAllRollCallsWithOrgDetails,
  getGlobalSystemStats,
  createOrganization,
  getCampaignAttendees,
} from '../../services/firebase';
import { formatWATDate, getWATDateString } from '../../utils/dateUtils';
import { exportAttendeesToCsv } from '../../utils/csvExport';
import { showToast } from '../common/Toast';
import { SuperUserSettings } from './SuperUserSettings';

interface SuperUserHubProps {
  onSelectOrganization: (org: Organization) => void;
  onSelectCampaignForRoster: (campaign: CampaignWithOrg, org?: Organization) => void;
  onLaunchCampaignSession: (campaign: CampaignWithOrg) => void;
}

export function SuperUserHub({
  onSelectOrganization,
  onSelectCampaignForRoster,
  onLaunchCampaignSession,
}: SuperUserHubProps) {
  const [activeTab, setActiveTab] = useState<'orgs' | 'rollcalls' | 'credentials'>('orgs');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [rollCalls, setRollCalls] = useState<CampaignWithOrg[]>([]);
  const [stats, setStats] = useState<{
    totalOrganizations: number;
    totalCampaigns: number;
    activeCampaigns: number;
    closedCampaigns: number;
    totalAttendees: number;
    flaggedTamperedCount: number;
  }>({
    totalOrganizations: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    closedCampaigns: 0,
    totalAttendees: 0,
    flaggedTamperedCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [searchOrgQuery, setSearchOrgQuery] = useState<string>('');
  const [searchRollCallQuery, setSearchRollCallQuery] = useState<string>('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Quick Create Org Modal
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState<boolean>(false);
  const [newOrgName, setNewOrgName] = useState<string>('');
  const [newOrgAdminName, setNewOrgAdminName] = useState<string>('');
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState<string>('');
  const [newOrgAccentColor, setNewOrgAccentColor] = useState<string>('#00FF66');
  const [isSubmittingOrg, setIsSubmittingOrg] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgs, campaigns, sysStats] = await Promise.all([
        getAllOrganizations(),
        getAllRollCallsWithOrgDetails(),
        getGlobalSystemStats(),
      ]);

      setOrganizations(orgs);
      setRollCalls(campaigns);
      setStats(sysStats);
    } catch (err) {
      console.error('Error loading superuser hub data:', err);
      showToast('error', 'Failed to fetch global system data.', 'Super User Hub');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    showToast('info', 'Refreshed global system records.', 'Super User');
  };

  // Filtered organizations
  const filteredOrgs = useMemo(() => {
    return organizations.filter((org) => {
      const q = searchOrgQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        org.name.toLowerCase().includes(q) ||
        org.adminName.toLowerCase().includes(q) ||
        org.adminEmail.toLowerCase().includes(q) ||
        (org.cdsBatch && org.cdsBatch.toLowerCase().includes(q)) ||
        (org.stateLga && org.stateLga.toLowerCase().includes(q))
      );
    });
  }, [organizations, searchOrgQuery]);

  // Roll calls by organization lookup for stats
  const orgRollCallStats = useMemo(() => {
    const map = new Map<string, { active: number; closed: number; total: number }>();
    rollCalls.forEach((rc) => {
      const orgId = rc.orgId || 'unassigned';
      const current = map.get(orgId) || { active: 0, closed: 0, total: 0 };
      const isClosed = rc.status === 'closed' || rc.isClosed;
      if (isClosed) {
        current.closed += 1;
      } else {
        current.active += 1;
      }
      current.total += 1;
      map.set(orgId, current);
    });
    return map;
  }, [rollCalls]);

  // Filtered roll calls
  const filteredRollCalls = useMemo(() => {
    return rollCalls.filter((rc) => {
      const matchesSearch =
        !searchRollCallQuery ||
        rc.name.toLowerCase().includes(searchRollCallQuery.toLowerCase()) ||
        rc.shortCode.toLowerCase().includes(searchRollCallQuery.toLowerCase()) ||
        (rc.organizationName && rc.organizationName.toLowerCase().includes(searchRollCallQuery.toLowerCase()));

      const matchesOrg = selectedOrgFilter === 'all' || rc.orgId === selectedOrgFilter;

      const isClosed = rc.status === 'closed' || rc.isClosed;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isClosed) ||
        (statusFilter === 'closed' && isClosed);

      const matchesDate = !dateFilter || rc.date === dateFilter;

      return matchesSearch && matchesOrg && matchesStatus && matchesDate;
    });
  }, [rollCalls, searchRollCallQuery, selectedOrgFilter, statusFilter, dateFilter]);

  const handleExportCampaignCsv = async (campaign: CampaignWithOrg) => {
    try {
      const attendees: Attendee[] = await getCampaignAttendees(campaign.id);
      if (attendees.length === 0) {
        showToast('warning', 'No attendees found for this session.', 'Export Warning');
        return;
      }

      const matchingOrg = organizations.find((o) => o.id === campaign.orgId) || null;
      exportAttendeesToCsv({
        attendees,
        campaign,
        organization: matchingOrg,
      });

      showToast(
        'success',
        `Exported ${attendees.length} attendance records for "${campaign.name}".`,
        'CSV Export'
      );
    } catch (err) {
      console.error('Error exporting CSV:', err);
      showToast('error', 'Failed to export session CSV.', 'Export Error');
    }
  };

  const handleCreateNewOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgAdminEmail.trim() || !newOrgAdminName.trim()) {
      showToast('warning', 'Please fill in all organization fields.', 'Incomplete');
      return;
    }

    setIsSubmittingOrg(true);
    try {
      const created = await createOrganization(
        newOrgName.trim(),
        `admin_${Date.now()}`,
        newOrgAdminEmail.trim(),
        newOrgAdminName.trim(),
        newOrgAccentColor
      );

      setOrganizations((prev) => [created, ...prev]);
      setIsCreateOrgModalOpen(false);
      setNewOrgName('');
      setNewOrgAdminName('');
      setNewOrgAdminEmail('');
      showToast('success', `Created organization "${created.name}".`, 'Organization Added');
      loadData();
    } catch (err) {
      console.error('Error creating org:', err);
      showToast('error', 'Failed to create organization.', 'Error');
    } finally {
      setIsSubmittingOrg(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Super User Banner */}
      <div className="bg-gradient-to-r from-purple-950/60 via-[#130f24] to-[#0d121b] border-2 border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <span>👑 Super User Command Center</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Global Multi-Tenant Organization &amp; Roll Call Overview
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Logged in as system administrator. Monitor, audit, and manage all registered organizations,
              inspect live and past roll calls, review attendee verifications, and export comprehensive attendance rosters.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsCreateOrgModalOpen(true)}
              className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Register Organization</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              className="p-2.5 rounded-xl bg-[#182133] hover:bg-[#222e47] border border-[#2a3752] text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Global Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Stats Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5 pt-4 border-t border-purple-900/40">
          <div className="bg-[#0f1422]/80 border border-purple-500/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Organizations</span>
              <Building2 className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">{stats.totalOrganizations || organizations.length}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Registered Tenants</span>
          </div>

          <div className="bg-[#0f1422]/80 border border-emerald-500/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Active Roll Calls</span>
              <QrCode className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400 font-mono">{stats.activeCampaigns}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Live Sessions</span>
          </div>

          <div className="bg-[#0f1422]/80 border border-slate-700 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Session History</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">{stats.closedCampaigns}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Archived Sessions</span>
          </div>

          <div className="bg-[#0f1422]/80 border border-sky-500/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">Total Roll Calls</span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">{stats.totalCampaigns || rollCalls.length}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">System-wide Campaigns</span>
          </div>

          <div className="bg-[#0f1422]/80 border border-rose-500/20 rounded-2xl p-3.5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Security Status</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black text-rose-400 font-mono">
              {stats.flaggedTamperedCount > 0 ? `${stats.flaggedTamperedCount} Flagged` : '0 Anomalies'}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Hardware Tamper Engine</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#1f2838] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('orgs')}
          className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === 'orgs'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white bg-[#0e141f] border border-[#1e2738]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>All Organizations ({organizations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rollcalls')}
          className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === 'rollcalls'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white bg-[#0e141f] border border-[#1e2738]'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Master Roll Calls Feed ({rollCalls.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === 'credentials'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'text-purple-300 hover:text-white bg-purple-950/20 border border-purple-800/40'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-purple-400" />
          <span>Super User Profile &amp; Password</span>
        </button>
      </div>

      {/* Tab 1: Organizations Directory */}
      {activeTab === 'orgs' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d121a] border border-[#1e2738] p-3.5 rounded-2xl">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchOrgQuery}
                onChange={(e) => setSearchOrgQuery(e.target.value)}
                placeholder="Search organizations by name, batch, coordinator, LGA..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#141a24] border border-[#232f42] text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
              />
            </div>

            <div className="text-xs font-mono text-slate-400">
              Showing <span className="text-white font-bold">{filteredOrgs.length}</span> of {organizations.length} Organizations
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
              Synchronizing all organization tenants...
            </div>
          ) : filteredOrgs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrgs.map((org) => {
                const orgStats = orgRollCallStats.get(org.id) || { active: 0, closed: 0, total: 0 };
                const accent = org.accentColor || '#00FF66';

                return (
                  <div
                    key={org.id}
                    className="bg-[#0e1420] border border-[#1e293b] hover:border-purple-500/50 rounded-2xl p-5 space-y-4 shadow-md transition-all group flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-black shrink-0"
                            style={{ backgroundColor: accent }}
                          >
                            <Building2 className="w-4 h-4 text-black" />
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                              {org.name}
                            </h3>
                            <span
                              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase inline-block mt-0.5"
                              style={{
                                backgroundColor: `${accent}15`,
                                borderColor: `${accent}40`,
                                color: accent,
                              }}
                            >
                              {org.cdsBatch || 'ACTIVE TENANT'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: accent }}
                            title={`Accent: ${accent}`}
                          />
                        </div>
                      </div>

                      {/* Coordinator & Jurisdiction info */}
                      <div className="bg-[#121927] border border-[#1f2c42] rounded-xl p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Coordinator:</span>
                          <span className="font-semibold text-white">{org.adminName || 'Admin Officer'}</span>
                        </div>
                        {org.adminEmail && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px] truncate">
                            <span>Email:</span>
                            <span className="font-mono text-slate-300 truncate max-w-[170px]">{org.adminEmail}</span>
                          </div>
                        )}
                        {org.stateLga && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span>LGA:</span>
                            <span className="text-slate-300 font-medium">{org.stateLga}</span>
                          </div>
                        )}
                        {org.meetingSchedule && (
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span>Schedule:</span>
                            <span className="text-slate-300">{org.meetingSchedule}</span>
                          </div>
                        )}
                      </div>

                      {/* Roll Call Counts Summary */}
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-[#141b29] border border-[#223049] rounded-xl p-2">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Active Roll Calls</span>
                          <span className="text-base font-black text-white font-mono">{orgStats.active}</span>
                        </div>
                        <div className="bg-[#141b29] border border-[#223049] rounded-xl p-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Archived Sessions</span>
                          <span className="text-base font-black text-white font-mono">{orgStats.closed}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="pt-2 border-t border-[#1a2334] flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectOrganization(org)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
                      >
                        <span>Inspect &amp; Manage Org</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#0e1420] border border-dashed border-[#1f2838] rounded-3xl p-10 text-center space-y-3">
              <Building2 className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Organizations Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No organizations match your search query. Try clearing filters or create a new organization.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Master Roll Calls Feed */}
      {activeTab === 'rollcalls' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#0d121a] border border-[#1e2738] p-4 rounded-2xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchRollCallQuery}
                  onChange={(e) => setSearchRollCallQuery(e.target.value)}
                  placeholder="Search session name, code, org..."
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#141a24] border border-[#232f42] text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                />
              </div>

              {/* Org Filter */}
              <div>
                <select
                  value={selectedOrgFilter}
                  onChange={(e) => setSelectedOrgFilter(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-[#141a24] border border-[#232f42] text-xs font-semibold text-white outline-none focus:border-purple-400"
                >
                  <option value="all">🏢 All Organizations ({organizations.length})</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'closed')}
                  className="w-full py-2 px-3 rounded-xl bg-[#141a24] border border-[#232f42] text-xs font-semibold text-white outline-none focus:border-purple-400"
                >
                  <option value="all">⚡ All Statuses (Active &amp; Closed)</option>
                  <option value="active">🟢 Active Only</option>
                  <option value="closed">📁 Closed History Only</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl bg-[#141a24] border border-[#232f42] text-xs text-white outline-none focus:border-purple-400"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="text-[10px] text-rose-400 hover:underline cursor-pointer shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
              <span>
                Displaying <strong className="text-white">{filteredRollCalls.length}</strong> of {rollCalls.length} total roll calls across all organizations
              </span>
            </div>
          </div>

          {/* Roll Call Cards Grid */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
              Loading master roll calls feed...
            </div>
          ) : filteredRollCalls.length > 0 ? (
            <div className="space-y-3">
              {filteredRollCalls.map((rc) => {
                const isClosed = rc.status === 'closed' || rc.isClosed;
                const orgAccent = rc.organizationAccent || '#00FF66';

                return (
                  <div
                    key={rc.id}
                    className="bg-[#0e1420] border border-[#1e293b] hover:border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 max-w-2xl">
                      {/* Organization tag & Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase"
                          style={{
                            backgroundColor: `${orgAccent}15`,
                            borderColor: `${orgAccent}40`,
                            color: orgAccent,
                          }}
                        >
                          {rc.organizationName || 'Organization'}
                        </span>

                        {isClosed ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            ARCHIVED
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            ACTIVE
                          </span>
                        )}

                        <span className="text-[11px] font-mono text-slate-400">
                          Code: <strong className="text-white uppercase">{rc.shortCode}</strong>
                        </span>
                      </div>

                      {/* Session Name */}
                      <h4 className="text-base font-extrabold text-white tracking-tight">
                        {rc.name}
                      </h4>

                      {/* Metadata Chips */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          <span>{formatWATDate(rc.date)}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-sky-400" />
                          <span>Radius: {rc.allowedRadius}m</span>
                        </span>

                        {rc.timeBlocks && rc.timeBlocks.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{rc.timeBlocks.length} Time Windows</span>
                          </span>
                        )}

                        {rc.adminName && (
                          <span>
                            Coord: <strong className="text-slate-300">{rc.adminName}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions on this roll call */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const matchingOrg = organizations.find((o) => o.id === rc.orgId);
                          onSelectCampaignForRoster(rc, matchingOrg);
                        }}
                        className="py-2 px-3.5 rounded-xl bg-[#151e2d] hover:bg-[#1f2c42] text-slate-200 hover:text-white border border-[#24334a] text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                        title="View roster and attendance logs for this session"
                      >
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        <span>Inspect Roster</span>
                      </button>

                      {!isClosed && (
                        <button
                          type="button"
                          onClick={() => onLaunchCampaignSession(rc)}
                          className="py-2 px-3.5 rounded-xl text-black text-xs font-extrabold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer"
                          style={{ backgroundColor: orgAccent }}
                          title="Open live member QR scanner link"
                        >
                          <QrCode className="w-3.5 h-3.5 text-black" />
                          <span>Launch QR</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportCampaignCsv(rc)}
                        className="py-2 px-3 rounded-xl bg-[#151e2d] hover:bg-[#1f2c42] text-slate-300 hover:text-white border border-[#24334a] text-xs font-bold transition-all cursor-pointer"
                        title="Export CSV attendance report"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#0e1420] border border-dashed border-[#1f2838] rounded-3xl p-10 text-center space-y-3">
              <QrCode className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Roll Calls Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No sessions match the selected filters. Clear your search or date query to see all sessions.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Super User Profile & Password Settings */}
      {activeTab === 'credentials' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <SuperUserSettings />
        </div>
      )}

      {/* Modal: Quick Register Organization (Super User Action) */}
      {isCreateOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101522] border border-[#253248] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2b40]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-white">Register Organization</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOrgModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewOrg} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Organization / CDS Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical CDS, Ikeja LGA"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0d14] border border-[#223048] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Coordinator Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Doe"
                  value={newOrgAdminName}
                  onChange={(e) => setNewOrgAdminName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0d14] border border-[#223048] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Coordinator Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="coordinator@nysc.gov.ng"
                  value={newOrgAdminEmail}
                  onChange={(e) => setNewOrgAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0d14] border border-[#223048] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newOrgAccentColor}
                    onChange={(e) => setNewOrgAccentColor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newOrgAccentColor}
                    onChange={(e) => setNewOrgAccentColor(e.target.value)}
                    className="w-24 px-2 py-1.5 bg-[#0a0d14] border border-[#223048] rounded-lg text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#1f2b40]">
                <button
                  type="button"
                  onClick={() => setIsCreateOrgModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-[#141b26]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrg}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingOrg ? 'Provisioning...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
