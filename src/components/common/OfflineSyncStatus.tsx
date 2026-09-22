import { useState, useEffect, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getPendingAttendanceCount,
  syncPendingAttendanceWithFirebase,
  OFFLINE_SYNC_EVENT,
  isNavigatorOnline,
} from '../../utils/indexedDB';
import { showToast } from './Toast';

interface OfflineSyncStatusProps {
  accentColor?: string;
  className?: string;
}

export function OfflineSyncStatus({ accentColor = '#00FF66', className = '' }: OfflineSyncStatusProps) {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(isNavigatorOnline());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingAttendanceCount();
      setPendingCount(count);
    } catch {
      // Ignore if DB is closed or busy
    }
  }, []);

  useEffect(() => {
    refreshCount();

    const handleOnlineStatusChange = () => {
      setIsOnline(isNavigatorOnline());
      refreshCount();
    };

    const handleQueueEvent = () => {
      refreshCount();
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    window.addEventListener(OFFLINE_SYNC_EVENT, handleQueueEvent);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
      window.removeEventListener(OFFLINE_SYNC_EVENT, handleQueueEvent);
    };
  }, [refreshCount]);

  const handleManualSync = async () => {
    if (!isNavigatorOnline()) {
      showToast('warning', 'Device is offline. Connect to the internet to sync with Firebase.', 'Offline');
      return;
    }

    if (isSyncing || pendingCount === 0) return;

    try {
      setIsSyncing(true);
      const report = await syncPendingAttendanceWithFirebase();
      await refreshCount();

      if (report.syncedCount > 0) {
        showToast(
          'success',
          `Synced ${report.syncedCount} offline record${report.syncedCount > 1 ? 's' : ''} to Firebase.`,
          'Cloud Sync Complete'
        );
      } else if (report.failedCount > 0) {
        showToast(
          'error',
          `Failed to sync ${report.failedCount} record${report.failedCount > 1 ? 's' : ''}. Check database connection.`,
          'Sync Issues'
        );
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      showToast('error', 'Sync encountered an unexpected error.', 'Sync Error');
    } finally {
      setIsSyncing(false);
    }
  };

  // If there are no pending records and the device is online, keep header uncluttered
  if (pendingCount === 0 && isOnline) {
    return null;
  }

  // Device is offline, but 0 pending records: subtle offline pill
  if (pendingCount === 0 && !isOnline) {
    return (
      <div
        id="offline-indicator-badge"
        className={`flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-500/30 ${className}`}
        title="Device is currently offline. Attendance will be stored in IndexedDB."
      >
        <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="hidden xs:inline">Offline Mode</span>
      </div>
    );
  }

  // Pending records exist!
  return (
    <div
      id="offline-sync-queue-badge"
      className={`flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${className} ${
        isOnline
          ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
          : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
      }`}
    >
      {isOnline ? (
        <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      ) : (
        <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      )}

      <span>
        <strong className="font-mono">{pendingCount}</strong>
        <span className="hidden sm:inline"> offline</span> queued
      </span>

      {isOnline && (
        <button
          id="btn-sync-offline-queue"
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
          style={{
            backgroundColor: `${accentColor}25`,
            borderColor: `${accentColor}50`,
            color: accentColor,
          }}
          title="Synchronize queued attendance records to Firebase now"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      )}
    </div>
  );
}
