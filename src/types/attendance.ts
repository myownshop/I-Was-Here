/**
 * IWasHere Multi-Tenant Location-Based Attendance Types
 */

export interface Organization {
  id: string;
  name: string;
  adminUid: string;
  adminEmail: string;
  adminName: string;
  accentColor: string; // e.g. #00FF66, #3B82F6, #EC4899, #F59E0B
  createdAt: string;
  stateLga?: string; // e.g. Lagos State • Ikeja LGA
  cdsBatch?: string; // e.g. 2024 Batch B
  meetingSchedule?: string; // e.g. Thursdays at 9:00 AM
  defaultVenueName?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultRadius?: number;
  description?: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  orgId: string;
  role: 'admin';
  createdAt: string;
}

export interface Campaign {
  id: string;
  orgId: string;
  name: string;
  date: string; // YYYY-MM-DD
  targetLatitude: number;
  targetLongitude: number;
  allowedRadius: number; // in meters (e.g. 50, 100, 200)
  shortCode: string; // 5 alphanumeric characters, e.g. xyz12
  createdAt: string;
}

export interface Attendee {
  id: string;
  campaignId: string;
  orgId?: string;
  name: string;
  stateCode: string; // e.g. LA/23B/1234 or ID code
  photoUrl: string;
  loggedIp: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  timestamp: string;
  verified: boolean;
  isOfflineSync?: boolean;
}

export interface ShortLink {
  shortCode: string;
  campaignId: string;
  orgId?: string;
  createdAt: string;
}

export interface GeoLocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeoLocationState {
  coords: GeoLocationCoordinates | null;
  error: string | null;
  loading: boolean;
}

export interface AttendanceSubmissionPayload {
  campaignId: string;
  orgId?: string;
  name: string;
  stateCode: string;
  photoBlob: Blob;
  photoDataUrl: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  loggedIp: string;
}

export interface AttendanceResult {
  success: boolean;
  attendee?: Attendee;
  error?: string;
  isOfflinePackage?: boolean;
  offlineFilename?: string;
}

/**
 * Payload packaged into encrypted .iwh file for zero-network conditions
 */
export interface OfflineAttendanceRecord {
  name: string;
  stateCode: string;
  campaignId: string;
  orgId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  base64Image: string;
  version: string;
}

export interface EncryptedIwhFile {
  format: 'IWH_ENCRYPTED_V1';
  salt: string;
  iv: string;
  ciphertext: string;
  checksum: string;
  metadata: {
    stateCode: string;
    date: string;
    campaignId: string;
    orgId: string;
  };
}

/**
 * PWA IndexedDB Serialized Attendance Record
 * Saved locally when navigator.onLine is false and queued for automatic sync with Firebase
 */
export interface SerializedAttendanceRecord {
  id: string;
  campaignId: string;
  orgId: string;
  name: string;
  stateCode: string;
  photoDataUrl: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  loggedIp: string;
  timestamp: string; // ISO string
  createdAt: number; // Unix timestamp
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  syncAttempts: number;
  lastSyncError?: string;
  isOfflineSync: true;
}

export interface OfflineSyncReport {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  total: number;
  errors: Array<{ id: string; stateCode: string; error: string }>;
}
