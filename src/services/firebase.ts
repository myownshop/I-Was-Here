import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  getDocFromServer,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Campaign,
  Attendee,
  ShortLink,
  AttendanceSubmissionPayload,
  Organization,
  UserProfile,
  OfflineAttendanceRecord,
} from '../types/attendance';
import { calculateHaversineDistance } from '../utils/geo';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: Must pass firestoreDatabaseId according to Firebase integration guidelines
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Operational Error Handling conforming to Firebase Skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(errInfo.error || 'Database operation failed.');
}

/**
 * Validates connection to Firestore on application startup.
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, using cache or retry.');
    }
    return false;
  }
}

// Local cache keys for offline-first support
const LOCAL_ORGS_KEY = 'iwashere_orgs_cache';
const LOCAL_USERS_KEY = 'iwashere_users_cache';
const LOCAL_CAMPAIGNS_KEY = 'iwashere_campaigns_cache';
const LOCAL_ATTENDEES_KEY = 'iwashere_attendees_cache';
const LOCAL_SHORTLINKS_KEY = 'iwashere_shortlinks_cache';

function getLocalCache<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalCache<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore quota limits
  }
}

// ==========================================
// 1. ORGANIZATION & TENANT SAAS ARCHITECTURE
// ==========================================

export async function createOrganization(
  name: string,
  adminUid: string,
  adminEmail: string,
  adminName: string,
  accentColor = '#00FF66'
): Promise<Organization> {
  const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const createdAt = new Date().toISOString();

  const newOrg: Organization = {
    id: orgId,
    name: name.trim(),
    adminUid,
    adminEmail,
    adminName: adminName.trim(),
    accentColor: accentColor || '#00FF66',
    createdAt,
  };

  try {
    await setDoc(doc(db, 'organizations', orgId), newOrg);
  } catch (err) {
    console.warn('Firestore write organization fallback to local:', err);
  }

  const cachedOrgs = getLocalCache<Organization>(LOCAL_ORGS_KEY, []);
  setLocalCache(LOCAL_ORGS_KEY, [newOrg, ...cachedOrgs]);

  return newOrg;
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId));
    if (snap.exists()) {
      return snap.data() as Organization;
    }
  } catch (err) {
    console.warn(`Firestore get org ${orgId} error, checking local:`, err);
  }

  const cached = getLocalCache<Organization>(LOCAL_ORGS_KEY, []);
  return cached.find((o) => o.id === orgId) || null;
}

export async function updateOrganization(
  orgId: string,
  updates: Partial<Organization>
): Promise<Organization> {
  const current = (await getOrganization(orgId)) || {
    id: orgId,
    name: 'Organization',
    adminUid: auth.currentUser?.uid || '',
    adminEmail: auth.currentUser?.email || '',
    adminName: auth.currentUser?.displayName || 'Coordinator',
    accentColor: '#00FF66',
    createdAt: new Date().toISOString(),
  };

  const updatedOrg: Organization = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Strip undefined values to prevent Firestore undefined serialization error
  const cleanPayload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updatedOrg)) {
    if (v !== undefined) {
      cleanPayload[k] = v;
    }
  }

  try {
    await setDoc(doc(db, 'organizations', orgId), cleanPayload, { merge: true });
  } catch (err) {
    console.warn('Firestore update organization fallback to local cache:', err);
  }

  const cachedOrgs = getLocalCache<Organization>(LOCAL_ORGS_KEY, []);
  setLocalCache(LOCAL_ORGS_KEY, [
    updatedOrg,
    ...cachedOrgs.filter((o) => o.id !== orgId),
  ]);

  return updatedOrg;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.warn(`Firestore get user profile ${uid} error:`, err);
  }

  const cached = getLocalCache<UserProfile>(LOCAL_USERS_KEY, []);
  return cached.find((u) => u.uid === uid) || null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await setDoc(doc(db, 'users', profile.uid), profile);
  } catch (err) {
    console.warn('Firestore write user profile fallback:', err);
  }

  const cached = getLocalCache<UserProfile>(LOCAL_USERS_KEY, []);
  setLocalCache(LOCAL_USERS_KEY, [profile, ...cached.filter((u) => u.uid !== profile.uid)]);
}

// ==========================================
// 2. AUTHENTICATION & ONBOARDING
// ==========================================

export async function signUpAdmin(
  adminName: string,
  email: string,
  password: string,
  orgName: string,
  accentColor = '#00FF66'
): Promise<{ user: User; org: Organization; profile: UserProfile }> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: adminName });

  const org = await createOrganization(orgName, cred.user.uid, email, adminName, accentColor);

  const profile: UserProfile = {
    uid: cred.user.uid,
    email,
    name: adminName,
    orgId: org.id,
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  await saveUserProfile(profile);

  return { user: cred.user, org, profile };
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<{ user: User; org: Organization | null; profile: UserProfile | null }> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  let profile = await getUserProfile(cred.user.uid);
  let org: Organization | null = null;

  if (profile) {
    org = await getOrganization(profile.orgId);
  } else {
    // If first-time user without profile, check if an org exists or create default
    org = await createOrganization(
      'Medical CDS, Ikeja',
      cred.user.uid,
      cred.user.email || email,
      cred.user.displayName || 'Admin Officer',
      '#00FF66'
    );
    profile = {
      uid: cred.user.uid,
      email: cred.user.email || email,
      name: cred.user.displayName || 'Admin Officer',
      orgId: org.id,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    await saveUserProfile(profile);
  }

  return { user: cred.user, org, profile };
}

export async function signInWithGoogle(): Promise<{
  user: User;
  org: Organization | null;
  profile: UserProfile | null;
}> {
  const cred = await signInWithPopup(auth, googleProvider);
  let profile = await getUserProfile(cred.user.uid);
  let org: Organization | null = null;

  if (profile) {
    org = await getOrganization(profile.orgId);
  } else {
    // Onboard new Google admin with their organization
    const orgTitle = `${cred.user.displayName || 'Corps'}'s Organization`;
    org = await createOrganization(
      orgTitle,
      cred.user.uid,
      cred.user.email || '',
      cred.user.displayName || 'Admin Officer',
      '#00FF66'
    );
    profile = {
      uid: cred.user.uid,
      email: cred.user.email || '',
      name: cred.user.displayName || 'Admin Officer',
      orgId: org.id,
      role: 'admin',
      createdAt: new Date().toISOString(),
    };
    await saveUserProfile(profile);
  }

  return { user: cred.user, org, profile };
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// ==========================================
// 3. TENANT-SCOPED CAMPAIGNS
// ==========================================

export async function createCampaign(
  campaignData: Omit<Campaign, 'id' | 'createdAt'>
): Promise<Campaign> {
  const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  const fullCampaign: Campaign = {
    ...campaignData,
    id: campaignId,
    createdAt,
  };

  const shortLinkData: ShortLink = {
    shortCode: campaignData.shortCode.toLowerCase(),
    campaignId,
    orgId: campaignData.orgId,
    createdAt,
  };

  try {
    await setDoc(doc(db, 'campaigns', campaignId), {
      name: fullCampaign.name,
      orgId: fullCampaign.orgId,
      date: fullCampaign.date,
      targetLatitude: fullCampaign.targetLatitude,
      targetLongitude: fullCampaign.targetLongitude,
      allowedRadius: fullCampaign.allowedRadius,
      shortCode: fullCampaign.shortCode,
      createdAt: fullCampaign.createdAt,
    });

    await setDoc(doc(db, 'short_links', shortLinkData.shortCode), {
      shortCode: shortLinkData.shortCode,
      campaignId: shortLinkData.campaignId,
      orgId: shortLinkData.orgId || '',
      createdAt: shortLinkData.createdAt,
    });
  } catch (error) {
    console.warn('Firestore write failed, updating local fallback cache:', error);
  }

  const cachedCampaigns = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  setLocalCache(LOCAL_CAMPAIGNS_KEY, [fullCampaign, ...cachedCampaigns]);

  const cachedLinks = getLocalCache<ShortLink>(LOCAL_SHORTLINKS_KEY, []);
  setLocalCache(LOCAL_SHORTLINKS_KEY, [shortLinkData, ...cachedLinks]);

  return fullCampaign;
}

export async function getCampaignById(campaignId: string): Promise<Campaign | null> {
  try {
    const snap = await getDoc(doc(db, 'campaigns', campaignId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        orgId: data.orgId || '',
        name: data.name,
        date: data.date,
        targetLatitude: Number(data.targetLatitude),
        targetLongitude: Number(data.targetLongitude),
        allowedRadius: Number(data.allowedRadius),
        shortCode: data.shortCode,
        createdAt: data.createdAt,
      };
    }
  } catch (error) {
    console.warn(`Firestore get campaign ${campaignId} error:`, error);
  }

  const cached = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  return cached.find((c) => c.id === campaignId) || null;
}

export async function resolveShortCode(rawCode: string): Promise<Campaign | null> {
  const shortCode = rawCode.trim().toLowerCase();
  try {
    const snap = await getDoc(doc(db, 'short_links', shortCode));
    if (snap.exists()) {
      const linkData = snap.data() as ShortLink;
      if (linkData.campaignId) {
        return await getCampaignById(linkData.campaignId);
      }
    }
  } catch (error) {
    console.warn(`Firestore short code lookup error:`, error);
  }

  const cachedLinks = getLocalCache<ShortLink>(LOCAL_SHORTLINKS_KEY, []);
  const link = cachedLinks.find((l) => l.shortCode.toLowerCase() === shortCode);
  if (link) {
    return await getCampaignById(link.campaignId);
  }

  return null;
}

export async function getCampaignsForOrg(orgId: string): Promise<Campaign[]> {
  try {
    const q = query(collection(db, 'campaigns'), where('orgId', '==', orgId));
    const snapshot = await getDocs(q);
    const firestoreCampaigns: Campaign[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      firestoreCampaigns.push({
        id: docSnap.id,
        orgId: data.orgId || orgId,
        name: data.name,
        date: data.date,
        targetLatitude: Number(data.targetLatitude),
        targetLongitude: Number(data.targetLongitude),
        allowedRadius: Number(data.allowedRadius),
        shortCode: data.shortCode,
        createdAt: data.createdAt,
      });
    });

    const sorted = firestoreCampaigns.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setLocalCache(LOCAL_CAMPAIGNS_KEY, sorted);
    return sorted;
  } catch (error) {
    console.warn('Could not fetch org campaigns from Firestore, fallback to local cache:', error);
    const cached = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
    return cached.filter((c) => !c.orgId || c.orgId === orgId);
  }
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  try {
    const snapshot = await getDocs(collection(db, 'campaigns'));
    const list: Campaign[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        orgId: data.orgId || '',
        name: data.name,
        date: data.date,
        targetLatitude: Number(data.targetLatitude),
        targetLongitude: Number(data.targetLongitude),
        allowedRadius: Number(data.allowedRadius),
        shortCode: data.shortCode,
        createdAt: data.createdAt,
      });
    });

    const sorted = list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setLocalCache(LOCAL_CAMPAIGNS_KEY, sorted);
    return sorted;
  } catch (error) {
    console.warn('Could not fetch campaigns from Firestore:', error);
    return getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  }
}

/**
 * Clears all campaigns, attendees, and short codes for an organization in Firestore
 */
export async function clearOrganizationCampaignsAndAttendees(orgId: string): Promise<{ deletedCampaigns: number }> {
  let count = 0;
  try {
    const q = query(collection(db, 'campaigns'), where('orgId', '==', orgId));
    const snap = await getDocs(q);
    for (const cDoc of snap.docs) {
      const campId = cDoc.id;
      const data = cDoc.data();
      try {
        const attSnap = await getDocs(collection(db, 'campaigns', campId, 'attendees'));
        for (const aDoc of attSnap.docs) {
          await deleteDoc(doc(db, 'campaigns', campId, 'attendees', aDoc.id));
        }
      } catch (e) {
        console.warn('Error clearing attendees for campaign:', campId, e);
      }
      if (data.shortCode) {
        try {
          await deleteDoc(doc(db, 'short_links', data.shortCode.toLowerCase()));
        } catch {
          // ignore
        }
      }
      await deleteDoc(doc(db, 'campaigns', campId));
      count++;
    }
  } catch (err) {
    console.warn('Error clearing organization campaigns from Firestore:', err);
  }

  setLocalCache(LOCAL_CAMPAIGNS_KEY, []);
  setLocalCache(LOCAL_SHORTLINKS_KEY, []);
  setLocalCache(LOCAL_ATTENDEES_KEY, []);

  return { deletedCampaigns: count };
}

// ==========================================
// 4. ATTENDANCE VERIFICATION & SUBMISSION
// ==========================================

export async function checkStateCodeRegisteredToday(
  campaignId: string,
  stateCode: string,
  targetDate: string
): Promise<boolean> {
  const normalizedCode = stateCode.trim().toUpperCase();

  const cachedAttendees = getLocalCache<Attendee>(LOCAL_ATTENDEES_KEY, []);
  const localMatch = cachedAttendees.some(
    (a) =>
      a.campaignId === campaignId &&
      a.stateCode.trim().toUpperCase() === normalizedCode &&
      a.timestamp.startsWith(targetDate)
  );
  if (localMatch) return true;

  try {
    const q = query(
      collection(db, 'campaigns', campaignId, 'attendees'),
      where('stateCode', '==', normalizedCode)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.some((docSnap) => {
        const data = docSnap.data();
        return data.timestamp && data.timestamp.startsWith(targetDate);
      });
    }
  } catch (error) {
    console.warn(`Firestore checkStateCode query failed:`, error);
  }

  return false;
}

export async function uploadAttendeeImage(
  campaignId: string,
  stateCode: string,
  photoBlob: Blob,
  fallbackDataUrl: string
): Promise<string> {
  const cleanCode = stateCode.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `attendees/${campaignId}/${cleanCode}_${Date.now()}.jpg`;

  try {
    const storageRef = ref(storage, filename);
    const snapshot = await uploadBytes(storageRef, photoBlob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    });
    return await getDownloadURL(snapshot.ref);
  } catch (storageError) {
    console.warn('Firebase Storage upload failed or restricted, using compressed dataUrl:', storageError);
    return fallbackDataUrl;
  }
}

export async function submitAttendance(payload: AttendanceSubmissionPayload): Promise<Attendee> {
  const attendeeId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const photoUrl = await uploadAttendeeImage(
    payload.campaignId,
    payload.stateCode,
    payload.photoBlob,
    payload.photoDataUrl
  );

  const newAttendee: Attendee = {
    id: attendeeId,
    campaignId: payload.campaignId,
    orgId: payload.orgId,
    name: payload.name.trim(),
    stateCode: payload.stateCode.trim().toUpperCase(),
    photoUrl,
    loggedIp: payload.loggedIp,
    latitude: payload.latitude,
    longitude: payload.longitude,
    distanceMeters: payload.distanceMeters,
    timestamp,
    verified: true,
  };

  try {
    await setDoc(doc(db, 'campaigns', payload.campaignId, 'attendees', attendeeId), {
      campaignId: newAttendee.campaignId,
      orgId: newAttendee.orgId || '',
      name: newAttendee.name,
      stateCode: newAttendee.stateCode,
      photoUrl: newAttendee.photoUrl,
      loggedIp: newAttendee.loggedIp,
      latitude: newAttendee.latitude,
      longitude: newAttendee.longitude,
      distanceMeters: newAttendee.distanceMeters,
      timestamp: newAttendee.timestamp,
      verified: true,
    });
  } catch (error) {
    console.warn(`Firestore save attendee failed, updating local fallback:`, error);
  }

  const cached = getLocalCache<Attendee>(LOCAL_ATTENDEES_KEY, []);
  setLocalCache(LOCAL_ATTENDEES_KEY, [newAttendee, ...cached]);

  return newAttendee;
}

export async function getCampaignAttendees(campaignId: string): Promise<Attendee[]> {
  const attendeesMap = new Map<string, Attendee>();

  const cached = getLocalCache<Attendee>(LOCAL_ATTENDEES_KEY, []);
  cached
    .filter((a) => a.campaignId === campaignId)
    .forEach((a) => attendeesMap.set(a.id, a));

  try {
    const snap = await getDocs(collection(db, 'campaigns', campaignId, 'attendees'));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      attendeesMap.set(docSnap.id, {
        id: docSnap.id,
        campaignId: data.campaignId,
        orgId: data.orgId,
        name: data.name,
        stateCode: data.stateCode,
        photoUrl: data.photoUrl,
        loggedIp: data.loggedIp || '127.0.0.1',
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        distanceMeters: Number(data.distanceMeters),
        timestamp: data.timestamp,
        verified: Boolean(data.verified),
        isOfflineSync: Boolean(data.isOfflineSync),
      });
    });
  } catch (error) {
    console.warn(`Could not load attendees from Firestore:`, error);
  }

  return Array.from(attendeesMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ==========================================
// 5. OFFLINE .IWH BATCH IMPORTER & AUDIT
// ==========================================

export async function importOfflineIwhRecord(
  record: OfflineAttendanceRecord,
  campaign: Campaign
): Promise<{ success: boolean; attendee: Attendee; distanceMeters: number; message: string }> {
  // 1. Recalculate distance using ground-truth campaign coordinates
  const verifiedDistance = calculateHaversineDistance(
    record.latitude,
    record.longitude,
    campaign.targetLatitude,
    campaign.targetLongitude
  );

  // Check geofence
  if (verifiedDistance > campaign.allowedRadius) {
    throw new Error(
      `Geofence violation: Attendee coordinates are ${Math.round(verifiedDistance)}m from venue (allowed limit: ${campaign.allowedRadius}m).`
    );
  }

  // 2. Check duplicate
  const dateStr = record.timestamp.split('T')[0];
  const isDuplicate = await checkStateCodeRegisteredToday(campaign.id, record.stateCode, dateStr);
  if (isDuplicate) {
    throw new Error(`Duplicate entry: ${record.stateCode} already registered attendance for this date.`);
  }

  const attendeeId = `att_offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const importedAttendee: Attendee = {
    id: attendeeId,
    campaignId: campaign.id,
    orgId: campaign.orgId,
    name: record.name.trim(),
    stateCode: record.stateCode.trim().toUpperCase(),
    photoUrl: record.base64Image,
    loggedIp: 'Offline Device Sync',
    latitude: record.latitude,
    longitude: record.longitude,
    distanceMeters: Math.round(verifiedDistance),
    timestamp: record.timestamp,
    verified: true,
    isOfflineSync: true,
  };

  try {
    await setDoc(doc(db, 'campaigns', campaign.id, 'attendees', attendeeId), {
      campaignId: importedAttendee.campaignId,
      orgId: importedAttendee.orgId || '',
      name: importedAttendee.name,
      stateCode: importedAttendee.stateCode,
      photoUrl: importedAttendee.photoUrl,
      loggedIp: importedAttendee.loggedIp,
      latitude: importedAttendee.latitude,
      longitude: importedAttendee.longitude,
      distanceMeters: importedAttendee.distanceMeters,
      timestamp: importedAttendee.timestamp,
      verified: true,
      isOfflineSync: true,
    });
  } catch (err) {
    console.warn('Firestore offline sync write failed, cached locally:', err);
  }

  const cached = getLocalCache<Attendee>(LOCAL_ATTENDEES_KEY, []);
  setLocalCache(LOCAL_ATTENDEES_KEY, [importedAttendee, ...cached]);

  return {
    success: true,
    attendee: importedAttendee,
    distanceMeters: Math.round(verifiedDistance),
    message: `Verified and imported ${importedAttendee.stateCode} (${Math.round(verifiedDistance)}m from venue).`,
  };
}

// ==========================================
// 6. DEFAULT BOOTSTRAPPER SEED
// ==========================================

export async function initializeDefaultOrgAndCampaign(): Promise<{
  org: Organization | null;
  campaign: Campaign | null;
}> {
  const existingCampaigns = await getAllCampaigns();
  const existingOrgs = getLocalCache<Organization>(LOCAL_ORGS_KEY, []);

  return {
    org: existingOrgs[0] || null,
    campaign: existingCampaigns[0] || null,
  };
}
