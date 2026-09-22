import { useState } from 'react';
import { Shield, Building2, User, Mail, Lock, Palette, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { signUpAdmin, signInAdmin, signInWithGoogle } from '../../services/firebase';
import { Organization, UserProfile } from '../../types/attendance';
import { useToast } from '../common/Toast';

interface AuthPageProps {
  onAuthSuccess: (org: Organization, profile?: UserProfile, isNewSignUp?: boolean) => void;
  onNavigateToAttend?: () => void;
  onNavigateToHome?: () => void;
}

const PRESET_COLORS = [
  { name: 'Neon Green', hex: '#00FF66' },
  { name: 'Electric Blue', hex: '#3B82F6' },
  { name: 'Cyber Purple', hex: '#8B5CF6' },
  { name: 'Neon Pink', hex: '#EC4899' },
  { name: 'Amber Gold', hex: '#F59E0B' },
  { name: 'Cyan Glow', hex: '#06B6D4' },
];

export function AuthPage({ onAuthSuccess, onNavigateToAttend, onNavigateToHome }: AuthPageProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign up fields
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [accentColor, setAccentColor] = useState('#00FF66');

  // Password visibility states
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  const { showToast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminName.trim() || !email.trim() || !password || !orgName.trim()) {
      setError('Please fill in all required registration fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password identically in both fields.');
      return;
    }

    try {
      setLoading(true);
      const res = await signUpAdmin(adminName, email, password, orgName, accentColor);
      showToast('success', `Welcome! Organization "${res.org.name}" has been registered.`);
      onAuthSuccess(res.org, res.profile, true);
    } catch (err: unknown) {
      const originalMsg = err instanceof Error ? err.message : 'Registration failed.';
      let msg = originalMsg;
      if (originalMsg.includes('auth/operation-not-allowed')) {
        msg = 'Email/Password sign-in is not enabled in Firebase Console. Please enable "Email/Password" under Firebase Console -> Authentication -> Sign-in method, or sign in using Google.';
      }
      setError(msg);
      showToast('error', msg, 'Sign Up Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await signInAdmin(email, password);
      if (res.org) {
        showToast('success', `Signed in as admin for ${res.org.name}`);
        onAuthSuccess(res.org, undefined, false);
      } else {
        setError('No organization linked to this account.');
      }
    } catch (err: unknown) {
      const originalMsg = err instanceof Error ? err.message : 'Authentication failed.';
      let msg = originalMsg;
      if (originalMsg.includes('auth/operation-not-allowed')) {
        msg = 'Email/Password sign-in is not enabled in Firebase Console. Please enable "Email/Password" under Firebase Console -> Authentication -> Sign-in method, or sign in using Google.';
      }
      setError(msg);
      showToast('error', msg, 'Sign In Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      setLoading(true);
      const res = await signInWithGoogle();
      if (res.org) {
        showToast('success', `Authenticated as ${res.org.adminName}`);
        const isNew = !res.org.stateLga && !res.org.cdsBatch;
        onAuthSuccess(res.org, undefined, isNew);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full px-4 py-6">
      {onNavigateToHome && (
        <button
          type="button"
          onClick={onNavigateToHome}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-4 cursor-pointer py-1 px-2 rounded-lg hover:bg-[#141b26]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </button>
      )}

      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/30 mb-3 shadow-[0_0_20px_rgba(0,255,102,0.2)]">
          <Shield className="w-6 h-6 text-[#00FF66]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          IWasHere <span className="text-[#00FF66]">SaaS</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
          Multi-tenant attendance infrastructure with biometric verification & geofencing
        </p>
      </div>

      {/* Auth Card */}
      <div className="bg-[#10151f] border border-[#1e2638] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />

        {/* Tab switch */}
        <div className="flex bg-[#0a0c12] p-1 rounded-xl border border-[#1e2638] mb-6">
          <button
            id="tab-btn-signup"
            type="button"
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'signup'
                ? 'bg-[#182133] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Organization
          </button>
          <button
            id="tab-btn-signin"
            type="button"
            onClick={() => {
              setTab('signin');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'signin'
                ? 'bg-[#182133] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin Sign In
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
            <span className="shrink-0 font-bold">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Sign Up Form */}
        {tab === 'signup' ? (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Coordinator Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="input-admin-name"
                  type="text"
                  required
                  placeholder="Full Name"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Organization / CDS Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="input-org-name"
                  type="text"
                  required
                  placeholder="Organization Name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                This name will be dynamically displayed on your members' attendance verification page.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="input-email"
                  type="email"
                  required
                  placeholder="coordinator@organization.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="input-password"
                    type={showSignUpPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5 rounded"
                    title={showSignUpPassword ? 'Hide password' : 'View password'}
                  >
                    {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    id="input-confirm-password"
                    type={showSignUpConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Re-type password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-9 pr-10 py-2.5 bg-[#0a0c12] border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-rose-500/80 focus:border-rose-500'
                        : 'border-[#1f283a] focus:border-[#00FF66]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5 rounded"
                    title={showSignUpConfirmPassword ? 'Hide password' : 'View password'}
                  >
                    {showSignUpConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Brand Accent Color Picker */}
            <div className="p-3.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Custom Brand Accent Color</span>
                </span>
                <span className="font-mono text-xs text-slate-400">{accentColor}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setAccentColor(preset.hex)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border"
                    style={{
                      backgroundColor: accentColor === preset.hex ? `${preset.hex}22` : 'transparent',
                      borderColor: accentColor === preset.hex ? preset.hex : '#2a354a',
                      color: accentColor === preset.hex ? preset.hex : '#94a3b8',
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1e2638]">
                <label className="text-[11px] text-slate-400">Custom Hex:</label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-24 px-2 py-1 bg-[#10151f] border border-[#2a354a] rounded text-xs font-mono text-white"
                />
              </div>
            </div>

            <button
              id="btn-submit-signup"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm text-[#0a0c10] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {loading ? (
                <span>Provisioning Tenant...</span>
              ) : (
                <>
                  <span>Create Organization & Launch Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Sign In Form */
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="input-signin-email"
                  type="email"
                  required
                  placeholder="coordinator@organization.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="input-signin-password"
                  type={showSignInPassword ? 'text' : 'password'}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5 rounded"
                  title={showSignInPassword ? 'Hide password' : 'View password'}
                >
                  {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-submit-signin"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-[#00FF66] text-[#0a0c10] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? <span>Signing In...</span> : <span>Sign In to Dashboard</span>}
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-[#1e2638] w-full" />
              <span className="bg-[#10151f] px-2 text-[10px] uppercase font-bold text-slate-500 shrink-0">
                Or
              </span>
            </div>

            <button
              id="btn-google-signin"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-white bg-[#182133] hover:bg-[#202c44] border border-[#2a3752] flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>
        )}
      </div>

      {/* Back to attendee flow link */}
      <div className="text-center mt-4">
        <button
          id="btn-back-to-attendee"
          type="button"
          onClick={onNavigateToAttend}
          className="text-xs text-slate-400 hover:text-white underline inline-flex items-center gap-1"
        >
          <span>Looking to mark attendance instead? Go to Member Scan</span>
        </button>
      </div>
    </div>
  );
}
