import { useState, useEffect, useMemo } from 'react';
import {
  History,
  Calendar,
  Users,
  ShieldCheck,
  Download,
  RotateCcw,
  Search,
  Eye,
  MapPin,
  Lock,
  Edit3,
} from 'lucide-react';
import { Campaign, Attendee, Organization } from '../../types/attendance';
import { getCampaignAttendees } from '../../services/firebase';
import { exportAttendeesToCsv } from '../../utils/csvExport';
import { showToast } from '../common/Toast';
import { formatWATDateTime } from '../../utils/dateUtils';

interface SessionHistoryViewProps {
  closedCampaigns: Campaign[];
  organization: Organization | null;
  accentColor?: string;
  onSelectCampaignForRoster: (campaign: Campaign) => void;
  onReopenCampaign: (campaign: Campaign) => void;
  onEditCampaign?: (campaign: Campaign) => void;
}

interface CampaignStats {
  total: number;
  compliantCount: number;
  complianceRate: number;
}

export function SessionHistoryView({
  closedCampaigns,
  organization,
  accentColor = '#00FF66',
  onSelectCampaignForRoster,
  onReopenCampaign,
  onEditCampaign,
}: SessionHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statsMap, setStatsMap] = useState<Record<string, CampaignStats>>({});
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

  // Pre-load attendee counts and stats for all closed sessions
  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      setLoadingStats(true);
      const newStatsMap: Record<string, CampaignStats> = {};

      await Promise.all(
        closedCampaigns.map(async (camp) => {
          try {
            const records = await getCampaignAttendees(camp.id);
            const total = records.length;
            const compliantCount = records.filter(
              (a) => a.distanceMeters <= (camp.allowedRadius || 100)
            ).length;
            const complianceRate = total > 0 ? Math.round((compliantCount / total) * 100) : 100;

            newStatsMap[camp.id] = {
              total,
              compliantCount,
              complianceRate,
            };
          } catch {
            newStatsMap[camp.id] = { total: 0, compliantCount: 0, complianceRate: 100 };
          }
        })
      );

      if (isMounted) {
        setStatsMap(newStatsMap);
        setLoadingStats(false);
      }
    }

    if (closedCampaigns.length > 0) {
      loadStats();
    } else {
      setLoadingStats(false);
    }

    return () => {
      isMounted = false;
    };
  }, [closedCampaigns]);

  const filteredHistory = useMemo(() => {
    return closedCampaigns.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.date.toLowerCase().includes(q) ||
        c.shortCode.toLowerCase().includes(q)
      );
    });
  }, [closedCampaigns, searchQuery]);

  const handleExportHistoryCampaign = async (campaign: Campaign) => {
    try {
      const records = await getCampaignAttendees(campaign.id);
      if (records.length === 0) {
        showToast('warning', `No attendee records found for ${campaign.name}.`, 'Empty Session');
        return;
      }

      const result = exportAttendeesToCsv({
        attendees: records,
        campaign,
        organization,
      });

      showToast(
        'success',
        `Exported ${result.count} record${result.count === 1 ? '' : 's'} (${result.filename}).`,
        'History CSV Exported'
      );
    } catch (err) {
      console.error('Error exporting history session CSV:', err);
      showToast('error', 'Failed to export session CSV.', 'Export Error');
    }
  };

  if (closedCampaigns.length === 0) {
    return (
      <div className="bg-[#0e141f] border border-[#1e2738] rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto shadow-inner">
          <History className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white">No Past Sessions in History</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            When you complete an active roll call session, click <strong>"End &amp; Close Session"</strong> to archive it here for permanent record-keeping and audit reviews.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top History Banner & Search */}
      <div className="bg-[#0d121a] border border-[#1e2738] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Archived Session History
            </h3>
            <p className="text-xs text-slate-400">
              {closedCampaigns.length} past roll call session{closedCampaigns.length === 1 ? '' : 's'} archived
            </p>
          </div>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            id="input-search-history"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past sessions..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#141a24] border border-[#232f42] text-xs text-white placeholder-slate-500 outline-none focus:border-[#00FF66]"
          />
        </div>
      </div>

      {/* History Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredHistory.map((camp) => {
          const stats = statsMap[camp.id] || { total: 0, compliantCount: 0, complianceRate: 100 };
          const closedDateDisplay = camp.closedAt
            ? formatWATDateTime(camp.closedAt, { includeTimezone: true })
            : `${camp.date} (WAT)`;

          return (
            <div
              key={camp.id}
              className="bg-[#0e131d] border border-[#1e2738] hover:border-[#2a384e] rounded-2xl p-4.5 space-y-3.5 shadow-sm transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>ENDED</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        CODE: {camp.shortCode.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white truncate" title={camp.name}>
                      {camp.name}
                    </h4>
                  </div>
                </div>

                <div className="text-xs text-slate-400 space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Session Date:
                    </span>
                    <span className="font-mono text-slate-200">{camp.date}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Radius:
                    </span>
                    <span className="font-mono text-slate-200">{camp.allowedRadius}m geofence</span>
                  </div>

                  {camp.closedAt && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Closed On:</span>
                      <span>{closedDateDisplay}</span>
                    </div>
                  )}
                </div>

                {/* Metrics Pill Bar */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#18212e]">
                  <div className="bg-[#131924] rounded-xl p-2 text-center border border-[#1f2b3c]">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
                      <Users className="w-3 h-3 text-sky-400" />
                      Attendees
                    </span>
                    <span className="text-base font-black text-white font-mono block">
                      {loadingStats ? '...' : stats.total}
                    </span>
                  </div>

                  <div className="bg-[#131924] rounded-xl p-2 text-center border border-[#1f2b3c]">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#00FF66]" />
                      Verified
                    </span>
                    <span className="text-base font-black text-[#00FF66] font-mono block">
                      {loadingStats ? '...' : `${stats.complianceRate}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for History Items */}
              <div className="pt-2 border-t border-[#18212e] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectCampaignForRoster(camp)}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-[#141c29] hover:bg-[#1d2738] text-slate-200 hover:text-white border border-[#263449] text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                  title="View full attendee roster and photos"
                >
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>View Roster</span>
                </button>

                {onEditCampaign && (
                  <button
                    type="button"
                    onClick={() => onEditCampaign(camp)}
                    className="p-2 rounded-xl bg-[#141c29] hover:bg-[#1d2738] text-slate-200 hover:text-white border border-[#263449] transition-all cursor-pointer"
                    title="Edit session venue, coordinates, radius, or date"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleExportHistoryCampaign(camp)}
                  className="p-2 rounded-xl bg-[#141c29] hover:bg-[#1d2738] text-slate-200 hover:text-white border border-[#263449] transition-all cursor-pointer"
                  title="Export Attendance CSV"
                >
                  <Download className="w-3.5 h-3.5" style={{ color: accentColor }} />
                </button>

                <button
                  type="button"
                  onClick={() => onReopenCampaign(camp)}
                  className="p-2 rounded-xl bg-[#141c29] hover:bg-[#1d2738] text-slate-200 hover:text-white border border-[#263449] transition-all cursor-pointer"
                  title="Re-open Session and return to Active dropdown"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#00FF66]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
