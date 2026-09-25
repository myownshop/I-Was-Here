import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Mail,
  KeyRound,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Crown,
} from 'lucide-react';
import { getSuperUserCredentials, updateSuperUserCredentials } from '../../services/firebase';
import { SuperUserCredentials } from '../../types/attendance';
import { showToast } from '../common/Toast';

interface SuperUserSettingsProps {
  onCredentialsUpdated?: (creds: SuperUserCredentials) => void;
}

export function SuperUserSettings({ onCredentialsUpdated }: SuperUserSettingsProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [currentCreds, setCurrentCreds] = useState<SuperUserCredentials | null>(null);

  // Form fields
  const [username, setUsername] = useState<string>('admin');
  const [displayName, setDisplayName] = useState<string>('Super Administrator');
  const [email, setEmail] = useState<string>('admin@iwashere.internal');
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // UI state
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCreds();
  }, []);

  const loadCreds = async () => {
    setLoading(true);
    try {
      const creds = await getSuperUserCredentials();
      setCurrentCreds(creds);
      setUsername(creds.username || 'admin');
      setDisplayName(creds.name || 'Super Administrator');
      setEmail(creds.email || 'admin@iwashere.internal');
    } catch (err) {
      console.error('Failed to load super user credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // Validation
    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      setStatusMessage({ type: 'error', text: 'Username must be at least 3 characters long.' });
      showToast('error', 'Username must be at least 3 characters long.', 'Validation Error');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 3) {
        setStatusMessage({ type: 'error', text: 'New password must be at least 3 characters long.' });
        showToast('error', 'New password must be at least 3 characters long.', 'Validation Error');
        return;
      }
      if (newPassword !== confirmPassword) {
        setStatusMessage({ type: 'error', text: 'New passwords do not match.' });
        showToast('error', 'New passwords do not match.', 'Password Mismatch');
        return;
      }
      if (!currentPassword) {
        setStatusMessage({ type: 'error', text: 'Please enter your current password to authorize changes.' });
        showToast('error', 'Please enter your current password to authorize changes.', 'Current Password Required');
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await updateSuperUserCredentials({
        username: cleanUsername,
        name: displayName.trim(),
        email: email.trim(),
        password: newPassword ? newPassword.trim() : undefined,
        currentPassword: newPassword || currentPassword ? currentPassword.trim() : undefined,
      });

      setCurrentCreds(updated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setStatusMessage({
        type: 'success',
        text: `Super User profile and security credentials updated successfully! New username: "${updated.username}"`,
      });
      showToast('success', `Super User credentials updated! Login username: ${updated.username}`, 'Credentials Saved');

      if (onCredentialsUpdated) {
        onCredentialsUpdated(updated);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update super user credentials.';
      setStatusMessage({ type: 'error', text: msg });
      showToast('error', msg, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0e1320] border border-purple-500/30 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-purple-900/40">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Crown className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">Super User Profile &amp; Security</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300">
                ADMIN ROOT
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage master administrative username, password, display name, and system credentials.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadCreds}
          disabled={loading}
          className="p-2 rounded-xl bg-[#141b27] hover:bg-[#1a2436] text-purple-300 hover:text-white border border-purple-900/40 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          title="Reload credentials"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload</span>
        </button>
      </div>

      {/* Active Credential Info Bar */}
      <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-purple-400" />
          <span className="text-slate-300">Active Login Username:</span>
          <code className="px-2 py-0.5 rounded bg-[#0b0f17] border border-purple-500/30 font-mono font-bold text-purple-200">
            {currentCreds?.username || 'admin'}
          </code>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span>Role: <strong className="text-purple-300">Global Super Admin</strong></span>
          <span>•</span>
          <span>Access: <strong className="text-emerald-400">All Organizations &amp; Sessions</strong></span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleUpdateAccount} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Username Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 block flex items-center justify-between">
              <span>Super User Username *</span>
              <span className="text-[10px] text-purple-400">Used to sign in</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="input-superuser-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or custom_superuser"
                className="w-full bg-[#0a0d14] border border-[#212c3e] focus:border-purple-500 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              You will use this username (or email) with your password to log in as Super User.
            </p>
          </div>

          {/* Display Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 block">
              Super Admin Display Name
            </label>
            <div className="relative">
              <Sparkles className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <input
                id="input-superuser-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Super Administrator"
                className="w-full bg-[#0a0d14] border border-[#212c3e] focus:border-purple-500 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-500">Shown in the system header and audit reports.</p>
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-200 block">
            Super Administrator Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            <input
              id="input-superuser-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@iwashere.internal"
              className="w-full bg-[#0a0d14] border border-[#212c3e] focus:border-purple-500 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Change Password Section */}
        <div className="pt-4 border-t border-[#1b2434] space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Change Super User Password
            </h3>
            <span className="text-[10px] text-slate-400">(Leave blank to keep current password)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Current Password (verification) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Current Password {newPassword ? '*' : ''}
              </label>
              <div className="relative">
                <input
                  id="input-superuser-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full bg-[#0a0d14] border border-[#212c3e] focus:border-purple-500 rounded-xl pl-3 pr-8 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                New Password
              </label>
              <div className="relative">
                <input
                  id="input-superuser-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 3 chars)"
                  className="w-full bg-[#0a0d14] border border-[#212c3e] focus:border-purple-500 rounded-xl pl-3 pr-8 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="input-superuser-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={`w-full bg-[#0a0d14] border rounded-xl pl-3 pr-8 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none transition-colors ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-rose-500'
                      : 'border-[#212c3e] focus:border-purple-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1b2434]">
          <button
            id="btn-save-superuser-credentials"
            type="submit"
            disabled={saving || loading}
            className="py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Updating Credentials...' : 'Save Super User Profile & Password'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
