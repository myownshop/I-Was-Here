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
  initializeFirestore,
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

// CRITICAL: Initialize Firestore with experimentalForceLongPolling for robust connection in iframe/proxy environments
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
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

// Helper to prevent Firestore getDoc/getDocs from hanging indefinitely on cold connections
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore query timeout of ${timeoutMs}ms exceeded`)), timeoutMs)
    ),
  ]);
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  // 1. Fast local cache lookup (0ms)
  const cached = getLocalCache<Organization>(LOCAL_ORGS_KEY, []);
  const localOrg = cached.find((o) => o.id === orgId);
  if (localOrg) {
    // Background refresh
    withTimeout(getDoc(doc(db, 'organizations', orgId)), 2000)
      .then((snap) => {
        if (snap && snap.exists()) {
          const freshOrg = snap.data() as Organization;
          setLocalCache(LOCAL_ORGS_KEY, [
            freshOrg,
            ...cached.filter((o) => o.id !== orgId),
          ]);
        }
      })
      .catch(() => {});
    return localOrg;
  }

  // 2. Network lookup with timeout
  try {
    const snap = await withTimeout(getDoc(doc(db, 'organizations', orgId)), 2500);
    if (snap.exists()) {
      const org = snap.data() as Organization;
      setLocalCache(LOCAL_ORGS_KEY, [org, ...cached]);
      return org;
    }
  } catch (err) {
    console.warn(`Firestore get org ${orgId} error, checking local:`, err);
  }

  return null;
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
    status: 'active',
    isClosed: false,
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
      timeBlocks: fullCampaign.timeBlocks || [],
      createdAt: fullCampaign.createdAt,
      status: 'active',
      isClosed: false,
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

/**
 * Updates an existing CDS session's details (name, date, geofence, radius, shortCode, timeBlocks, status).
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<Omit<Campaign, 'id' | 'createdAt'>>
): Promise<Campaign> {
  const cachedCampaigns = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  const existing = cachedCampaigns.find((c) => c.id === campaignId);

  const updatedCampaign: Campaign = {
    id: campaignId,
    orgId: updates.orgId ?? existing?.orgId ?? '',
    name: updates.name ?? existing?.name ?? 'Updated Session',
    date: updates.date ?? existing?.date ?? new Date().toISOString().split('T')[0],
    targetLatitude: updates.targetLatitude ?? existing?.targetLatitude ?? 0,
    targetLongitude: updates.targetLongitude ?? existing?.targetLongitude ?? 0,
    allowedRadius: updates.allowedRadius ?? existing?.allowedRadius ?? 100,
    shortCode: (updates.shortCode ?? existing?.shortCode ?? '').toLowerCase().trim(),
    timeBlocks: updates.timeBlocks ?? existing?.timeBlocks ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    status: updates.status ?? existing?.status ?? 'active',
    isClosed: updates.isClosed !== undefined ? updates.isClosed : (existing?.isClosed ?? false),
    closedAt: updates.closedAt !== undefined ? updates.closedAt : existing?.closedAt,
  };

  try {
    const campaignRef = doc(db, 'campaigns', campaignId);
    await setDoc(
      campaignRef,
      {
        name: updatedCampaign.name,
        orgId: updatedCampaign.orgId,
        date: updatedCampaign.date,
        targetLatitude: Number(updatedCampaign.targetLatitude),
        targetLongitude: Number(updatedCampaign.targetLongitude),
        allowedRadius: Number(updatedCampaign.allowedRadius),
        shortCode: updatedCampaign.shortCode,
        timeBlocks: updatedCampaign.timeBlocks || [],
        status: updatedCampaign.status,
        isClosed: updatedCampaign.isClosed,
        closedAt: updatedCampaign.closedAt || null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    if (updatedCampaign.shortCode) {
      await setDoc(
        doc(db, 'short_links', updatedCampaign.shortCode),
        {
          shortCode: updatedCampaign.shortCode,
          campaignId,
          orgId: updatedCampaign.orgId || '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    console.warn('Firestore updateCampaign write error, updating cache fallback:', error);
  }

  const updatedList = cachedCampaigns.map((c) => (c.id === campaignId ? updatedCampaign : c));
  if (!cachedCampaigns.some((c) => c.id === campaignId)) {
    updatedList.unshift(updatedCampaign);
  }
  setLocalCache(LOCAL_CAMPAIGNS_KEY, updatedList);

  return updatedCampaign;
}

/**
 * Deletes a session and cleans up local caches.
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'campaigns', campaignId));
  } catch (error) {
    console.warn('Firestore deleteCampaign error:', error);
  }

  const cached = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  setLocalCache(
    LOCAL_CAMPAIGNS_KEY,
    cached.filter((c) => c.id !== campaignId)
  );
}

/**
 * Ends/closes an active session, marking it as closed and moving it to history.
 */
export async function closeCampaign(campaignId: string): Promise<Campaign> {
  const closedAt = new Date().toISOString();
  let updatedCampaign: Campaign | null = null;

  try {
    const campaignRef = doc(db, 'campaigns', campaignId);
    await setDoc(
      campaignRef,
      {
        status: 'closed',
        isClosed: true,
        closedAt,
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Firestore close campaign write error, updating cache fallback:', error);
  }

  const cached = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  const updatedList = cached.map((c) => {
    if (c.id === campaignId) {
      updatedCampaign = {
        ...c,
        status: 'closed' as const,
        isClosed: true,
        closedAt,
      };
      return updatedCampaign;
    }
    return c;
  });

  setLocalCache(LOCAL_CAMPAIGNS_KEY, updatedList);

  if (updatedCampaign) {
    return updatedCampaign;
  }

  return {
    id: campaignId,
    orgId: '',
    name: 'Closed Session',
    date: new Date().toISOString().split('T')[0],
    targetLatitude: 0,
    targetLongitude: 0,
    allowedRadius: 100,
    shortCode: '',
    createdAt: new Date().toISOString(),
    status: 'closed',
    isClosed: true,
    closedAt,
  };
}

/**
 * Re-opens a previously closed session.
 */
export async function reopenCampaign(campaignId: string): Promise<Campaign> {
  let updatedCampaign: Campaign | null = null;

  try {
    const campaignRef = doc(db, 'campaigns', campaignId);
    await setDoc(
      campaignRef,
      {
        status: 'active',
        isClosed: false,
        closedAt: null,
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Firestore reopen campaign write error, updating cache fallback:', error);
  }

  const cached = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  const updatedList = cached.map((c) => {
    if (c.id === campaignId) {
      updatedCampaign = {
        ...c,
        status: 'active' as const,
        isClosed: false,
        closedAt: undefined,
      };
      return updatedCampaign;
    }
    return c;
  });

  setLocalCache(LOCAL_CAMPAIGNS_KEY, updatedList);

  if (updatedCampaign) {
    return updatedCampaign;
  }

  return {
    id: campaignId,
    orgId: '',
    name: 'Active Session',
    date: new Date().toISOString().split('T')[0],
    targetLatitude: 0,
    targetLongitude: 0,
    allowedRadius: 100,
    shortCode: '',
    createdAt: new Date().toISOString(),
    status: 'active',
    isClosed: false,
  };
}

export async function getCampaignById(campaignId: string): Promise<Campaign | null> {
  // 1. Fast local cache lookup (0ms)
  const cached = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  const localMatch = cached.find((c) => c.id === campaignId);
  if (localMatch) {
    // Non-blocking background sync
    withTimeout(getDoc(doc(db, 'campaigns', campaignId)), 2000)
      .then((snap) => {
        if (snap && snap.exists()) {
          const data = snap.data();
          const refreshed: Campaign = {
            id: snap.id,
            orgId: data.orgId || '',
            name: data.name,
            date: data.date,
            targetLatitude: Number(data.targetLatitude),
            targetLongitude: Number(data.targetLongitude),
            allowedRadius: Number(data.allowedRadius),
            shortCode: data.shortCode,
            timeBlocks: data.timeBlocks || [],
            createdAt: data.createdAt,
            status: data.status || (data.isClosed ? 'closed' : 'active'),
            isClosed: Boolean(data.isClosed || data.status === 'closed'),
            closedAt: data.closedAt || undefined,
          };
          setLocalCache(LOCAL_CAMPAIGNS_KEY, [
            refreshed,
            ...cached.filter((c) => c.id !== campaignId),
          ]);
        }
      })
      .catch(() => {});
    return localMatch;
  }

  // 2. Network lookup with timeout
  try {
    const snap = await withTimeout(getDoc(doc(db, 'campaigns', campaignId)), 2500);
    if (snap.exists()) {
      const data = snap.data();
      const campaign: Campaign = {
        id: snap.id,
        orgId: data.orgId || '',
        name: data.name,
        date: data.date,
        targetLatitude: Number(data.targetLatitude),
        targetLongitude: Number(data.targetLongitude),
        allowedRadius: Number(data.allowedRadius),
        shortCode: data.shortCode,
        timeBlocks: data.timeBlocks || [],
        createdAt: data.createdAt,
        status: data.status || (data.isClosed ? 'closed' : 'active'),
        isClosed: Boolean(data.isClosed || data.status === 'closed'),
        closedAt: data.closedAt || undefined,
      };
      setLocalCache(LOCAL_CAMPAIGNS_KEY, [campaign, ...cached]);
      return campaign;
    }
  } catch (error) {
    console.warn(`Firestore get campaign ${campaignId} error:`, error);
  }

  return null;
}

export async function resolveShortCode(rawCode: string): Promise<Campaign | null> {
  const shortCode = rawCode.trim().toLowerCase();

  // 1. Fast local cache check first (0ms)
  const cachedLinks = getLocalCache<ShortLink>(LOCAL_SHORTLINKS_KEY, []);
  const link = cachedLinks.find((l) => l.shortCode.toLowerCase() === shortCode);
  if (link && link.campaignId) {
    const cachedCampaigns = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
    const match = cachedCampaigns.find((c) => c.id === link.campaignId);
    if (match) return match;
  }

  const cachedCampaigns = getLocalCache<Campaign>(LOCAL_CAMPAIGNS_KEY, []);
  const directMatch = cachedCampaigns.find(
    (c) => c.shortCode?.toLowerCase() === shortCode || c.id === rawCode
  );
  if (directMatch) return directMatch;

  // 2. Query short_links collection with timeout
  try {
    const snap = await withTimeout(getDoc(doc(db, 'short_links', shortCode)), 2500);
    if (snap.exists()) {
      const linkData = snap.data() as ShortLink;
      if (linkData.campaignId) {
        const camp = await getCampaignById(linkData.campaignId);
        if (camp) return camp;
      }
    }
  } catch (error) {
    console.warn(`Firestore short code lookup error:`, error);
  }

  // 3. Query campaigns collection directly with timeout
  try {
    const q = query(collection(db, 'campaigns'), where('shortCode', '==', shortCode));
    const snap = await withTimeout(getDocs(q), 2500);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const campaign: Campaign = {
        id: docSnap.id,
        orgId: data.orgId || '',
        name: data.name,
        date: data.date,
        targetLatitude: Number(data.targetLatitude),
        targetLongitude: Number(data.targetLongitude),
        allowedRadius: Number(data.allowedRadius),
        shortCode: data.shortCode,
        timeBlocks: data.timeBlocks || [],
        createdAt: data.createdAt,
        status: data.status || (data.isClosed ? 'closed' : 'active'),
        isClosed: Boolean(data.isClosed || data.status === 'closed'),
        closedAt: data.closedAt || undefined,
      };
      setLocalCache(LOCAL_CAMPAIGNS_KEY, [campaign, ...cachedCampaigns]);
      return campaign;
    }
  } catch (error) {
    console.warn('Firestore campaign query by shortCode error:', error);
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
        timeBlocks: data.timeBlocks || [],
        createdAt: data.createdAt,
        status: data.status || (data.isClosed ? 'closed' : 'active'),
        isClosed: Boolean(data.isClosed || data.status === 'closed'),
        closedAt: data.closedAt || undefined,
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
        timeBlocks: data.timeBlocks || [],
        createdAt: data.createdAt,
        status: data.status || (data.isClosed ? 'closed' : 'active'),
        isClosed: Boolean(data.isClosed || data.status === 'closed'),
        closedAt: data.closedAt || undefined,
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
    // Fast 2-second timeout guard
    const snapshot = await withTimeout(getDocs(q), 2000);
    if (!snapshot.empty) {
      return snapshot.docs.some((docSnap) => {
        const data = docSnap.data();
        return data.timestamp && data.timestamp.startsWith(targetDate);
      });
    }
  } catch (error) {
    console.warn(`Firestore checkStateCode query timeout or error:`, error);
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
    // Fast 2-second deadline for storage upload to avoid stalling on low-bandwidth connections
    const snapshot = await withTimeout(
      uploadBytes(storageRef, photoBlob, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      }),
      2000
    );
    return await withTimeout(getDownloadURL(snapshot.ref), 1500);
  } catch (storageError) {
    console.warn('Firebase Storage upload skipped/timed out (saving bandwidth), using compressed dataUrl:', storageError);
    return fallbackDataUrl;
  }
}

export async function submitAttendance(payload: AttendanceSubmissionPayload): Promise<Attendee> {
  const attendeeId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  // Upload image or fall back immediately to lightweight compressed dataUrl
  const photoUrl = await uploadAttendeeImage(
    payload.campaignId,
    payload.stateCode,
    payload.photoBlob,
    payload.photoDataUrl
  );

  const isTampered = Boolean(payload.tampered);
  const timeBlockCode = payload.timeBlockCode?.trim().toUpperCase() || undefined;

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
    timeBlockCode,
    tampered: isTampered,
    attendanceStatus: isTampered ? 'flagged' : 'present',
  };

  try {
    // 3.5s timeout for Firestore setDoc
    await withTimeout(
      setDoc(doc(db, 'campaigns', payload.campaignId, 'attendees', attendeeId), {
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
        timeBlockCode: newAttendee.timeBlockCode || null,
        tampered: isTampered,
        attendanceStatus: newAttendee.attendanceStatus,
      }),
      3500
    );
  } catch (error) {
    console.warn(`Firestore save attendee timed out or offline, stored in local cache:`, error);
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
        tampered: Boolean(data.tampered),
        timeBlockCode: data.timeBlockCode || undefined,
        attendanceStatus: data.attendanceStatus || (data.tampered ? 'flagged' : 'present'),
        validationNotes: data.validationNotes || undefined,
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
): Promise<{ success: boolean; attendee: Attendee; distanceMeters: number; message: string; isTampered: boolean; isLate: boolean }> {
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

  // 3. Anti-Tampering Validation
  const isTampered = Boolean(record.tampered);
  let attendanceStatus: 'present' | 'late' | 'flagged' = isTampered ? 'flagged' : 'present';
  const notesList: string[] = [];

  if (isTampered) {
    notesList.push('Clock Manipulated: System clock mismatch detected by hardware anti-tampering engine.');
  }

  // 4. Time-Block Validation
  let isLate = false;
  if (campaign.timeBlocks && campaign.timeBlocks.length > 0) {
    const matchingBlock = record.timeBlockCode
      ? campaign.timeBlocks.find((b) => b.code.toUpperCase() === record.timeBlockCode?.trim().toUpperCase())
      : undefined;

    const timeStr = record.timestamp.split('T')[1]?.substring(0, 5) || '00:00';
    const [hours, mins] = timeStr.split(':').map(Number);
    const submissionMinutes = hours * 60 + mins;

    if (matchingBlock) {
      const [endH, endM] = matchingBlock.endTime.split(':').map(Number);
      const endLimitMinutes = endH * 60 + endM + 5; // 5-minute grace period

      const [startH, startM] = matchingBlock.startTime.split(':').map(Number);
      const startLimitMinutes = startH * 60 + startM - 5;

      if (submissionMinutes > endLimitMinutes || submissionMinutes < startLimitMinutes) {
        isLate = true;
        if (!isTampered) attendanceStatus = 'late';
        notesList.push(`Late Submission: Window ${matchingBlock.code} ended at ${matchingBlock.endTime}, logged at ${timeStr}.`);
      }
    } else if (record.timeBlockCode) {
      isLate = true;
      if (!isTampered) attendanceStatus = 'late';
      notesList.push(`Unrecognized Time-Block Code: ${record.timeBlockCode}.`);
    }
  }

  const validationNotes = notesList.length > 0 ? notesList.join(' | ') : undefined;

  // 5. Upload facial verification photo to Firebase Storage
  let photoUrl = record.base64Image;
  try {
    if (record.base64Image && record.base64Image.startsWith('data:')) {
      const parts = record.base64Image.split(';base64,');
      if (parts.length === 2) {
        const byteCharacters = atob(parts[1]);
        const arrayBuffer = new ArrayBuffer(byteCharacters.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteCharacters.length; i++) {
          uint8Array[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
        photoUrl = await uploadAttendeeImage(campaign.id, record.stateCode, blob, record.base64Image);
      }
    }
  } catch (err) {
    console.warn('Storage image upload failed during offline import, falling back to data URL:', err);
  }

  const attendeeId = `att_offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const importedAttendee: Attendee = {
    id: attendeeId,
    campaignId: campaign.id,
    orgId: campaign.orgId,
    name: record.name.trim(),
    stateCode: record.stateCode.trim().toUpperCase(),
    photoUrl,
    loggedIp: 'Offline .IWH Importer',
    latitude: record.latitude,
    longitude: record.longitude,
    distanceMeters: Math.round(verifiedDistance),
    timestamp: record.timestamp,
    verified: true,
    isOfflineSync: true,
    timeBlockCode: record.timeBlockCode?.trim().toUpperCase(),
    tampered: isTampered,
    attendanceStatus,
    validationNotes,
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
      timeBlockCode: importedAttendee.timeBlockCode || null,
      tampered: isTampered,
      attendanceStatus,
      validationNotes: validationNotes || null,
      importedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore offline sync write failed, cached locally:', err);
  }

  const cached = getLocalCache<Attendee>(LOCAL_ATTENDEES_KEY, []);
  setLocalCache(LOCAL_ATTENDEES_KEY, [importedAttendee, ...cached]);

  let statusMsg = `Verified and imported ${importedAttendee.stateCode}`;
  if (isTampered) {
    statusMsg += ` [⚠️ CLOCK MANIPULATED]`;
  } else if (isLate) {
    statusMsg += ` [⏱️ LATE]`;
  } else {
    statusMsg += ` (${Math.round(verifiedDistance)}m from venue)`;
  }

  return {
    success: true,
    attendee: importedAttendee,
    distanceMeters: Math.round(verifiedDistance),
    message: statusMsg,
    isTampered,
    isLate,
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
