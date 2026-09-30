import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Lock,
  Timer,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Sparkles,
} from 'lucide-react';
import { Campaign, Organization } from '../../types/attendance';
import { parseCampaignDate, formatCountdownDuration, formatWATTime, formatWATDate } from '../../utils/dateUtils';

export type SessionTimerState = 'upcoming' | 'active' | 'expired';

export interface SessionTimerDetails {
  state: SessionTimerState;
  now: Date;
  startDate: Date | null;
  endDate: Date | null;
  msUntilStart: number;
  msUntilEnd: number | null;
  formattedCountdown: string;
  formattedClosesIn: string;
  isUrgent: boolean; // less than 10 minutes left before closing
}

/**
 * Hook to manage live countdown and state transition
 */
export function useSessionTimer(campaign: Campaign | null): SessionTimerDetails {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // Update every second for smooth, zero-latency countdown
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    if (!campaign) {
      return {
        state: 'active',
        now,
        startDate: null,
        endDate: null,
        msUntilStart: 0,
        msUntilEnd: null,
        formattedCountdown: '00:00:00',
        formattedClosesIn: '',
        isUrgent: false,
      };
    }

    const startDate = parseCampaignDate(campaign.startTime);
    const endDate = parseCampaignDate(campaign.endTime);
    const nowMs = now.getTime();

    // Check manual administrative close first
    if (campaign.status === 'closed' || campaign.isClosed) {
      return {
        state: 'expired',
        now,
        startDate,
        endDate,
        msUntilStart: 0,
        msUntilEnd: 0,
        formattedCountdown: '00:00:00',
        formattedClosesIn: 'Session Closed',
        isUrgent: false,
      };
    }

    // State 1: Upcoming (now < startTime)
    if (startDate && nowMs < startDate.getTime()) {
      const diff = startDate.getTime() - nowMs;
      return {
        state: 'upcoming',
        now,
        startDate,
        endDate,
        msUntilStart: diff,
        msUntilEnd: endDate ? endDate.getTime() - nowMs : null,
        formattedCountdown: formatCountdownDuration(diff),
        formattedClosesIn: '',
        isUrgent: false,
      };
    }

    // State 3: Expired (now > endTime)
    if (endDate && nowMs > endDate.getTime()) {
      return {
        state: 'expired',
        now,
        startDate,
        endDate,
        msUntilStart: 0,
        msUntilEnd: 0,
        formattedCountdown: '00:00:00',
        formattedClosesIn: 'Session Closed',
        isUrgent: false,
      };
    }

    // State 2: Active (between startTime and endTime, or unscheduled)
    const msUntilEnd = endDate ? Math.max(0, endDate.getTime() - nowMs) : null;
    const formattedClosesIn = msUntilEnd !== null ? formatCountdownDuration(msUntilEnd) : '';
    const isUrgent = msUntilEnd !== null && msUntilEnd <= 10 * 60 * 1000; // 10 minutes

    return {
      state: 'active',
      now,
      startDate,
      endDate,
      msUntilStart: 0,
      msUntilEnd,
      formattedCountdown: '',
      formattedClosesIn,
      isUrgent,
    };
  }, [campaign, now]);
}

interface SessionTimerProps {
  campaign: Campaign;
  organization?: Organization | null;
  onBackToHome?: () => void;
  // If variant is 'indicator-only', renders the small 'Closes in [time]' banner for Active state
  variant?: 'full' | 'active-indicator';
}

export function SessionTimer({
  campaign,
  organization,
  onBackToHome,
  variant = 'full',
}: SessionTimerProps) {
  const timer = useSessionTimer(campaign);

  // Variant: Small Active indicator pill displayed inside the form
  if (variant === 'active-indicator') {
    if (timer.state !== 'active' || !timer.formattedClosesIn) {
      return null;
    }

    return (
      <div
        id="session-active-timer-indicator"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all border shadow-sm ${
          timer.isUrgent
            ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.3)]'
            : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
        }`}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              timer.isUrgent ? 'bg-rose-400' : 'bg-emerald-400'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              timer.isUrgent ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
        </span>
        <Clock className="w-3.5 h-3.5" />
        <span>Closes in {timer.formattedClosesIn}</span>
      </div>
    );
  }

  // State 1: Upcoming (Glowing Countdown screen)
  if (timer.state === 'upcoming') {
    return (
      <div
        id="session-upcoming-screen"
        className="relative overflow-hidden bg-[#0a0e17] border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-[0_0_40px_rgba(245,158,11,0.15)] animate-in fade-in zoom-in-95 duration-300"
      >
        {/* Ambient glow backgrounds */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Status Header */}
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-extrabold uppercase bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
            <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span>Scheduled Roll Call — Standby</span>
          </span>
        </div>

        {/* Campaign Info */}
        <div className="space-y-1.5 max-w-md mx-auto">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {campaign.name}
          </h2>
          {organization && (
            <p className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
              <span>{organization.name}</span>
              {organization.cdsBatch && <span>• {organization.cdsBatch}</span>}
            </p>
          )}
        </div>

        {/* Glowing Central Countdown Timer */}
        <div className="py-4">
          <div className="inline-flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-[#0e1422] border-2 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.25)] relative group hover:border-amber-400 transition-all">
            <span className="text-[11px] font-mono uppercase font-bold tracking-widest text-amber-400/90 mb-2 flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Starts in</span>
            </span>

            {/* Glowing Big Monospace Counter */}
            <div className="text-4xl sm:text-6xl font-black font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">
              {timer.formattedCountdown}
            </div>

            {timer.startDate && (
              <div className="mt-3 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Unlocks at {formatWATTime(timer.startDate, { hour12: true })} WAT</span>
              </div>
            )}
          </div>
        </div>

        {/* Security Lock Indicators */}
        <div className="bg-[#0e1424] border border-[#1e2a3e] rounded-2xl p-4 max-w-md mx-auto text-left space-y-2.5">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Hardware Locks Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 rounded-xl bg-[#090d15] border border-[#1b2536] flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              <span>Camera: Locked</span>
            </div>
            <div className="p-2 rounded-xl bg-[#090d15] border border-[#1b2536] flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              <span>GPS: Standby</span>
            </div>
            <div className="p-2 rounded-xl bg-[#090d15] border border-[#1b2536] flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              <span>Submit: Locked</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            Biometric camera, geolocation check, and attendance submission will automatically activate the instant the countdown reaches zero.
          </p>
        </div>

        {/* Back Button */}
        {onBackToHome && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onBackToHome}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-300 bg-[#141b27] hover:bg-[#1d2738] border border-[#233146] transition-all cursor-pointer inline-flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Home</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // State 3: Expired (Session Closed)
  if (timer.state === 'expired') {
    return (
      <div
        id="session-expired-screen"
        className="bg-[#0e131d] border border-rose-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-[0_0_35px_rgba(244,63,94,0.15)] animate-in fade-in zoom-in-95 duration-300"
      >
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border-2 border-rose-500/50 flex items-center justify-center text-rose-400 mx-auto shadow-[0_0_20px_rgba(244,63,94,0.3)]">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-1.5 max-w-sm mx-auto">
          <span className="text-[10px] font-mono font-extrabold px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800 uppercase tracking-widest shadow-sm">
            SESSION CLOSED
          </span>
          <h3 className="text-xl font-bold text-white pt-2">{campaign.name}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            This attendance session has ended and is now closed. Submissions are no longer accepted for this roll call.
          </p>
          {timer.endDate && (
            <p className="text-[11px] font-mono text-slate-500 pt-1">
              Closed at: {formatWATTime(timer.endDate, { hour12: true })} WAT
            </p>
          )}
        </div>

        {onBackToHome && (
          <div className="pt-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-slate-200 bg-[#161e2b] hover:bg-[#202a3a] border border-[#273449] transition-all cursor-pointer inline-flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Home</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
