import { useState } from 'react';
import {
  Building2,
  User,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Save,
  Palette,
  AlertTriangle,
  Compass,
  Check,
  Share2,
  Trash2,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Organization } from '../../types/attendance';
import { updateOrganization, clearOrganizationCampaignsAndAttendees } from '../../services/firebase';
import { showToast } from '../common/Toast';
import { ShareQRModal } from '../common/ShareQRModal';

interface OrganizationSettingsProps {
  organization: Organization;
  onOrganizationUpdated: (updated: Organization) => void;
  onDataPurged?: () => void;
  isFirstSetup?: boolean;
  onCompleteSetup?: () => void;
}

const PRESET_COLORS = [
  { name: 'Neon Green', hex: '#00FF66' },
  { name: 'Electric Blue', hex: '#3B82F6' },
  { name: 'Cyber Violet', hex: '#8B5CF6' },
  { name: 'Neon Pink', hex: '#EC4899' },
  { name: 'Amber Gold', hex: '#F59E0B' },
  { name: 'Cyan Glow', hex: '#06B6D4' },
];

export function OrganizationSettings({
  organization,
  onOrganizationUpdated,
  onDataPurged,
  isFirstSetup = false,
  onCompleteSetup,
}: OrganizationSettingsProps) {
  // Form state
  const [name, setName] = useState(organization.name || '');
  const [adminName, setAdminName] = useState(organization.adminName || '');
  const [adminEmail, setAdminEmail] = useState(organization.adminEmail || '');
  const [cdsBatch, setCdsBatch] = useState(organization.cdsBatch || '');
  const [stateLga, setStateLga] = useState(organization.stateLga || '');
  const [meetingSchedule, setMeetingSchedule] = useState(organization.meetingSchedule || '');
  const [description, setDescription] = useState(organization.description || '');

  // Venue Defaults
  const [defaultVenueName, setDefaultVenueName] = useState(organization.defaultVenueName || '');
  const [defaultLatitude, setDefaultLatitude] = useState<string>(
    organization.defaultLatitude !== undefined ? String(organization.defaultLatitude) : '6.5954'
  );
  const [defaultLongitude, setDefaultLongitude] = useState<string>(
    organization.defaultLongitude !== undefined ? String(organization.defaultLongitude) : '3.3421'
  );
  const [defaultRadius, setDefaultRadius] = useState<number>(organization.defaultRadius || 100);

  // Color
  const [accentColor, setAccentColor] = useState(organization.accentColor || '#00FF66');

  // UI state
  const [saving, setSaving] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Handle GPS detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      showToast('error', 'Geolocation is not supported by your browser.', 'GPS Unavailable');
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setDefaultLatitude(String(lat));
        setDefaultLongitude(String(lng));
        showToast(
          'success',
          `Captured coordinates: ${lat}, ${lng} (±${Math.round(pos.coords.accuracy)}m)`,
          'GPS Coordinates Set'
        );
      },
      (err) => {
        setDetectingGps(false);
        showToast('error', `Could not detect GPS: ${err.message}`, 'GPS Error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Save
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!name.trim()) {
      showToast('error', 'Organization name is required.', 'Validation Error');
      return;
    }

    if (!adminName.trim()) {
      showToast('error', 'Coordinator name is required.', 'Validation Error');
      return;
    }

    setSaving(true);
    try {
      const latNum = parseFloat(defaultLatitude);
      const lngNum = parseFloat(defaultLongitude);

      const updates: Partial<Organization> = {
        name: name.trim(),
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        accentColor: accentColor || '#00FF66',
        stateLga: stateLga.trim(),
        cdsBatch: cdsBatch.trim(),
        meetingSchedule: meetingSchedule.trim(),
        description: description.trim(),
        defaultVenueName: defaultVenueName.trim(),
        defaultLatitude: isNaN(latNum) ? undefined : latNum,
        defaultLongitude: isNaN(lngNum) ? undefined : lngNum,
        defaultRadius: defaultRadius || 100,
      };

      const updated = await updateOrganization(organization.id, updates);
      onOrganizationUpdated(updated);
      showToast('success', 'Organization profile & settings updated successfully!', 'Saved');

      if (isFirstSetup && onCompleteSetup) {
        onCompleteSetup();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update organization.';
      showToast('error', msg, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  // Handle Clear Data
  const handleConfirmClearData = async () => {
    setClearing(true);
    try {
      const res = await clearOrganizationCampaignsAndAttendees(organization.id);
      setIsClearModalOpen(false);
      showToast(
        'success',
        `Successfully cleared ${res.deletedCampaigns} session(s) and all attendee records.`,
        'Database Cleared'
      );
      if (onDataPurged) {
        onDataPurged();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear data.';
      showToast('error', msg, 'Error');
    } finally {
      setClearing(false);
    }
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/attend` : '';

  return (
    <div id="organization-settings-page" className="space-y-6 animate-in fade-in duration-200">
      {/* First Stop Welcome Banner */}
      {isFirstSetup && (
        <div
          className="p-5 rounded-3xl border shadow-xl relative overflow-hidden"
          style={{
            backgroundColor: `${accentColor}10`,
            borderColor: `${accentColor}40`,
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  Welcome to Your Coordinator Portal
                </h2>
                <p className="text-xs text-slate-300">
                  Please fill in your official CDS or organization details below to finish setup and
                  avoid placeholder data.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span
                className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  borderColor: `${accentColor}40`,
                }}
              >
                First-Time Setup
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1b2332]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold mb-1" style={{ color: accentColor }}>
            <Building2 className="w-3.5 h-3.5" />
            <span>COORDINATOR PORTAL SETTINGS</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Organization Profile &amp; Venue
          </h1>
          <p className="text-xs text-slate-400">
            Configure your CDS body, meeting schedule, default GPS geofence, and brand theme.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            id="btn-share-org-qr"
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="py-2.5 px-3.5 rounded-xl bg-[#141b26] hover:bg-[#1f2838] border border-[#27344a] text-white text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Share Portal QR</span>
          </button>

          <button
            id="btn-save-settings"
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer shadow-lg text-[#0a0c10] disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            <Save className="w-3.5 h-3.5 text-black" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Organization & CDS Identity */}
        <div className="bg-[#0e141f] rounded-2xl border border-[#1e2838] p-5 shadow-lg space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-[#1a2332]">
            <Building2 className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              1. Organization &amp; CDS Details
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="input-org-name"
                className="text-xs font-bold text-slate-300 block flex items-center justify-between"
              >
                <span>Organization / CDS Name *</span>
                <span className="text-[10px] text-slate-500">e.g. Digital Literacy CDS</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  id="input-org-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Digital Literacy CDS, Ikeja"
                  className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-cds-batch"
                className="text-xs font-bold text-slate-300 block flex items-center justify-between"
              >
                <span>CDS Batch / Stream</span>
                <span className="text-[10px] text-slate-500">e.g. 2024 Batch B Stream 1</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  id="input-cds-batch"
                  type="text"
                  value={cdsBatch}
                  onChange={(e) => setCdsBatch(e.target.value)}
                  placeholder="e.g. 2024 Batch B Stream 1"
                  className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-state-lga"
                className="text-xs font-bold text-slate-300 block flex items-center justify-between"
              >
                <span>State &amp; Local Government Area (LGA)</span>
                <span className="text-[10px] text-slate-500">e.g. Lagos State • Ikeja LGA</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  id="input-state-lga"
                  type="text"
                  value={stateLga}
                  onChange={(e) => setStateLga(e.target.value)}
                  placeholder="e.g. Lagos State • Ikeja LGA"
                  className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-meeting-schedule"
                className="text-xs font-bold text-slate-300 block flex items-center justify-between"
              >
                <span>Regular Meeting Schedule</span>
                <span className="text-[10px] text-slate-500">e.g. Thursdays 9:00 AM</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  id="input-meeting-schedule"
                  type="text"
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                  placeholder="e.g. Every Thursday • 9:00 AM - 12:00 PM"
                  className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label
              htmlFor="input-org-desc"
              className="text-xs font-bold text-slate-300 block flex items-center justify-between"
            >
              <span>Organization Purpose &amp; Attendance Guidelines</span>
              <span className="text-[10px] text-slate-500">Visible to attendees</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <textarea
                id="input-org-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Official attendance record for our CDS group. All corps members must physically arrive at the council hall within the geofence perimeter."
                className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Coordinator Profile */}
        <div className="bg-[#0e141f] rounded-2xl border border-[#1e2838] p-5 shadow-lg space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-[#1a2332]">
            <User className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              2. Coordinator / Admin Profile
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="input-admin-name" className="text-xs font-bold text-slate-300 block">
                Coordinator Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  id="input-admin-name"
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Dr. Kelechi Nwosu"
                  className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="input-admin-email" className="text-xs font-bold text-slate-300 block">
                Coordinator Email (Official)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  id="input-admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="coordinator@domain.com"
                  className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Default Meeting Venue & Geofence GPS Coordinates */}
        <div className="bg-[#0e141f] rounded-2xl border border-[#1e2838] p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1a2332] gap-2">
            <div className="flex items-center space-x-2.5">
              <Compass className="w-4 h-4" style={{ color: accentColor }} />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  3. Default Meeting Venue &amp; Geofence Coordinates
                </h3>
                <p className="text-[11px] text-slate-400">
                  Pre-fills new attendance sessions automatically with your regular venue target.
                </p>
              </div>
            </div>

            <button
              id="btn-detect-venue-gps"
              type="button"
              onClick={handleDetectGPS}
              disabled={detectingGps}
              className="py-1.5 px-3 rounded-xl bg-[#172130] hover:bg-[#202c40] border border-[#29364a] text-xs font-semibold text-slate-200 hover:text-white flex items-center space-x-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Compass
                className={`w-3.5 h-3.5 ${detectingGps ? 'animate-spin' : ''}`}
                style={{ color: accentColor }}
              />
              <span>{detectingGps ? 'Capturing GPS...' : 'Use My Current Location'}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="input-venue-name" className="text-xs font-bold text-slate-300 block">
              Default Physical Venue Name
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                id="input-venue-name"
                type="text"
                value={defaultVenueName}
                onChange={(e) => setDefaultVenueName(e.target.value)}
                placeholder="e.g. Ikeja Local Government Council Secretariat Hall"
                className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="input-default-lat" className="text-xs font-bold text-slate-300 block">
                Target Latitude
              </label>
              <input
                id="input-default-lat"
                type="number"
                step="0.000001"
                value={defaultLatitude}
                onChange={(e) => setDefaultLatitude(e.target.value)}
                placeholder="e.g. 6.5954"
                className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="input-default-lng" className="text-xs font-bold text-slate-300 block">
                Target Longitude
              </label>
              <input
                id="input-default-lng"
                type="number"
                step="0.000001"
                value={defaultLongitude}
                onChange={(e) => setDefaultLongitude(e.target.value)}
                placeholder="e.g. 3.3421"
                className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#00FF66] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-default-radius"
                className="text-xs font-bold text-slate-300 block flex items-center justify-between"
              >
                <span>Allowed Radius (m)</span>
                <span className="font-mono text-xs" style={{ color: accentColor }}>
                  {defaultRadius} meters
                </span>
              </label>
              <select
                id="input-default-radius"
                value={defaultRadius}
                onChange={(e) => setDefaultRadius(Number(e.target.value))}
                className="w-full bg-[#090c12] border border-[#212c3e] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00FF66] transition-colors"
              >
                <option value={50}>50 meters (Tight Room/Office)</option>
                <option value={100}>100 meters (Standard Hall/Compound)</option>
                <option value={150}>150 meters (Multi-building Center)</option>
                <option value={200}>200 meters (Large Field/Campus)</option>
                <option value={300}>300 meters (Wide Area)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Branding & Accent Color */}
        <div className="bg-[#0e141f] rounded-2xl border border-[#1e2838] p-5 shadow-lg space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-[#1a2332]">
            <Palette className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              4. Brand Palette &amp; Theme
            </h3>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 block">
              Choose Primary Accent Color
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map((color) => {
                const isSelected = accentColor.toUpperCase() === color.hex.toUpperCase();
                return (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setAccentColor(color.hex)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-white bg-[#192231] shadow-md'
                        : 'border-[#232f42] bg-[#0c1017] hover:border-slate-500'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-inner"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-slate-200">{color.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Hex */}
            <div className="pt-2 flex items-center space-x-3">
              <label htmlFor="input-custom-hex" className="text-xs text-slate-400 font-medium">
                Custom Hex:
              </label>
              <div className="flex items-center space-x-2 bg-[#090c12] border border-[#212c3e] rounded-xl px-2.5 py-1.5">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                <input
                  id="input-custom-hex"
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-20 bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                  maxLength={7}
                />
              </div>

              {/* Preview Tag */}
              <div
                className="py-1 px-3 rounded-lg border text-xs font-bold"
                style={{
                  backgroundColor: `${accentColor}18`,
                  color: accentColor,
                  borderColor: `${accentColor}40`,
                }}
              >
                Live Preview Tag
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Data Management & Danger Zone */}
        <div className="bg-[#0e141f] rounded-2xl border border-red-900/30 p-5 shadow-lg space-y-3">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-red-900/20">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">
              5. Data Management (Danger Zone)
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h4 className="text-xs font-bold text-white">Reset &amp; Clear All Sessions &amp; Records</h4>
              <p className="text-[11px] text-slate-400 max-w-md">
                Deletes all attendance campaigns, short codes, and attendee rosters belonging to this
                organization in Firestore. Organization credentials will be preserved.
              </p>
            </div>

            <button
              id="btn-open-clear-data-modal"
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="py-2 px-3.5 rounded-xl bg-red-950/40 hover:bg-red-950/70 border border-red-800/60 text-red-300 text-xs font-bold flex items-center space-x-2 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Clear Stored Data</span>
            </button>
          </div>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-slate-500">
            Changes take effect immediately across all attendee roll-call links.
          </p>

          <button
            id="btn-save-settings-bottom"
            type="submit"
            disabled={saving}
            className="py-3 px-6 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition-all cursor-pointer shadow-xl text-[#0a0c10] disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            <Save className="w-4 h-4 text-black" />
            <span>{saving ? 'Saving Changes...' : isFirstSetup ? 'Complete Setup & Continue' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

      {/* Share Organization Portal QR Modal */}
      <ShareQRModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={`${name || 'Organization'} Attendance`}
        subtitle={`${stateLga || ''} ${cdsBatch ? '• ' + cdsBatch : ''}`}
        shareUrl={shareUrl}
        accentColor={accentColor}
      />

      {/* Confirm Clear Data Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0e141f] border border-red-900/40 rounded-3xl p-6 shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="w-9 h-9 rounded-2xl bg-red-950/80 border border-red-800/80 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Clear Stored Attendance Data?</h3>
                <p className="text-xs text-red-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to purge all attendance sessions, short codes, and attendee
              records for <strong>{name}</strong>? This gives you a completely clean slate for your
              new batch or meeting schedule.
            </p>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="py-2 px-3.5 rounded-xl bg-[#141b26] hover:bg-[#1f2838] border border-[#27344a] text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                id="btn-confirm-clear-data"
                type="button"
                onClick={handleConfirmClearData}
                disabled={clearing}
                className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{clearing ? 'Clearing...' : 'Yes, Delete All Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
