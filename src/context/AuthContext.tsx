import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  onAuthStateChanged,
  User,
  signOut,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isGuest: boolean;
  loading: boolean;
  authActionLoading: boolean;
  userRole: 'student' | 'teacher';
  setUserRole: (role: 'student' | 'teacher') => void;
  signInGoogle: () => Promise<void>;
  signInGuest: () => Promise<void>;
  logout: () => Promise<void>;
  showGuestPrompt: boolean;
  setShowGuestPrompt: (show: boolean) => void;
  guestPromptAction: string;
  triggerGuestPrompt: (action: string) => void;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserInContext: (updatedUserProps: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// One shared Google provider instance, configured once.
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Convert a Firebase auth error into a concise, user-facing message.
function normalizeAuthError(err: any): Error {
  const code = err?.code || '';
  const map: Record<string, string> = {
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled for this Firebase project.',
    'auth/admin-restricted-operation': 'Guest sign-in is not enabled for this Firebase project.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  };
  const normalized: any = new Error(map[code] || err?.message || 'Authentication failed. Please try again.');
  normalized.code = code;
  return normalized;
}

/**
 * Single source of truth for creating/refreshing users/{uid}.
 * Works for Google, anonymous (guest), and email/password users. It creates the
 * document only when absent (never overwriting an existing profile), and otherwise
 * updates only presence/streak fields. Uses serverTimestamp() so createdAt matches
 * the request.time check in firestore.rules.
 */
async function ensureUserDocument(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? (user.isAnonymous ? 'Guest Student' : 'Student'),
      photoURL: user.photoURL ?? null,
      isAnonymous: user.isAnonymous,
      isOnline: true,
      friendIds: [],
      xp: 0,
      badges: [],
      streak: 0,
      weeklyXp: 0,
      lastActiveDate: todayStr,
      createdAt: serverTimestamp(),
    });
    return;
  }

  // Existing profile: update only presence + streak fields (all rule-allowed keys).
  const data = snap.data() as any;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  const lastActive = data.lastActiveDate || '';
  let nextStreak = data.streak || 0;
  let nextXp = data.xp || 0;
  let nextWeeklyXp = data.weeklyXp || 0;

  if (lastActive === '') {
    nextStreak = Math.max(nextStreak, 1);
  } else if (lastActive === yesterdayStr) {
    nextStreak = (data.streak || 0) + 1;
    nextXp = nextXp + 20;
    nextWeeklyXp = nextWeeklyXp + 20;
  } else if (lastActive !== todayStr) {
    nextStreak = 1;
  }

  await setDoc(
    userRef,
    {
      isOnline: true,
      streak: nextStreak,
      lastActiveDate: todayStr,
      xp: nextXp,
      weeklyXp: nextWeeklyXp,
    },
    { merge: true }
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestPromptAction, setGuestPromptAction] = useState('');
  const [userRole, setUserRoleState] = useState<'student' | 'teacher'>(() => {
    const saved = localStorage.getItem('teengenius_user_role');
    return saved === 'teacher' || saved === 'student' ? saved : 'student';
  });

  // In-flight Google sign-in guard to prevent duplicate popup requests.
  const googleSignInPromiseRef = useRef<Promise<void> | null>(null);

  const setUserRole = (role: 'student' | 'teacher') => {
    setUserRoleState(role);
    localStorage.setItem('teengenius_user_role', role);
  };

  const triggerGuestPrompt = (action: string) => {
    setGuestPromptAction(action);
    setShowGuestPrompt(true);
  };

  useEffect(() => {
    // Process a pending Google redirect result exactly once during init.
    // onAuthStateChanged is the source of truth for the resulting user, so we do
    // NOT set user/loading here — we only surface unexpected errors in dev.
    getRedirectResult(auth).catch((err: any) => {
      if (err?.code !== 'auth/no-auth-event') {
        console.warn('[Auth] redirect result error:', err?.code || err?.message);
      }
    });

    // Single onAuthStateChanged subscription is the authoritative auth state.
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setLoading(false);

      if (fbUser) {
        // Non-blocking profile sync. A permission/offline error here must not
        // block the authenticated UI.
        ensureUserDocument(fbUser).catch((err) => {
          console.warn('[Auth] user document sync deferred:', err?.code || err?.message || err);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const signInGoogle = async () => {
    // Prevent duplicate concurrent Google sign-in popups.
    if (googleSignInPromiseRef.current) {
      return googleSignInPromiseRef.current;
    }

    const operation = (async () => {
      setAuthActionLoading(true);
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err: any) {
        const code = err?.code || '';
        const message = err?.message || String(err);

        // [AUTH DEBUG]
        console.log("[AUTH DEBUG]", {
          operation: "google-sign-in",
          errorCode: code || "none",
          errorName: err?.name || "none",
          sanitizedMessage: message.replace(/AIza[0-9A-Za-z\-_]{10,}/g, "[REDACTED_KEY]"),
        });

        // User dismissed the popup — do not fall back to a redirect.
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          throw normalizeAuthError(err);
        }

        // Environments where popups are blocked/unsupported: fall back to redirect once.
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, googleProvider);
          return;
        }

        if (code === 'auth/operation-not-allowed') {
          throw new Error('Google Sign-In is not enabled for this Firebase project.');
        }

        throw normalizeAuthError(err);
      } finally {
        setAuthActionLoading(false);
        googleSignInPromiseRef.current = null;
      }
    })();

    googleSignInPromiseRef.current = operation;
    return operation;
  };

  const isGuest = !!user?.isAnonymous;

  const signInGuest = async () => {
    setAuthActionLoading(true);
    try {
      // Real Firebase Anonymous Authentication. onAuthStateChanged receives the
      // anonymous user (user.isAnonymous === true); we never fabricate a user.
      await signInAnonymously(auth);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        throw new Error('Guest sign-in is not enabled for this Firebase project.');
      }
      throw normalizeAuthError(err);
    } finally {
      setAuthActionLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false }, { merge: true }).catch(() => {});
      }
      await signOut(auth);
    } catch (err) {
      console.warn('[Auth] signOut warning:', err);
    }
    // Clear only TeenGenius-owned session state; leave unrelated localStorage intact.
    ['LOCAL_SANDBOX_USER', 'pending_study_prompt', 'TEEN_GENIUS_LAST_ERROR'].forEach((k) =>
      localStorage.removeItem(k)
    );
    // onAuthStateChanged will set user to null.
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    setAuthActionLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: fullName });
      await ensureUserDocument(userCredential.user);
      // onAuthStateChanged already fired with the new user; no manual state override.
    } finally {
      setAuthActionLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthActionLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setAuthActionLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserInContext = (updatedUserProps: Partial<User>) => {
    setUser((prev) => (prev ? ({ ...prev, ...updatedUserProps } as User) : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest,
        loading,
        authActionLoading,
        userRole,
        setUserRole,
        signInGoogle,
        signInGuest,
        logout,
        showGuestPrompt,
        setShowGuestPrompt,
        guestPromptAction,
        triggerGuestPrompt,
        signUpWithEmail,
        signInWithEmail,
        resetPassword,
        updateUserInContext,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
