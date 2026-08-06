/**
 * Smart User Profile & Defaults System
 *
 * Persists academic preferences across sessions using localStorage + Firestore.
 * Reduces form friction by auto-populating known values.
 */

const STORAGE_KEY = 'TEEN_GENIUS_USER_PROFILE';

export interface UserAcademicProfile {
  board: string;
  class: string;
  stream: string;
  studyHoursPerDay: string;
  preferredSubjects: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  weakSubjects: string[];
  strongSubjects: string[];
  examGoal: string;
}

const DEFAULT_PROFILE: UserAcademicProfile = {
  board: '',
  class: '',
  stream: '',
  studyHoursPerDay: '4',
  preferredSubjects: [],
  learningStyle: 'visual',
  weakSubjects: [],
  strongSubjects: [],
  examGoal: '85',
};

export function getStoredProfile(): UserAcademicProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('[Profile] Failed to parse stored profile:', e);
  }
  return { ...DEFAULT_PROFILE };
}

export function saveStoredProfile(partial: Partial<UserAcademicProfile>): UserAcademicProfile {
  const current = getStoredProfile();
  const updated = { ...current, ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[Profile] Failed to save profile:', e);
  }
  return updated;
}

export function clearStoredProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

/**
 * Merge partial profile into Firestore user document.
 */
export async function syncProfileToFirestore(
  userId: string,
  partial: Partial<UserAcademicProfile>
): Promise<void> {
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, partial as any, { merge: true });
  } catch (e) {
    console.warn('[Profile] Firestore sync deferred:', e);
  }
}

export async function loadProfileFromFirestore(userId: string): Promise<Partial<UserAcademicProfile>> {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const data = snap.data() as any;
      return {
        board: data.board || '',
        class: data.class || '',
        stream: data.stream || '',
        studyHoursPerDay: data.studyHoursPerDay || '4',
        preferredSubjects: data.preferredSubjects || [],
        learningStyle: data.learningStyle || 'visual',
        weakSubjects: data.weakSubjects || [],
        strongSubjects: data.strongSubjects || [],
        examGoal: data.examGoal || '85',
      };
    }
  } catch (e) {
    console.warn('[Profile] Firestore load deferred:', e);
  }
  return {};
}

/**
 * Hook for consuming user profile defaults in components.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserAcademicProfile>(getStoredProfile);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function hydrate() {
      setIsSyncing(true);
      const remote = await loadProfileFromFirestore(user.uid);
      if (cancelled) return;
      const merged = { ...getStoredProfile(), ...remote };
      setProfile(merged);
      saveStoredProfile(merged);
      setIsSyncing(false);
    }

    hydrate();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const updateProfile = useCallback((partial: Partial<UserAcademicProfile>) => {
    setProfile(prev => {
      const updated = { ...prev, ...partial };
      saveStoredProfile(updated);
      if (user?.uid) {
        syncProfileToFirestore(user.uid, partial);
      }
      return updated;
    });
  }, [user?.uid]);

  const resetProfile = useCallback(() => {
    setProfile({ ...DEFAULT_PROFILE });
    clearStoredProfile();
  }, []);

  return {
    profile,
    isSyncing,
    updateProfile,
    resetProfile,
    isProfileComplete: !!(profile.board && profile.class && profile.preferredSubjects.length > 0),
  };
}
