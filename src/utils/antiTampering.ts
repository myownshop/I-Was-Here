/**
 * IWasHere Client-Side Anti-Tampering Time-Check Engine
 *
 * Continuously validates monotonic hardware performance timers against OS wall clock time.
 * Detects if a user attempts to spoof attendance time by altering device clocks backwards
 * or forwards while minimizing/backgrounding the application.
 */

// Maximum allowable clock skew (in milliseconds) before flagging tampering
const CLOCK_DRIFT_THRESHOLD_MS = 8000; // 8 seconds threshold

interface TimeState {
  initialWallTime: number;
  initialPerfTime: number;
  lastWallTime: number;
  lastPerfTime: number;
  tampered: boolean;
  tamperReason: string | null;
  maxDriftObserved: number;
}

let state: TimeState = {
  initialWallTime: Date.now(),
  initialPerfTime: typeof performance !== 'undefined' ? performance.now() : 0,
  lastWallTime: Date.now(),
  lastPerfTime: typeof performance !== 'undefined' ? performance.now() : 0,
  tampered: false,
  tamperReason: null,
  maxDriftObserved: 0,
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

/**
 * Checks the integrity of the system clock against hardware uptime
 */
export function checkTimeIntegrity(): boolean {
  if (typeof performance === 'undefined') {
    return !state.tampered;
  }

  const currentWallTime = Date.now();
  const currentPerfTime = performance.now();

  // 1. Detect backward clock manipulation (OS clock set back)
  if (currentWallTime < state.lastWallTime - 2000) {
    state.tampered = true;
    state.tamperReason = `Clock reversed: OS clock moved backwards by ${Math.round(state.lastWallTime - currentWallTime)}ms.`;
    return false;
  }

  // 2. Compare elapsed hardware uptime vs elapsed wall-clock time
  const elapsedPerfMs = currentPerfTime - state.initialPerfTime;
  const elapsedWallMs = currentWallTime - state.initialWallTime;
  const driftMs = Math.abs(elapsedWallMs - elapsedPerfMs);

  if (driftMs > state.maxDriftObserved) {
    state.maxDriftObserved = driftMs;
  }

  if (driftMs > CLOCK_DRIFT_THRESHOLD_MS) {
    state.tampered = true;
    state.tamperReason = `Clock skew anomaly: Hardware uptime (${Math.round(elapsedPerfMs)}ms) and system clock (${Math.round(elapsedWallMs)}ms) diverged by ${Math.round(driftMs)}ms.`;
    return false;
  }

  // Update rolling trackers
  state.lastWallTime = currentWallTime;
  state.lastPerfTime = currentPerfTime;

  return !state.tampered;
}

/**
 * Initializes the Anti-Tamper Engine immediately upon page/app load
 */
export function initAntiTamperEngine(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (!isInitialized) {
    state.initialWallTime = Date.now();
    state.initialPerfTime = typeof performance !== 'undefined' ? performance.now() : 0;
    state.lastWallTime = state.initialWallTime;
    state.lastPerfTime = state.initialPerfTime;
    state.tampered = false;
    state.tamperReason = null;
    state.maxDriftObserved = 0;
    isInitialized = true;
  }

  // Periodic heartbeat every 1 second
  if (!intervalId) {
    intervalId = setInterval(() => {
      checkTimeIntegrity();
    }, 1000);
  }

  const handleVisibilityOrFocusChange = () => {
    checkTimeIntegrity();
  };

  document.addEventListener('visibilitychange', handleVisibilityOrFocusChange);
  window.addEventListener('focus', handleVisibilityOrFocusChange);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityOrFocusChange);
    window.removeEventListener('focus', handleVisibilityOrFocusChange);
  };
}

/**
 * Returns true if clock manipulation or hardware divergence was detected
 */
export function isTamperingDetected(): boolean {
  checkTimeIntegrity();
  return state.tampered;
}

/**
 * Returns full audit details for telemetry and package serialization
 */
export function getAntiTamperReport(): {
  tampered: boolean;
  tamperReason: string | null;
  maxDriftObserved: number;
} {
  checkTimeIntegrity();
  return {
    tampered: state.tampered,
    tamperReason: state.tamperReason,
    maxDriftObserved: Math.round(state.maxDriftObserved),
  };
}

/**
 * Manually sets tampering state (for testing or simulation)
 */
export function setTamperedFlag(isTampered: boolean, reason?: string): void {
  state.tampered = isTampered;
  if (reason) state.tamperReason = reason;
}

/**
 * Resets the anti-tamper engine state
 */
export function resetAntiTamperEngine(): void {
  state = {
    initialWallTime: Date.now(),
    initialPerfTime: typeof performance !== 'undefined' ? performance.now() : 0,
    lastWallTime: Date.now(),
    lastPerfTime: typeof performance !== 'undefined' ? performance.now() : 0,
    tampered: false,
    tamperReason: null,
    maxDriftObserved: 0,
  };
}

// Auto-initialize when module is loaded in browser
if (typeof window !== 'undefined') {
  initAntiTamperEngine();
}
