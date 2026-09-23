import React, { useState, useEffect } from 'react';
import {
  X,
  Navigation,
  MapPin,
  Calendar,
  Sparkles,
  Loader2,
  PlusCircle,
  Clock,
  Trash2,
  Sliders,
  CheckCircle2,
  Lock,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { Campaign, Organization, TimeBlock } from '../../types/attendance';
import { FloatingInput } from '../common/FloatingInput';
import { generateShortCode } from '../../utils/nysc';
import { getCurrentCoordinates } from '../../utils/geo';
import { updateCampaign, deleteCampaign } from '../../services/firebase';
import { showToast } from '../common/Toast';

interface EditCampaignModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onCampaignUpdated: (updated: Campaign) => void;
  onCampaignDeleted?: (campaignId: string) => void;
  organization?: Organization | null;
}

const VENUE_PRESETS = [
  { name: 'NYSC Lagos Secretariat (Alausa, Ikeja)', lat: 6.619, lng: 3.358 },
  { name: 'NYSC Abuja National Directorate (Maitama)', lat: 9.0833, lng: 7.495 },
  { name: 'NYSC Oyo State Secretariat (Agodi, Ibadan)', lat: 7.4019, lng: 3.9173 },
  { name: 'NYSC Rivers State Secretariat (Port Harcourt)', lat: 4.8156, lng: 7.0498 },
  { name: 'NYSC Kano State Secretariat', lat: 11.9964, lng: 8.5167 },
  { name: 'NYSC Enugu State Secretariat', lat: 6.4584, lng: 7.5464 },
];

export function EditCampaignModal({
  isOpen,
  campaign,
  onClose,
  onCampaignUpdated,
  onCampaignDeleted,
  organization,
}: EditCampaignModalProps) {
  const [name, setName] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [targetLat, setTargetLat] = useState<string>('');
  const [targetLng, setTargetLng] = useState<string>('');
  const [allowedRadius, setAllowedRadius] = useState<number>(100);
  const [shortCode, setShortCode] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'closed'>('active');
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);

  const [locating, setLocating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Populate form with current campaign data whenever opened
  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setDate(campaign.date);
      setTargetLat(String(campaign.targetLatitude));
      setTargetLng(String(campaign.targetLongitude));
      setAllowedRadius(campaign.allowedRadius || 100);
      setShortCode(campaign.shortCode);
      setStatus(campaign.status === 'closed' || campaign.isClosed ? 'closed' : 'active');
      setTimeBlocks(
        campaign.timeBlocks && campaign.timeBlocks.length > 0
          ? campaign.timeBlocks
          : [
              { id: 'tb_1', code: 'X12', startTime: '08:00', endTime: '09:00', label: 'General Roll Call' },
            ]
      );
      setIsConfirmingDelete(false);
    }
  }, [campaign, isOpen]);

  if (!isOpen || !campaign) return null;

  const handleAddTimeBlock = () => {
    const randomCode = Math.random().toString(36).substring(2, 5).toUpperCase();
    setTimeBlocks((prev) => [
      ...prev,
      {
        id: `tb_${Date.now()}`,
        code: randomCode,
        startTime: '09:00',
        endTime: '10:00',
        label: `Roll Call Window ${prev.length + 1}`,
      },
    ]);
  };

  const handleRemoveTimeBlock = (index: number) => {
    setTimeBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTimeBlock = (index: number, field: keyof TimeBlock, value: string) => {
    setTimeBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, [field]: value } : block))
    );
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentCoordinates();
      setTargetLat(coords.latitude.toFixed(6));
      setTargetLng(coords.longitude.toFixed(6));
      showToast(
        'success',
        `Coordinates updated: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
        'GPS Location Acquired'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to acquire current location.';
      showToast('error', msg, 'GPS Error');
    } finally {
      setLocating(false);
    }
  };

  const handleApplyPreset = (preset: typeof VENUE_PRESETS[0]) => {
    setTargetLat(preset.lat.toFixed(6));
    setTargetLng(preset.lng.toFixed(6));
    showToast('info', `Preset venue applied: ${preset.name}`, 'Venue Coordinates Selected');
  };

  const handleRegenerateCode = () => {
    const newCode = generateShortCode();
    setShortCode(newCode);
    showToast('info', `Generated code: ${newCode}`, 'New Code');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('warning', 'Please enter a session name.', 'Name Required');
      return;
    }

    const lat = parseFloat(targetLat);
    const lng = parseFloat(targetLng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      showToast('error', 'Latitude must be between -90 and 90.', 'Invalid Latitude');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      showToast('error', 'Longitude must be between -180 and 180.', 'Invalid Longitude');
      return;
    }

    if (!shortCode.trim()) {
      showToast('warning', 'Please specify a short code for attendees to connect.', 'Code Required');
      return;
    }

    setSaving(true);
    try {
      const isNowClosed = status === 'closed';
      const updated = await updateCampaign(campaign.id, {
        name: name.trim(),
        date,
        targetLatitude: lat,
        targetLongitude: lng,
        allowedRadius: Number(allowedRadius),
        shortCode: shortCode.toLowerCase().trim(),
        timeBlocks: timeBlocks.length > 0 ? timeBlocks : undefined,
        status,
        isClosed: isNowClosed,
        closedAt: isNowClosed ? campaign.closedAt || new Date().toISOString() : undefined,
      });

      showToast('success', `Session "${updated.name}" updated successfully.`, 'Session Saved');
      onCampaignUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Error updating session:', err);
      showToast('error', 'Failed to update session details.', 'Update Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!campaign) return;
    setDeleting(true);
    try {
      await deleteCampaign(campaign.id);
      showToast('success', `Session "${campaign.name}" removed.`, 'Session Deleted');
      if (onCampaignDeleted) {
        onCampaignDeleted(campaign.id);
      }
      onClose();
    } catch (err) {
      console.error('Error deleting session:', err);
      showToast('error', 'Failed to delete session.', 'Delete Error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      id="modal-edit-session"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div className="bg-[#0f141f] border border-[#232e42] w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-5 border-b border-[#1b2333] flex items-center justify-between bg-[#121824]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66] shadow-[0_0_15px_rgba(0,255,102,0.15)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Edit Roll Call Session</h3>
              <p className="text-xs text-slate-400">
                Update venue geofence, security codes, and session schedules
              </p>
            </div>
          </div>
          <button
            id="btn-close-edit-modal"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a2232] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Switcher Banner */}
          <div className="p-3.5 rounded-2xl bg-[#131a26] border border-[#232f42] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Session Status</span>
              <span className="text-[11px] text-slate-400">
                {status === 'active'
                  ? 'Active roll call session open for verification'
                  : 'Closed / Archived past session in history'}
              </span>
            </div>
            <div className="flex items-center space-x-1 bg-[#0a0d14] p-1 rounded-xl border border-[#1e2738]">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  status === 'active'
                    ? 'bg-[#00FF66] text-[#0a0c10] shadow-[0_0_10px_rgba(0,255,102,0.25)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Active</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('closed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  status === 'closed'
                    ? 'bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Closed</span>
              </button>
            </div>
          </div>

          {/* Session Name & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Session Name / CDS Group
              </label>
              <input
                id="input-edit-session-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Medical CDS Weekly Plenary"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141a24] border border-[#243044] text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Meeting Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="input-edit-session-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#141a24] border border-[#243044] text-xs font-medium text-white focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            </div>
          </div>

          {/* Geofence Location Settings */}
          <div className="p-4 rounded-2xl bg-[#121824] border border-[#212c3e] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#00FF66]" />
                Geofence Center Point (GPS)
              </span>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className="px-2.5 py-1 rounded-lg bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/30 text-[#00FF66] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              >
                {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                <span>{locating ? 'Acquiring...' : 'Use My GPS'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-mono mb-1">Latitude</label>
                <input
                  id="input-edit-session-lat"
                  type="text"
                  required
                  value={targetLat}
                  onChange={(e) => setTargetLat(e.target.value)}
                  placeholder="e.g. 6.6190"
                  className="w-full px-3 py-2 rounded-xl bg-[#0d121b] border border-[#232f42] text-xs font-mono text-white focus:outline-none focus:border-[#00FF66]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-mono mb-1">Longitude</label>
                <input
                  id="input-edit-session-lng"
                  type="text"
                  required
                  value={targetLng}
                  onChange={(e) => setTargetLng(e.target.value)}
                  placeholder="e.g. 3.3580"
                  className="w-full px-3 py-2 rounded-xl bg-[#0d121b] border border-[#232f42] text-xs font-mono text-white focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            </div>

            {/* Presets Quick Picker */}
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                Quick Apply Preset Venue:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {VENUE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-[#182130] hover:bg-[#222e42] text-slate-300 border border-[#2b3952] transition-colors cursor-pointer"
                  >
                    {p.name.split(' ')[0]} {p.name.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Allowed Radius Slider */}
            <div className="pt-2 border-t border-[#1c2536]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-300 font-semibold">Allowed Geofence Radius</span>
                <span className="text-xs font-mono font-bold text-[#00FF66] bg-[#00FF66]/10 px-2 py-0.5 rounded-full border border-[#00FF66]/30">
                  {allowedRadius} meters
                </span>
              </div>
              <input
                id="slider-edit-session-radius"
                type="range"
                min="20"
                max="1000"
                step="10"
                value={allowedRadius}
                onChange={(e) => setAllowedRadius(Number(e.target.value))}
                className="w-full h-1.5 bg-[#1a2333] rounded-lg appearance-none cursor-pointer accent-[#00FF66]"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>20m (Precise)</span>
                <span>100m (Standard NYSC)</span>
                <span>1000m (Wide Area)</span>
              </div>
            </div>
          </div>

          {/* Session Short Code */}
          <div className="p-4 rounded-2xl bg-[#121824] border border-[#212c3e] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white block">
                Session Direct Code / Shortlink
              </label>
              <button
                type="button"
                onClick={handleRegenerateCode}
                className="text-xs text-[#00FF66] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <Sparkles className="w-3 h-3" />
                <span>Randomize Code</span>
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <div className="px-3 py-2 bg-[#090d14] rounded-xl text-slate-400 font-mono text-xs border border-[#1b2434] select-none">
                /#/c/
              </div>
              <input
                id="input-edit-session-code"
                type="text"
                required
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="e.g. med-ikeja"
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#0d121b] border border-[#232f42] text-xs font-mono font-bold text-white focus:outline-none focus:border-[#00FF66]"
              />
            </div>
          </div>

          {/* Roll Call Time Windows / Blocks */}
          <div className="p-4 rounded-2xl bg-[#121824] border border-[#212c3e] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Time Windows &amp; Verification Windows
                </span>
                <span className="text-[10px] text-slate-400">
                  Optional roll call intervals with unique dynamic codes
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddTimeBlock}
                className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold border border-sky-500/30 flex items-center gap-1 transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Window</span>
              </button>
            </div>

            <div className="space-y-2">
              {timeBlocks.map((block, idx) => (
                <div
                  key={block.id || idx}
                  className="p-3 rounded-xl bg-[#0d121b] border border-[#1e2738] flex flex-col sm:flex-row items-center gap-2"
                >
                  <input
                    type="text"
                    value={block.label || ''}
                    onChange={(e) => handleUpdateTimeBlock(idx, 'label', e.target.value)}
                    placeholder="Window Name (e.g. Early Check-in)"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#141a24] border border-[#283549] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                  />

                  <div className="flex items-center gap-1 w-full sm:w-auto">
                    <input
                      type="time"
                      value={block.startTime}
                      onChange={(e) => handleUpdateTimeBlock(idx, 'startTime', e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-[#141a24] border border-[#283549] text-xs font-mono text-white focus:outline-none"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <input
                      type="time"
                      value={block.endTime}
                      onChange={(e) => handleUpdateTimeBlock(idx, 'endTime', e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-[#141a24] border border-[#283549] text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-start">
                    <input
                      type="text"
                      maxLength={4}
                      value={block.code || ''}
                      onChange={(e) =>
                        handleUpdateTimeBlock(idx, 'code', e.target.value.toUpperCase())
                      }
                      placeholder="Code"
                      title="Security Code for this window"
                      className="w-16 px-2 py-1.5 rounded-lg bg-[#141a24] border border-[#283549] text-xs font-mono font-bold text-center text-[#00FF66] uppercase focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveTimeBlock(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                      title="Remove window"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delete Danger Section */}
          {isConfirmingDelete ? (
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/60 space-y-2.5 animate-fade-in">
              <div className="flex items-center gap-2 text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs font-bold">Are you sure you want to delete this session?</span>
              </div>
              <p className="text-[11px] text-slate-400">
                This will remove the session from your admin portal and disable access code resolution.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{deleting ? 'Deleting...' : 'Confirm Delete Session'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-xl bg-[#1a2333] hover:bg-[#253147] text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-950/20 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete this session</span>
              </button>
            </div>
          )}

          {/* Submit Actions */}
          <div className="pt-3 border-t border-[#1c2536] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#17202e] hover:bg-[#202c3f] text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="btn-save-session-changes"
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#00FF66] text-[#0a0c10] text-xs font-extrabold shadow-[0_0_15px_rgba(0,255,102,0.3)] hover:bg-[#00e55b] transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Session Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
