import React, { useState } from 'react';
import { X, Navigation, MapPin, Calendar, Sparkles, Loader2, PlusCircle } from 'lucide-react';
import { Campaign } from '../../types/attendance';
import { FloatingInput } from '../common/FloatingInput';
import { generateShortCode } from '../../utils/nysc';
import { getCurrentCoordinates } from '../../utils/geo';
import { createCampaign } from '../../services/firebase';
import { showToast } from '../common/Toast';

interface CreateCampaignModalProps {
  isOpen: boolean;
  orgId: string;
  onClose: () => void;
  onCampaignCreated: (campaign: Campaign) => void;
}

// Preset venues in Nigeria for quick coordinator setup
const VENUE_PRESETS = [
  { name: 'NYSC Lagos Secretariat (Alausa, Ikeja)', lat: 6.6190, lng: 3.3580 },
  { name: 'NYSC Abuja National Directorate (Maitama)', lat: 9.0833, lng: 7.4950 },
  { name: 'NYSC Oyo State Secretariat (Agodi, Ibadan)', lat: 7.4019, lng: 3.9173 },
  { name: 'NYSC Rivers State Secretariat (Port Harcourt)', lat: 4.8156, lng: 7.0498 },
];

export function CreateCampaignModal({
  isOpen,
  orgId,
  onClose,
  onCampaignCreated,
}: CreateCampaignModalProps) {
  const today = new Date().toISOString().split('T')[0];

  const [name, setName] = useState<string>('');
  const [date, setDate] = useState<string>(today);
  const [targetLat, setTargetLat] = useState<string>('6.5954');
  const [targetLng, setTargetLng] = useState<string>('3.3421');
  const [allowedRadius, setAllowedRadius] = useState<number>(100);
  const [shortCode, setShortCode] = useState<string>(generateShortCode());

  const [locating, setLocating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  // Use Current GPS coordinates
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const coords = await getCurrentCoordinates();
      setTargetLat(coords.latitude.toFixed(6));
      setTargetLng(coords.longitude.toFixed(6));
      showToast('success', `GPS coordinates locked: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`, 'Location Acquired');
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
    showToast('info', `Preset applied: ${preset.name}`, 'Venue Selected');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('warning', 'Please enter a campaign name (e.g. SDGs CDS Weekly Plenary).', 'Name Required');
      return;
    }

    const lat = parseFloat(targetLat);
    const lng = parseFloat(targetLng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      showToast('error', 'Latitude must be a valid number between -90 and 90.', 'Invalid Latitude');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      showToast('error', 'Longitude must be a valid number between -180 and 180.', 'Invalid Longitude');
      return;
    }

    setSaving(true);
    try {
      const created = await createCampaign({
        orgId,
        name: name.trim(),
        date,
        targetLatitude: lat,
        targetLongitude: lng,
        allowedRadius: Number(allowedRadius),
        shortCode: shortCode.toLowerCase().trim(),
      });

      showToast('success', `Created session: ${created.name} (${created.shortCode})`, 'Campaign Live');
      onCampaignCreated(created);
      onClose();
    } catch (err) {
      console.error('Create campaign error:', err);
      showToast('error', 'Failed to save campaign. Please check connection.', 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="create-campaign-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-[#0e131d] border border-[#212c3e] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1f2838] mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-[#00FF66]">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Create CDS Attendance Session</h3>
              <p className="text-xs text-slate-400">Configure geofence coordinates and short code</p>
            </div>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2331] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campaign Name */}
          <FloatingInput
            id="input-campaign-name"
            label="Campaign Name (e.g. SDGs CDS Weekly Plenary)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Date Picker */}
          <div className="bg-[#0a0d14] rounded-xl p-3 border border-[#1e2738]">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
              CDS Meeting Date
            </label>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#00FF66]" />
              <input
                id="input-campaign-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-sm text-white font-medium outline-none"
                required
              />
            </div>
          </div>

          {/* Coordinates Section */}
          <div className="bg-[#0a0d14] rounded-xl p-3.5 border border-[#1e2738] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#00FF66]" />
                Target Venue Coordinates
              </span>

              {/* Use current GPS location */}
              <button
                id="btn-use-current-gps"
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locating}
                className="px-2.5 py-1 rounded-lg bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/30 text-[#00FF66] text-xs font-semibold flex items-center space-x-1 transition-all"
              >
                {locating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Navigation className="w-3 h-3" />
                )}
                <span>Use My GPS</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">Latitude</label>
                <input
                  id="input-target-lat"
                  type="number"
                  step="0.000001"
                  value={targetLat}
                  onChange={(e) => setTargetLat(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg bg-[#121721] border border-[#232d3d] text-xs font-mono text-white outline-none focus:border-[#00FF66]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1">Longitude</label>
                <input
                  id="input-target-lng"
                  type="number"
                  step="0.000001"
                  value={targetLng}
                  onChange={(e) => setTargetLng(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg bg-[#121721] border border-[#232d3d] text-xs font-mono text-white outline-none focus:border-[#00FF66]"
                  required
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <span className="text-[10px] text-slate-500 block mb-1">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {VENUE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-[10px] px-2 py-1 rounded-md bg-[#161d28] hover:bg-[#1e2736] text-slate-300 hover:text-white border border-[#263347] transition-all"
                  >
                    {preset.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Allowed Radius */}
          <div className="bg-[#0a0d14] rounded-xl p-3.5 border border-[#1e2738]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Allowed Geofence Radius
              </span>
              <span className="font-mono text-xs font-bold text-[#00FF66]">
                {allowedRadius} meters
              </span>
            </div>

            <input
              id="slider-allowed-radius"
              type="range"
              min="20"
              max="500"
              step="10"
              value={allowedRadius}
              onChange={(e) => setAllowedRadius(Number(e.target.value))}
              className="w-full accent-[#00FF66] bg-[#1a2230] h-1.5 rounded-lg cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>20m (Strict)</span>
              <span>100m (Standard)</span>
              <span>500m (Broad)</span>
            </div>
          </div>

          {/* 5-char Short Code */}
          <div className="bg-[#0a0d14] rounded-xl p-3.5 border border-[#1e2738] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">
                5-Character Short Code
              </span>
              <span className="text-[11px] text-slate-500">Auto-generated fallback link</span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="input-short-code"
                type="text"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5))}
                maxLength={5}
                className="w-24 py-1.5 px-2 rounded-lg bg-[#141a24] border border-[#232f42] text-center font-mono text-sm font-bold uppercase text-[#00FF66] outline-none"
              />
              <button
                type="button"
                onClick={() => setShortCode(generateShortCode())}
                className="p-1.5 rounded-lg bg-[#18202d] text-slate-300 hover:text-white"
                title="Regenerate random code"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#00FF66]" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <button
              id="btn-cancel-create-campaign"
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-[#141b26] hover:bg-[#1a2332] text-slate-300 text-xs font-semibold border border-[#222d3d]"
            >
              Cancel
            </button>
            <button
              id="btn-submit-create-campaign"
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#00FF66] hover:bg-[#00e55b] text-[#0a0c10] text-xs font-extrabold flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(0,255,102,0.3)]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              <span>{saving ? 'Creating...' : 'Create & Generate QR'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
