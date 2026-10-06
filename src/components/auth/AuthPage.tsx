import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Shield,
  Building2,
  User,
  Mail,
  Lock,
  Palette,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  QrCode,
  Tag,
} from 'lucide-react';
import {
  signUpAdmin,
  signInAdmin,
  signInWithGoogle,
  signInWithGoogleRedirect,
  checkGoogleRedirectResult,
  getReadableFirebaseError,
  getFirebaseConfigStatus,
} from '../../services/firebase';
import { Organization, UserProfile } from '../../types/attendance';
import { useToast } from '../common/Toast';

interface AuthPageProps {
  onAuthSuccess: (org: Organization, profile?: UserProfile, isNewSignUp?: boolean) => void;
  onNavigateToAttend?: () => void;
  onNavigateToHome?: () => void;
}

export interface CategoryPreset {
  id: string;
  name: string;
  userLabel: string;
  idLabel: string;
  sessionLabel: string;
  defaultColor: string;
  tagline: string;
}

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: 'nysc',
    name: 'NYSC Community Development Service (CDS)',
    userLabel: 'Corper',
    idLabel: 'State Code',
    sessionLabel: 'CDS Meeting',
    defaultColor: '#00FF66',
    tagline: 'NYSC CDS groups, roll calls & clearance meetings',
  },
  {
    id: 'security',
    name: 'Private Security & Guard Patrol',
    userLabel: 'Guard',
    idLabel: 'Badge Number',
    sessionLabel: 'Shift Patrol',
    defaultColor: '#3B82F6',
    tagline: 'Guard checkpoint verification and post changeovers',
  },
  {
    id: 'education',
    name: 'Higher Education & Universities',
    userLabel: 'Student',
    idLabel: 'Matric Number',
    sessionLabel: 'Class Lecture',
    defaultColor: '#F59E0B',
    tagline: 'Lecture halls, lab sessions, and departmental roll calls',
  },
  {
    id: 'healthcare',
    name: 'Hospitals & Medical Centers',
    userLabel: 'Clinician',
    idLabel: 'Staff License ID',
    sessionLabel: 'Clinical Rotation',
    defaultColor: '#06B6D4',
    tagline: 'Doctor on-call rounds and nursing shift handovers',
  },
  {
    id: 'construction',
    name: 'Construction & Civil Engineering',
    userLabel: 'Worker',
    idLabel: 'Site Pass ID',
    sessionLabel: 'Toolbox Talk',
    defaultColor: '#EAB308',
    tagline: 'Morning site safety briefings and contractor check-in',
  },
  {
    id: 'religious',
    name: 'Faith Organizations & Churches',
    userLabel: 'Member',
    idLabel: 'Fellowship ID',
    sessionLabel: 'Service Gathering',
    defaultColor: '#8B5CF6',
    tagline: 'Weekly services, departmental workers, and fellowship',
  },
  {
    id: 'logistics',
    name: 'Logistics, Warehousing & Fleet',
    userLabel: 'Driver',
    idLabel: 'Fleet ID',
    sessionLabel: 'Dispatch Briefing',
    defaultColor: '#F97316',
    tagline: 'Depot clock-in, route assignments, cargo handovers',
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing & Industrial Plants',
    userLabel: 'Operator',
    idLabel: 'Plant Badge',
    sessionLabel: 'Factory Shift',
    defaultColor: '#10B981',
    tagline: 'Assembly floor shifts and machine station sign-in',
  },
  {
    id: 'tech',
    name: 'Tech Startups & Coworking Hubs',
    userLabel: 'Resident',
    idLabel: 'Access Token',
    sessionLabel: 'Team Standup',
    defaultColor: '#EC4899',
    tagline: 'Hot-desk check-in, sprint standups, incubator access',
  },
  {
    id: 'hospitality',
    name: 'Hotels & Luxury Resorts',
    userLabel: 'Attendant',
    idLabel: 'Crew Card',
    sessionLabel: 'Floor Roster',
    defaultColor: '#D946EF',
    tagline: 'Front-of-house briefings and housekeeping schedules',
  },
  {
    id: 'fitness',
    name: 'Gyms & Crossfit Fitness Clubs',
    userLabel: 'Athlete',
    idLabel: 'Member PIN',
    sessionLabel: 'Training Session',
    defaultColor: '#EF4444',
    tagline: 'Class attendance, coaching sessions, boot camp rosters',
  },
  {
    id: 'emergency',
    name: 'Emergency Services, Fire & Rescue',
    userLabel: 'Responder',
    idLabel: 'Service Badge',
    sessionLabel: 'Muster Roll Call',
    defaultColor: '#EF4444',
    tagline: 'Incident response muster, shift changeovers, station duty',
  },
  {
    id: 'government',
    name: 'Government Agencies & Public Service',
    userLabel: 'Civil Servant',
    idLabel: 'Service Number',
    sessionLabel: 'Departmental Muster',
    defaultColor: '#14B8A6',
    tagline: 'Secretariat check-ins, parastatal audits, agency forums',
  },
];

const PRESET_COLORS = [
  { name: 'Neon Green', hex: '#00FF66' },
  { name: 'Electric Blue', hex: '#3B82F6' },
  { name: 'Cyber Purple', hex: '#8B5CF6' },
  { name: 'Neon Pink', hex: '#EC4899' },
  { name: 'Amber Gold', hex: '#F59E0B' },
  { name: 'Cyan Glow', hex: '#06B6D4' },
];

export function AuthPage({ onAuthSuccess, onNavigateToAttend, onNavigateToHome }: AuthPageProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPopupBlocked, setIsPopupBlocked] = useState<boolean>(false);

  // Sign in fields
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign up fields
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [organizationCategory, setOrganizationCategory] = useState('');
  const [accentColor, setAccentColor] = useState('#00FF66');

  // Category Autocomplete State
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<CategoryPreset | null>(null);

  // Password visibility states
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  const { showToast } = useToast();
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Filter category presets
  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    if (!q) return CATEGORY_PRESETS;
    return CATEGORY_PRESETS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.userLabel.toLowerCase().includes(q) ||
        c.sessionLabel.toLowerCase().includes(q)
    );
  }, [categorySearch]);

  // Handle outside click for category dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' };
    if (score === 2 || score === 3) return { score: 2, label: 'Fair', color: '#F59E0B' };
    return { score: 3, label: 'Strong', color: '#00FF66' };
  }, [password]);

  // Handle Preset Selection
  const handleSelectCategory = (preset: CategoryPreset) => {
    setSelectedPreset(preset);
    setOrganizationCategory(preset.name);
    setCategorySearch(preset.name);
    setAccentColor(preset.defaultColor);
    setIsCategoryDropdownOpen(false);
  };

  const handleSelectCustomCategory = () => {
    setSelectedPreset(null);
    const custom = categorySearch.trim() || 'Custom Organization';
    setOrganizationCategory(custom);
    setIsCategoryDropdownOpen(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminName.trim() || !email.trim() || !password || !orgName.trim()) {
      setError('Please fill in all required registration fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password identically.');
      return;
    }

    try {
      setLoading(true);
      const extraFields: Partial<Organization> = {
        organizationCategory: organizationCategory.trim() || categorySearch.trim() || 'General',
        organizationType: organizationCategory.trim() || categorySearch.trim() || 'General',
        ...(selectedPreset
          ? {
              userLabel: selectedPreset.userLabel,
              idLabel: selectedPreset.idLabel,
              sessionLabel: selectedPreset.sessionLabel,
            }
          : {}),
      };

      const res = await signUpAdmin(adminName, email, password, orgName, accentColor, extraFields);
      showToast('success', `Welcome! Your organization "${res.org.name}" is ready.`, 'Welcome');
      onAuthSuccess(res.org, res.profile, true);
    } catch (err: unknown) {
      const msg = getReadableFirebaseError(err);
      setError(msg);
      showToast('error', msg, 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signInIdentifier.trim() || !signInPassword) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await signInAdmin(signInIdentifier.trim(), signInPassword);
      if (res.org) {
        if (res.profile?.role === 'superuser') {
          showToast('success', 'Logged in as Super User with full access.', 'Welcome, Super User');
        } else {
          showToast('success', `Welcome back to ${res.org.name}!`, 'Signed In');
        }
        onAuthSuccess(res.org, res.profile || undefined, false);
      } else {
        setError('No organization linked to this account.');
      }
    } catch (err: unknown) {
      const msg = getReadableFirebaseError(err);
      setError(msg);
      showToast('error', msg, 'Sign In');
    } finally {
      setLoading(false);
    }
  };

  // Check redirect result on mount (for mobile / popup-blocked redirect flows)
  useEffect(() => {
    let isMounted = true;
    checkGoogleRedirectResult()
      .then((res) => {
        if (!isMounted || !res || !res.org) return;
        showToast('success', `Welcome back, ${res.org.adminName || 'Coordinator'}!`, 'Signed In');
        const hasEnteredBefore =
          typeof window !== 'undefined' &&
          localStorage.getItem(`iwh_has_entered_portal_${res.org.id}`) === 'true';
        const isNew = !hasEnteredBefore && !res.org.stateLga && !res.org.cdsBatch;
        onAuthSuccess(res.org, res.profile || undefined, isNew);
      })
      .catch((err) => {
        console.warn('Google redirect sign-in notice:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [onAuthSuccess]);

  const getCustomOrgData = useCallback(() => {
    if (tab !== 'signup') return undefined;
    return {
      orgName: orgName.trim() || undefined,
      organizationCategory: organizationCategory.trim() || categorySearch.trim() || undefined,
      organizationType: organizationCategory.trim() || categorySearch.trim() || 'General',
      userLabel: selectedPreset?.userLabel,
      idLabel: selectedPreset?.idLabel,
      sessionLabel: selectedPreset?.sessionLabel,
      accentColor: accentColor || '#00FF66',
    };
  }, [tab, orgName, organizationCategory, categorySearch, selectedPreset, accentColor]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsPopupBlocked(false);
    try {
      setLoading(true);
      const customOrgFields = getCustomOrgData();
      const res = await signInWithGoogle(customOrgFields);
      if (res.org) {
        showToast('success', `Welcome, ${res.org.adminName || 'Coordinator'}!`, 'Signed In');
        const hasEnteredBefore =
          typeof window !== 'undefined' &&
          localStorage.getItem(`iwh_has_entered_portal_${res.org.id}`) === 'true';
        const isNew = !hasEnteredBefore && !res.org.stateLga && !res.org.cdsBatch;
        onAuthSuccess(res.org, res.profile || undefined, isNew);
      }
    } catch (err: unknown) {
      const msg = getReadableFirebaseError(err);
      if (
        msg.includes('blocked') ||
        (err instanceof Error && err.message.includes('popup-blocked'))
      ) {
        setIsPopupBlocked(true);
      }
      setError(msg);
      showToast('error', msg, 'Google Sign-In');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignInRedirect = async () => {
    setError(null);
    setIsPopupBlocked(false);
    try {
      setLoading(true);
      const customOrgFields = getCustomOrgData();
      await signInWithGoogleRedirect(customOrgFields);
    } catch (err: unknown) {
      const msg = getReadableFirebaseError(err);
      setError(msg);
      showToast('error', msg, 'Google Sign-In');
    } finally {
      setLoading(false);
    }
  };

  const configStatus = useMemo(() => getFirebaseConfigStatus(), []);

  return (
    <div className="max-w-xl mx-auto w-full px-4 py-4 sm:py-6">
      {onNavigateToHome && (
        <button
          type="button"
          onClick={onNavigateToHome}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-3 cursor-pointer py-1 px-2.5 rounded-xl hover:bg-[#141b26] border border-transparent hover:border-[#1e2638]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </button>
      )}

      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/30 mb-3 shadow-[0_0_24px_rgba(0,255,102,0.15)]">
          <Shield className="w-6 h-6 text-[#00FF66]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          IWasHere <span className="text-[#00FF66]">Portal</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
          {tab === 'signin'
            ? 'Sign in to access your attendance roster, roll calls, and geofence audits.'
            : 'Deploy your organization’s biometric roll call & geofenced check-in system.'}
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="bg-[#10151f] border border-[#1e2638] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-visible">
        {/* Subtle decorative glow */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
          style={{ backgroundColor: tab === 'signup' ? accentColor : '#00FF66' }}
        />

        {/* Firebase Configuration Notice if environment issues detected */}
        {configStatus.error && !configStatus.hasValidApiKey && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 shadow-md animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-relaxed">
              <span className="font-bold block mb-0.5 text-amber-300">Configuration Notice</span>
              {configStatus.error}
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-[#0a0c12] p-1 rounded-xl border border-[#1e2638] mb-6">
          <button
            id="tab-btn-signin"
            type="button"
            onClick={() => {
              setTab('signin');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'signin'
                ? 'bg-[#182133] text-white shadow-md border border-[#27354d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admin Sign In
          </button>
          <button
            id="tab-btn-signup"
            type="button"
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-[#182133] text-white shadow-md border border-[#27354d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Organization
          </button>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-relaxed">
              <span className="font-bold block mb-0.5">Authentication Issue</span>
              {error}
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: SIGN IN */}
        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Admin Email or Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  id="input-signin-email"
                  type="text"
                  required
                  placeholder="coordinator@org.org or username"
                  value={signInIdentifier}
                  onChange={(e) => setSignInIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  id="input-signin-password"
                  type={showSignInPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 rounded"
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
              className="w-full py-3 rounded-xl font-black text-xs sm:text-sm bg-[#00FF66] text-[#0a0c10] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] hover:brightness-110 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-[#1e2638] w-full" />
              <span className="bg-[#10151f] px-2 text-[10px] uppercase font-bold text-slate-500 shrink-0">
                Or Continue With
              </span>
            </div>

            <button
              id="btn-google-signin"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-white bg-[#182133] hover:bg-[#202c44] border border-[#2a3752] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:brightness-105 active:scale-[0.99]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

            {/* Popup allowance reminder */}
            <p className="text-[11px] text-slate-400 text-center">
              💡 <span>If the Google window doesn't open, please allow popups in your browser address bar or use full-page sign in.</span>
            </p>

            {isPopupBlocked && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5 text-left animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Popups are blocked by your browser</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your browser stopped the Google sign-in window from opening. You can allow popups, or sign in directly using full page mode.
                </p>
                <div className="bg-black/30 p-2 rounded-lg text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">How to allow popups in 2 taps:</p>
                  <p>1. Look at your browser address bar and tap the popup icon <span className="font-mono text-amber-300">[ ⧉ ]</span> or site settings.</p>
                  <p>2. Select <strong>"Always allow popups"</strong>.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    Allow Popups &amp; Try Again
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleSignInRedirect}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-600 transition-colors cursor-pointer text-center"
                  >
                    Full Page Sign-In (No Popups)
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setTab('signup');
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Don't have an organization registered yet?{' '}
                <span className="text-[#00FF66] font-bold underline">Create one now</span>
              </button>
            </div>
          </form>
        ) : (
          /* TAB 2: CREATE ORGANIZATION (SIGN UP) */
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Step 1: Coordinator Account */}
            <div className="space-y-3 pb-3 border-b border-[#1b2333]">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                <User className="w-3.5 h-3.5 text-[#00FF66]" />
                <span>1. Coordinator Account Credentials</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Coordinator Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    id="input-admin-name"
                    type="text"
                    required
                    placeholder="e.g. Capt. Adebayo Bello"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Official Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
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
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 rounded"
                    >
                      {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="flex items-center space-x-1.5 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-[#1b2434] overflow-hidden">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${(passwordStrength.score / 3) * 100}%`,
                            backgroundColor: passwordStrength.color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Confirm Password *
                    </label>
                    {confirmPassword && password === confirmPassword && (
                      <span className="text-[10px] text-[#00FF66] font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Matches
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
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
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1 rounded"
                    >
                      {showSignUpConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Organization Profile & Category (Data Pool Driven) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-200">
                <Building2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span>2. Organization Profile &amp; Category</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Organization / Unit Name *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    id="input-org-name"
                    type="text"
                    required
                    placeholder="e.g. Lagos Central NYSC CDS Band"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                  />
                </div>
              </div>

              {/* Organization Category Field (Connected to Data Pool) */}
              <div className="relative" ref={categoryDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <span>Organization Category</span>
                    <span className="text-[10px] text-slate-500">(Data Pool)</span>
                  </label>
                  {selectedPreset && (
                    <span className="text-[10px] font-mono font-bold" style={{ color: accentColor }}>
                      {selectedPreset.userLabel} • {selectedPreset.sessionLabel}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    id="input-org-category"
                    type="text"
                    value={categorySearch}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    onChange={(e) => {
                      setCategorySearch(e.target.value);
                      setOrganizationCategory(e.target.value);
                      setIsCategoryDropdownOpen(true);
                    }}
                    placeholder="Search or select category (e.g., NYSC, Security, Education)..."
                    autoComplete="off"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#0a0c12] border border-[#1f283a] rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF66]"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-white"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Floating Category Dropdown */}
                {isCategoryDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-[#0c1018] border border-[#232d3f] shadow-2xl backdrop-blur-xl divide-y divide-[#171f2c]">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((cat) => (
                        <div
                          key={cat.id}
                          onClick={() => handleSelectCategory(cat)}
                          className="px-3.5 py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-[#141d2a] transition-colors"
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.defaultColor }} />
                              <span className="font-semibold text-white">{cat.name}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 pl-4">{cat.tagline}</p>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#16202e] border border-[#26354a] text-slate-300">
                            {cat.userLabel}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center italic">
                        No standard category match found.
                      </div>
                    )}
                    <div
                      onClick={handleSelectCustomCategory}
                      className="px-3.5 py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-[#182333] text-slate-300 border-t border-[#1e2738]"
                    >
                      <span className="font-bold">Use Custom Category: "{categorySearch || 'General'}"</span>
                      <span className="text-[10px] font-mono text-slate-400">Custom →</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Accent Palette Selector */}
              <div className="p-3 bg-[#0a0c12] border border-[#1f283a] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    <span>Brand Theme Accent</span>
                  </span>
                  <span className="font-mono text-xs font-bold" style={{ color: accentColor }}>
                    {accentColor}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setAccentColor(preset.hex)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer"
                      style={{
                        backgroundColor: accentColor === preset.hex ? `${preset.hex}22` : 'transparent',
                        borderColor: accentColor === preset.hex ? preset.hex : '#2a354a',
                        color: accentColor === preset.hex ? preset.hex : '#94a3b8',
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.hex }} />
                      <span>{preset.name}</span>
                    </button>
                  ))}

                  <label className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border border-[#2a354a] hover:border-slate-500 cursor-pointer bg-[#10151f]">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Hex</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Dynamic Submit Button */}
            <button
              id="btn-submit-signup"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-black text-xs sm:text-sm text-[#0a0c10] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] hover:brightness-110 cursor-pointer disabled:opacity-50 mt-2"
              style={{ backgroundColor: accentColor }}
            >
              {loading ? (
                <span>Provisioning Organization...</span>
              ) : (
                <>
                  <span>Create Organization &amp; Launch Portal</span>
                  <ArrowRight className="w-4 h-4 text-[#0a0c10]" />
                </>
              )}
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-[#1e2638] w-full" />
              <span className="bg-[#10151f] px-2 text-[10px] uppercase font-bold text-slate-500 shrink-0">
                Or Register With Google
              </span>
            </div>

            <button
              id="btn-google-signup"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-white bg-[#182133] hover:bg-[#202c44] border border-[#2a3752] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:brightness-105 active:scale-[0.99]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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

            {/* Popup allowance reminder */}
            <p className="text-[11px] text-slate-400 text-center">
              💡 <span>If the Google window doesn't open, please allow popups in your browser address bar or use full-page sign in.</span>
            </p>

            {isPopupBlocked && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5 text-left animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Popups are blocked by your browser</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Your browser stopped the Google sign-in window from opening. You can allow popups, or create your account directly using full page mode.
                </p>
                <div className="bg-black/30 p-2 rounded-lg text-[11px] text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-300">How to allow popups in 2 taps:</p>
                  <p>1. Look at your browser address bar and tap the popup icon <span className="font-mono text-amber-300">[ ⧉ ]</span> or site settings.</p>
                  <p>2. Select <strong>"Always allow popups"</strong>.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    Allow Popups &amp; Try Again
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleSignInRedirect}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-600 transition-colors cursor-pointer text-center"
                  >
                    Full Page Sign-In (No Popups)
                  </button>
                </div>
              </div>
            )}

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Already have an account?{' '}
                <span className="font-bold underline" style={{ color: accentColor }}>
                  Sign In instead
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Direct Attendee Scan Flow Link */}
      <div className="text-center mt-5">
        <button
          id="btn-back-to-attendee"
          type="button"
          onClick={onNavigateToAttend}
          className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-xl hover:bg-[#121824] border border-transparent hover:border-[#1e2638]"
        >
          <QrCode className="w-3.5 h-3.5 text-[#00FF66]" />
          <span>Looking to mark attendance instead? Go to Member Scan</span>
        </button>
      </div>
    </div>
  );
}

export default AuthPage;
