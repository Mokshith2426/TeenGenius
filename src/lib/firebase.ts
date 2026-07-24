import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

/**
 * Deterministic Firebase initialization for the canonical TeenGenius project.
 *
 * Config resolution: use VITE_FIREBASE_* values when explicitly provided,
 * otherwise fall back to the canonical Firebase Web SDK configuration below.
 * There is NO localStorage override, NO sandbox project detection, NO runtime
 * project switching, and NO configurable Firestore database id.
 */
const CANONICAL_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDqaP4LT03DymBTO6_60rph7XnAXFeH898',
  authDomain: 'teengenius-ef7a3.firebaseapp.com',
  databaseURL: 'https://teengenius-ef7a3-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'teengenius-ef7a3',
  storageBucket: 'teengenius-ef7a3.firebasestorage.app',
  messagingSenderId: '113625184041',
  appId: '1:113625184041:web:102936ee4c5e94ce406938',
  measurementId: 'G-PBQHSK7CKP',
} as const;

const EXPECTED_PROJECT_ID = 'teengenius-ef7a3';

const pick = (envValue: unknown, canonical: string): string => {
  const v = (envValue ?? '').toString().trim().replace(/^["']+|["']+$/g, '').trim();
  return v && v !== 'MISSING' && v !== 'none' ? v : canonical;
};

const env = import.meta.env as any;

const firebaseConfig = {
  apiKey: pick(env.VITE_FIREBASE_API_KEY, CANONICAL_FIREBASE_CONFIG.apiKey),
  authDomain: pick(env.VITE_FIREBASE_AUTH_DOMAIN, CANONICAL_FIREBASE_CONFIG.authDomain),
  databaseURL: pick(env.VITE_FIREBASE_DATABASE_URL, CANONICAL_FIREBASE_CONFIG.databaseURL),
  projectId: pick(env.VITE_FIREBASE_PROJECT_ID, CANONICAL_FIREBASE_CONFIG.projectId),
  storageBucket: pick(env.VITE_FIREBASE_STORAGE_BUCKET, CANONICAL_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: pick(env.VITE_FIREBASE_MESSAGING_SENDER_ID, CANONICAL_FIREBASE_CONFIG.messagingSenderId),
  appId: pick(env.VITE_FIREBASE_APP_ID, CANONICAL_FIREBASE_CONFIG.appId),
  measurementId: pick(env.VITE_FIREBASE_MEASUREMENT_ID, CANONICAL_FIREBASE_CONFIG.measurementId),
};

// Never silently switch projects: refuse to boot against the wrong project.
if (firebaseConfig.projectId !== EXPECTED_PROJECT_ID) {
  throw new Error(
    `Firebase configuration error: resolved projectId "${firebaseConfig.projectId}" is not the canonical TeenGenius project ("${EXPECTED_PROJECT_ID}").`
  );
}

// getApps()/getApp() guards against duplicate initialization under Vite HMR.
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Development-only diagnostics — never logs the API key or full config.
if (import.meta.env.DEV) {
}

// Cloud Firestore — the (default) database for teengenius-ef7a3.
// Initialized exactly once, with auto-detected long polling for restrictive networks.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

// Firebase Authentication.
export const auth = getAuth(app);

// Realtime Database (the databaseURL above is an RTDB URL, NOT a Firestore db id).
export const realtimeDb = getDatabase(app);

// Cloud Storage.
export const storage = getStorage(app);

// Analytics initializes safely and optionally. It must NEVER break app startup:
// isSupported() gates getAnalytics(), and any failure is swallowed.
export let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported()
  .then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch {
        analytics = null;
      }
    }
  })
  .catch(() => {
    analytics = null;
  });

export const isFirebaseConfigured = firebaseConfig.projectId === EXPECTED_PROJECT_ID && !!firebaseConfig.apiKey;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Normalizes Firestore errors into concise, user-facing messages while preserving
 * the Firebase error code. Never logs auth tokens, API keys, or full documents.
 * `failed-precondition` (often a missing composite index) keeps its raw diagnostic.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const code = (error as any)?.code || '';
  const rawMessage = error instanceof Error ? error.message : String(error);

  let friendly: string;
  switch (code) {
    case 'permission-denied':
      friendly = 'You do not have permission to perform this action.';
      break;
    case 'unauthenticated':
      friendly = 'Please sign in and try again.';
      break;
    case 'unavailable':
      friendly = 'Firebase is temporarily unavailable. Please try again.';
      break;
    case 'not-found':
      friendly = 'The requested item could not be found.';
      break;
    case 'failed-precondition':
      // Preserve useful diagnostics (e.g. a missing composite index link).
      friendly = rawMessage;
      break;
    default:
      friendly = rawMessage || 'Something went wrong. Please try again.';
  }

  if (import.meta.env.DEV) {
    console.error(`[Firestore ${operationType}] code=${code || 'unknown'} path=${path ?? '-'} :: ${friendly}`);
  }

  const normalized: any = new Error(friendly);
  normalized.code = code;
  throw normalized;
}
