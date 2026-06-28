import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import firebaseConfigOrig from '../../firebase-applet-config.json';

const firebaseConfig = firebaseConfigOrig as any;

export const getStoredFirebaseConfig = () => {
  try {
    const override = localStorage.getItem('FIREBASE_CONFIG_OVERRIDE');
    if (override) {
      const parsed = JSON.parse(override);
      if (parsed && typeof parsed === 'object') {
        const apiKey = parsed.apiKey || parsed.VITE_FIREBASE_API_KEY;
        if (apiKey) {
          // Flatten any nested configs or handle environment keys
          return {
            apiKey: apiKey,
            authDomain: parsed.authDomain || parsed.VITE_FIREBASE_AUTH_DOMAIN || "MISSING",
            projectId: parsed.projectId || parsed.VITE_FIREBASE_PROJECT_ID || "MISSING",
            storageBucket: parsed.storageBucket || parsed.VITE_FIREBASE_STORAGE_BUCKET || "MISSING",
            messagingSenderId: parsed.messagingSenderId || parsed.VITE_FIREBASE_MESSAGING_SENDER_ID || "MISSING",
            appId: parsed.appId || parsed.VITE_FIREBASE_APP_ID || "MISSING",
            firestoreDatabaseId: parsed.firestoreDatabaseId || parsed.databaseId || firebaseConfig.firestoreDatabaseId
          };
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse Firebase config override", e);
  }
  return null;
};

const DEFAULT_FALLBACK_API_KEY = "AIzaSyC5coZPsT76YDr9hTlTG5xTc3IuQ2cvqDE";
const DEFAULT_FALLBACK_AUTH_DOMAIN = "teengenius-43000.firebaseapp.com";
const DEFAULT_FALLBACK_PROJECT_ID = "teengenius-43000";
const DEFAULT_FALLBACK_STORAGE_BUCKET = "teengenius-43000.firebasestorage.app";
const DEFAULT_FALLBACK_MESSAGING_SENDER_ID = "634192176619";
const DEFAULT_FALLBACK_APP_ID = "1:634192176619:web:39b80d56d2bbf5e56925ae";
const DEFAULT_FALLBACK_FIRESTORE_DB_ID = "ai-studio-eb8b64c6-0bd5-4367-9f60-afed3357308c";

const getFirebaseConfigValues = () => {
  const custom = getStoredFirebaseConfig();
  if (custom) return custom;

  const getVal = (envVal: string | undefined, fileVal: string | undefined, defaultFallback: string): string => {
    const val = envVal || fileVal;
    if (!val || val === "MISSING" || val === "none") {
      return defaultFallback;
    }
    return val;
  };

  return {
    apiKey: getVal(import.meta.env.VITE_FIREBASE_API_KEY as string, firebaseConfig?.apiKey, DEFAULT_FALLBACK_API_KEY),
    authDomain: getVal(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string, firebaseConfig?.authDomain, DEFAULT_FALLBACK_AUTH_DOMAIN),
    projectId: getVal(import.meta.env.VITE_FIREBASE_PROJECT_ID as string, firebaseConfig?.projectId, DEFAULT_FALLBACK_PROJECT_ID),
    storageBucket: getVal(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string, firebaseConfig?.storageBucket, DEFAULT_FALLBACK_STORAGE_BUCKET),
    messagingSenderId: getVal(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string, firebaseConfig?.messagingSenderId, DEFAULT_FALLBACK_MESSAGING_SENDER_ID),
    appId: getVal(import.meta.env.VITE_FIREBASE_APP_ID as string, firebaseConfig?.appId, DEFAULT_FALLBACK_APP_ID),
    firestoreDatabaseId: getVal(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string, firebaseConfig?.firestoreDatabaseId, DEFAULT_FALLBACK_FIRESTORE_DB_ID)
  };
};

const firebaseConfigValues = getFirebaseConfigValues();

function initializeFirebase() {
  try {
    if (getApps().length > 0) {
      return getApp();
    }
    if (firebaseConfigValues.apiKey === "MISSING" || !firebaseConfigValues.apiKey || firebaseConfigValues.apiKey === "none") {
      throw new Error("Firebase API Key is missing");
    }
    return initializeApp(firebaseConfigValues);
  } catch (error) {
    console.error("Firebase Initialization Failed:", error);
    // Return a minimal app to avoid crashes, though Auth/Firestore will fail later
    return initializeApp({ apiKey: "none", projectId: "none", appId: "none" });
  }
}

const app = initializeFirebase();

const dbId = (firebaseConfigValues.firestoreDatabaseId || "").trim() || (firebaseConfig.firestoreDatabaseId || "").trim();
export const db = dbId && dbId !== "" && dbId !== "(default)" 
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId) 
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export const auth = getAuth(app);

// Realtime Database
export const realtimeDb = getDatabase(app);

// Cloud Storage
export const storage = getStorage(app);

// Mocked Analytics constant
export const analytics = null;

// Connectivity check
export const isFirebaseConfigured = firebaseConfigValues.apiKey !== "MISSING" && firebaseConfigValues.apiKey !== "none" && !!firebaseConfigValues.apiKey;

async function testConnection() {
  if (!isFirebaseConfigured) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error?.message?.includes('the client is offline') || error?.message?.includes('permission-denied') || error?.message?.includes('missing or insufficient permissions')) {
      console.warn("Firebase connection warning:", error.message);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
