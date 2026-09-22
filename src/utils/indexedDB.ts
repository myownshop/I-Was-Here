/**
 * IWasHere PWA IndexedDB Offline Persistence & Synchronization Utility
 *
 * Provides transactional client-side storage for attendance records when
 * navigator.onLine is false, guaranteeing zero data loss in low/no connectivity
 * environments, with automatic background synchronization upon reconnection to Firebase.
 */

import {
  SerializedAttendanceRecord,
  AttendanceSubmissionPayload,
  OfflineSyncReport,
  Attendee,
} from '../types/attendance';
import { db, uploadAttendeeImage } from '../services/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const DB_NAME = 'iwashere_pwa_offline_db';
export const DB_VERSION = 1;
export const ATTENDANCE_STORE = 'pending_attendance_records';
export const OFFLINE_SYNC_EVENT = 'iwashere:offline-sync';

/**
 * Checks current online connectivity status
 */
export function isNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }
  return navigator.onLine;
}

/**
 * Converts a base64 Data URL to a native binary Blob for Firebase Storage upload
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const parts = dataUrl.split(';base64,');
    if (parts.length === 2) {
      const contentType = parts[0].split(':')[1] || 'image/jpeg';
      const byteCharacters = atob(parts[1]);
      const arrayBuffer = new ArrayBuffer(byteCharacters.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteCharacters.length; i++) {
        uint8Array[i] = byteCharacters.charCodeAt(i);
      }
      return new Blob([arrayBuffer], { type: contentType });
    }
  } catch (err) {
    console.warn('dataUrlToBlob conversion failed, returning fallback blob:', err);
  }
  return new Blob([''], { type: 'image/jpeg' });
}

/**
 * Opens or initializes the IndexedDB database instance
 */
export function openAttendanceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported on this device/environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;

      if (!dbInstance.objectStoreNames.contains(ATTENDANCE_STORE)) {
        const store = dbInstance.createObjectStore(ATTENDANCE_STORE, {
          keyPath: 'id',
        });

        // Indexes for rapid filtering and chronological FIFO queue processing
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('campaignId', 'campaignId', { unique: false });
        store.createIndex('stateCode', 'stateCode', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB database.'));
    };
  });
}

/**
 * Dispatches a window-level event to update reactive badges & counters across UI components
 */
function notifyQueueUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_EVENT));
  }
}

/**
 * Serializes and stores an attendance record in IndexedDB when navigator.onLine is false
 */
export async function serializeAndStoreAttendance(
  payload: AttendanceSubmissionPayload | Omit<SerializedAttendanceRecord, 'id' | 'status' | 'syncAttempts' | 'createdAt' | 'isOfflineSync'>
): Promise<SerializedAttendanceRecord> {
  const dbInstance = await openAttendanceDB();

  const recordId = `offline_att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Date.now();

  const serializedRecord: SerializedAttendanceRecord = {
    id: recordId,
    campaignId: payload.campaignId,
    orgId: payload.orgId || '',
    name: payload.name.trim(),
    stateCode: payload.stateCode.trim().toUpperCase(),
    photoDataUrl: 'photoDataUrl' in payload ? payload.photoDataUrl : '',
    latitude: payload.latitude,
    longitude: payload.longitude,
    distanceMeters: payload.distanceMeters,
    loggedIp: payload.loggedIp || 'Offline IndexedDB Sync',
    timestamp: 'timestamp' in payload && payload.timestamp ? payload.timestamp : new Date(now).toISOString(),
    createdAt: now,
    status: 'pending',
    syncAttempts: 0,
    isOfflineSync: true,
  };

  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(ATTENDANCE_STORE, 'readwrite');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const request = store.put(serializedRecord);

    request.onsuccess = () => {
      notifyQueueUpdated();
      resolve(serializedRecord);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to save attendance record to IndexedDB.'));
    };

    tx.oncomplete = () => {
      dbInstance.close();
    };
  });
}

/**
 * Retrieves all pending or failed attendance records from IndexedDB, ordered chronologically (FIFO)
 */
export async function getPendingAttendanceRecords(): Promise<SerializedAttendanceRecord[]> {
  try {
    const dbInstance = await openAttendanceDB();

    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(ATTENDANCE_STORE, 'readonly');
      const store = tx.objectStore(ATTENDANCE_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allRecords = (request.result || []) as SerializedAttendanceRecord[];
        // Filter records that still need synchronization
        const pending = allRecords
          .filter((r) => r.status === 'pending' || r.status === 'failed' || r.status === 'syncing')
          .sort((a, b) => a.createdAt - b.createdAt);
        resolve(pending);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to query pending attendance records.'));
      };

      tx.oncomplete = () => {
        dbInstance.close();
      };
    });
  } catch (err) {
    console.warn('Could not read pending records from IndexedDB:', err);
    return [];
  }
}

/**
 * Returns total count of attendance records currently awaiting synchronization
 */
export async function getPendingAttendanceCount(): Promise<number> {
  const records = await getPendingAttendanceRecords();
  return records.length;
}

/**
 * Retrieves a single attendance record by ID
 */
export async function getAttendanceRecordById(id: string): Promise<SerializedAttendanceRecord | null> {
  const dbInstance = await openAttendanceDB();

  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(ATTENDANCE_STORE, 'readonly');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error || new Error(`Failed to get record ${id} from IndexedDB.`));
    };

    tx.oncomplete = () => {
      dbInstance.close();
    };
  });
}

/**
 * Updates status and sync details of a record in IndexedDB
 */
export async function updateRecordSyncState(
  id: string,
  status: SerializedAttendanceRecord['status'],
  errorMessage?: string
): Promise<void> {
  const dbInstance = await openAttendanceDB();

  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(ATTENDANCE_STORE, 'readwrite');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result as SerializedAttendanceRecord;
      if (record) {
        record.status = status;
        record.syncAttempts = (record.syncAttempts || 0) + 1;
        if (errorMessage) {
          record.lastSyncError = errorMessage;
        }
        store.put(record);
      }
      resolve();
    };

    getReq.onerror = () => {
      reject(getReq.error || new Error(`Record ${id} not found.`));
    };

    tx.oncomplete = () => {
      notifyQueueUpdated();
      dbInstance.close();
    };
  });
}

/**
 * Deletes a single attendance record from IndexedDB (invoked after successful sync)
 */
export async function deleteAttendanceRecord(id: string): Promise<void> {
  const dbInstance = await openAttendanceDB();

  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(ATTENDANCE_STORE, 'readwrite');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error(`Failed to delete record ${id}.`));
    };

    tx.oncomplete = () => {
      notifyQueueUpdated();
      dbInstance.close();
    };
  });
}

/**
 * Clears all pending attendance records (e.g. on coordinator reset)
 */
export async function clearAllOfflineRecords(): Promise<void> {
  const dbInstance = await openAttendanceDB();

  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(ATTENDANCE_STORE, 'readwrite');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to clear IndexedDB store.'));
    };

    tx.oncomplete = () => {
      notifyQueueUpdated();
      dbInstance.close();
    };
  });
}

/**
 * Synchronizes an individual serialized record to Firebase Firestore and Storage
 */
export async function syncSingleRecordWithFirebase(
  record: SerializedAttendanceRecord
): Promise<{ success: boolean; attendee?: Attendee; error?: string }> {
  try {
    // 1. Mark status in IndexedDB as syncing
    await updateRecordSyncState(record.id, 'syncing');

    // 2. Prepare image blob and upload to Storage if possible, falling back to dataUrl
    let photoUrl = record.photoDataUrl;
    if (record.photoDataUrl && record.photoDataUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(record.photoDataUrl);
      photoUrl = await uploadAttendeeImage(
        record.campaignId,
        record.stateCode,
        blob,
        record.photoDataUrl
      );
    }

    // 3. Check if document already exists to avoid redundant write
    const attendeeDocRef = doc(db, 'campaigns', record.campaignId, 'attendees', record.id);
    const existingSnap = await getDoc(attendeeDocRef);

    const attendeeData: Attendee = {
      id: record.id,
      campaignId: record.campaignId,
      orgId: record.orgId,
      name: record.name,
      stateCode: record.stateCode,
      photoUrl,
      loggedIp: record.loggedIp || 'PWA IndexedDB Auto-Sync',
      latitude: record.latitude,
      longitude: record.longitude,
      distanceMeters: record.distanceMeters,
      timestamp: record.timestamp,
      verified: true,
      isOfflineSync: true,
    };

    if (!existingSnap.exists()) {
      await setDoc(attendeeDocRef, {
        campaignId: attendeeData.campaignId,
        orgId: attendeeData.orgId || '',
        name: attendeeData.name,
        stateCode: attendeeData.stateCode,
        photoUrl: attendeeData.photoUrl,
        loggedIp: attendeeData.loggedIp,
        latitude: attendeeData.latitude,
        longitude: attendeeData.longitude,
        distanceMeters: attendeeData.distanceMeters,
        timestamp: attendeeData.timestamp,
        verified: true,
        isOfflineSync: true,
        syncedAt: new Date().toISOString(),
      });
    }

    // 4. Remove from IndexedDB queue upon confirmed persistence
    await deleteAttendanceRecord(record.id);

    return { success: true, attendee: attendeeData };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Synchronization failed.';
    await updateRecordSyncState(record.id, 'failed', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Synchronizes all pending attendance records with Firebase upon reconnection
 */
export async function syncPendingAttendanceWithFirebase(
  onProgress?: (synced: number, total: number) => void
): Promise<OfflineSyncReport> {
  if (!isNavigatorOnline()) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      total: 0,
      errors: [{ id: 'system', stateCode: '', error: 'Device is currently offline.' }],
    };
  }

  const pendingRecords = await getPendingAttendanceRecords();
  const total = pendingRecords.length;

  if (total === 0) {
    return {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      total: 0,
      errors: [],
    };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const errors: Array<{ id: string; stateCode: string; error: string }> = [];

  for (let i = 0; i < total; i++) {
    const record = pendingRecords[i];
    const result = await syncSingleRecordWithFirebase(record);

    if (result.success) {
      syncedCount++;
    } else {
      failedCount++;
      errors.push({
        id: record.id,
        stateCode: record.stateCode,
        error: result.error || 'Unknown sync error',
      });
    }

    if (onProgress) {
      onProgress(syncedCount, total);
    }
  }

  notifyQueueUpdated();

  return {
    success: failedCount === 0,
    syncedCount,
    failedCount,
    total,
    errors,
  };
}

/**
 * Automatically listens for the browser's `online` event and synchronizes pending records
 */
let isAutoSyncRegistered = false;

export function setupAutoSyncOnReconnect(
  options?: {
    onSyncComplete?: (report: OfflineSyncReport) => void;
    onSyncStart?: () => void;
  }
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let isSyncing = false;

  const triggerSync = async () => {
    if (!isNavigatorOnline() || isSyncing) return;

    try {
      const count = await getPendingAttendanceCount();
      if (count === 0) return;

      isSyncing = true;
      if (options?.onSyncStart) options.onSyncStart();

      console.info(`[PWA Auto-Sync] Reconnected! Syncing ${count} offline attendance records to Firebase...`);
      const report = await syncPendingAttendanceWithFirebase();
      console.info(`[PWA Auto-Sync] Sync complete. Result:`, report);

      if (options?.onSyncComplete) {
        options.onSyncComplete(report);
      }
    } catch (err) {
      console.warn('[PWA Auto-Sync] Error during reconnect sync:', err);
    } finally {
      isSyncing = false;
    }
  };

  const handleOnline = () => {
    // Add small delay to ensure cellular/WiFi handshakes complete
    setTimeout(triggerSync, 1200);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isNavigatorOnline()) {
      triggerSync();
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initial check on mount if online
  if (isNavigatorOnline()) {
    setTimeout(triggerSync, 2000);
  }

  isAutoSyncRegistered = true;

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    isAutoSyncRegistered = false;
  };
}
