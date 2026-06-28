import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export type GamificationAction =
  | 'COMPLETE_STUDY_MODULE'
  | 'RESOLVE_PEER_DOUBT'
  | 'USE_AI_TUTOR'
  | 'FINISH_AI_QUIZ'
  | 'FOCUS_SESSION_COMPLETE';

export interface GamificationState {
  xp: number;
  badges: string[];
  aiUses: number;
  solvedDoubts: number;
  modulesCompleted: number;
  quizzesCompleted: number;
  focusSessionsCompleted: number;
}

const DEFAULT_STATE: GamificationState = {
  xp: 100, // starting XP
  badges: [],
  aiUses: 0,
  solvedDoubts: 0,
  modulesCompleted: 0,
  quizzesCompleted: 0,
  focusSessionsCompleted: 0,
};

const ACTION_POINTS: Record<GamificationAction, number> = {
  COMPLETE_STUDY_MODULE: 100,
  RESOLVE_PEER_DOUBT: 50,
  USE_AI_TUTOR: 15,
  FINISH_AI_QUIZ: 100,
  FOCUS_SESSION_COMPLETE: 60,
};

// Internal sandbox handling
function getSandboxState(): GamificationState {
  const json = localStorage.getItem('SANDBOX_GAMIFICATION_DATA');
  if (json) {
    try {
      return { ...DEFAULT_STATE, ...JSON.parse(json) };
    } catch {
      return DEFAULT_STATE;
    }
  }
  return DEFAULT_STATE;
}

function saveSandboxState(state: GamificationState) {
  localStorage.setItem('SANDBOX_GAMIFICATION_DATA', JSON.stringify(state));
}

/**
 * Core function to award experience points and check for earned badges.
 * Supports both Firebase Firestore and Local Sandbox environments.
 */
export async function awardGamificationPoints(
  userId: string,
  action: GamificationAction,
  isSandboxMode: boolean = false
): Promise<{ xpAwarded: number; newBadgesEarned: string[] }> {
  try {
    const pointsAmount = ACTION_POINTS[action];
    let newBadgesEarned: string[] = [];

    if (isSandboxMode || userId === 'sandbox_student_genius_99' || userId.includes('sandbox') || userId.includes('guest')) {
      const state = getSandboxState();
      state.xp += pointsAmount;

      // Update counter based on action
      if (action === 'USE_AI_TUTOR') state.aiUses += 1;
      if (action === 'RESOLVE_PEER_DOUBT') state.solvedDoubts += 1;
      if (action === 'COMPLETE_STUDY_MODULE') state.modulesCompleted += 1;
      if (action === 'FINISH_AI_QUIZ') state.quizzesCompleted += 1;
      if (action === 'FOCUS_SESSION_COMPLETE') state.focusSessionsCompleted += 1;

      // Check Badges
      const badges = [...state.badges];
      
      if (state.aiUses >= 5 && !badges.includes('AI Master')) {
        badges.push('AI Master');
        newBadgesEarned.push('AI Master');
      }
      if ((state.solvedDoubts >= 1 || state.modulesCompleted >= 2) && !badges.includes('Top Contributor')) {
        badges.push('Top Contributor');
        newBadgesEarned.push('Top Contributor');
      }
      if (state.quizzesCompleted >= 2 && !badges.includes('Quiz Champion')) {
        badges.push('Quiz Champion');
        newBadgesEarned.push('Quiz Champion');
      }
      if (state.focusSessionsCompleted >= 2 && !badges.includes('Focus Guru')) {
        badges.push('Focus Guru');
        newBadgesEarned.push('Focus Guru');
      }

      state.badges = badges;
      saveSandboxState(state);
      return { xpAwarded: pointsAmount, newBadgesEarned };
    } else {
      // Connect to Firestore
      const userDocRef = doc(db, 'users', userId);
      const cacheKey = `tg_gamification_cache_${userId}`;
      let currentXP = 100;
      let currentBadges: string[] = [];
      let currentAiUses = 0;
      let currentSolvedDoubts = 0;
      let currentModulesCompleted = 0;
      let currentQuizzesCompleted = 0;
      let currentFocusSessions = 0;

      // Try reading from cache first as baseline or if fetch fails
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          currentXP = cachedData.xp ?? 100;
          currentBadges = cachedData.badges || [];
          currentAiUses = cachedData.aiUses || 0;
          currentSolvedDoubts = cachedData.solvedDoubts || 0;
          currentModulesCompleted = cachedData.modulesCompleted || 0;
          currentQuizzesCompleted = cachedData.quizzesCompleted || 0;
          currentFocusSessions = cachedData.focusSessionsCompleted || 0;
        } catch (e) {}
      }

      try {
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          currentXP = data.xp ?? 100;
          currentBadges = data.badges || [];
          currentAiUses = data.aiUses || 0;
          currentSolvedDoubts = data.solvedDoubts || 0;
          currentModulesCompleted = data.modulesCompleted || 0;
          currentQuizzesCompleted = data.quizzesCompleted || 0;
          currentFocusSessions = data.focusSessionsCompleted || 0;
        }
      } catch (getErr) {
        console.warn("getDoc failed (running offline state), relying on gamification local cache:", getErr);
      }

      const nextXP = currentXP + pointsAmount;
      if (action === 'USE_AI_TUTOR') currentAiUses += 1;
      if (action === 'RESOLVE_PEER_DOUBT') currentSolvedDoubts += 1;
      if (action === 'COMPLETE_STUDY_MODULE') currentModulesCompleted += 1;
      if (action === 'FINISH_AI_QUIZ') currentQuizzesCompleted += 1;
      if (action === 'FOCUS_SESSION_COMPLETE') currentFocusSessions += 1;

      // Check badge milestones
      const nextBadges = [...currentBadges];
      
      if (currentAiUses >= 5 && !nextBadges.includes('AI Master')) {
        nextBadges.push('AI Master');
        newBadgesEarned.push('AI Master');
      }
      if ((currentSolvedDoubts >= 1 || currentModulesCompleted >= 2) && !nextBadges.includes('Top Contributor')) {
        nextBadges.push('Top Contributor');
        newBadgesEarned.push('Top Contributor');
      }
      if (currentQuizzesCompleted >= 2 && !nextBadges.includes('Quiz Champion')) {
        nextBadges.push('Quiz Champion');
        newBadgesEarned.push('Quiz Champion');
      }
      if (currentFocusSessions >= 2 && !nextBadges.includes('Focus Guru')) {
        nextBadges.push('Focus Guru');
        newBadgesEarned.push('Focus Guru');
      }

      const updatedPayload = {
        xp: nextXP,
        badges: nextBadges,
        aiUses: currentAiUses,
        solvedDoubts: currentSolvedDoubts,
        modulesCompleted: currentModulesCompleted,
        quizzesCompleted: currentQuizzesCompleted,
        focusSessionsCompleted: currentFocusSessions,
      };

      // Always write to local cache instantly for instantaneous smooth updates and fallback
      localStorage.setItem(cacheKey, JSON.stringify(updatedPayload));

      try {
        await updateDoc(userDocRef, updatedPayload);
      } catch (upErr) {
        console.warn("updateDoc failed (running in offline local buffer mode):", upErr);
      }

      return { xpAwarded: pointsAmount, newBadgesEarned };
    }
  } catch (error) {
    console.warn("Graceful fallback during gamification update:", error);
    return { xpAwarded: 0, newBadgesEarned: [] };
  }
}

/**
 * Retrieve user points and badges.
 * Gracefully handles sandbox and firebase profiles.
 */
export async function getGamificationProfile(userId: string, isSandboxMode: boolean = false) {
  if (isSandboxMode || userId === 'sandbox_student_genius_99' || userId.includes('sandbox') || userId.includes('guest')) {
    return getSandboxState();
  }
  const cacheKey = `tg_gamification_cache_${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const profile = {
        xp: data.xp ?? 100,
        badges: data.badges || [],
        aiUses: data.aiUses || 0,
        solvedDoubts: data.solvedDoubts || 0,
        modulesCompleted: data.modulesCompleted || 0,
        quizzesCompleted: data.quizzesCompleted || 0,
        focusSessionsCompleted: data.focusSessionsCompleted || 0,
      };
      localStorage.setItem(cacheKey, JSON.stringify(profile));
      return profile;
    }
  } catch (err) {
    console.warn("Failed to load gamification profile from DB, loading from local cache fallback:", err);
  }

  // Double check our cache fallback
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }
  return DEFAULT_STATE;
}
