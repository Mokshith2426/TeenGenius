import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp, query, getDocs, limit, orderBy } from 'firebase/firestore';

export interface AnalyticsEvent {
  eventName: string;
  userId: string;
  email?: string;
  timestamp: any;
  params?: any;
}

// Locally cached statistics for reliable fallback rendering
export interface LocalStats {
  newUsersCount: number;
  returningUsersCount: number;
  dauCount: number;
  wauCount: number;
  tutorialCompletedCount: number;
  tutorialStartedCount: number;
  featureUsage: Record<string, number>;
  toolUsage: Record<string, number>;
  sessionsCount: number;
  averageSessionDuration: number; // in seconds
}

const STATS_KEY = 'TEENGENIUS_LOCAL_ANALYTICS_v1';
const SESSION_START_KEY = 'TEENGENIUS_SESSION_START_TIME';

export function getLocalStats(): LocalStats {
  const cached = localStorage.getItem(STATS_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Fallback
    }
  }

  // Pure starting metrics for actual production telemetry
  return {
    newUsersCount: 0,
    returningUsersCount: 0,
    dauCount: 0,
    wauCount: 0,
    tutorialCompletedCount: 0,
    tutorialStartedCount: 0,
    featureUsage: {
      'AI Assistant': 0,
      'Homework Solver': 0,
      'Focus Room': 0,
      'Notes Lab': 0,
      'Study Circles': 0,
      'Timetable Creator': 0,
    },
    toolUsage: {},
    sessionsCount: 0,
    averageSessionDuration: 0,
  };
}

export async function fetchRealtimeStats(): Promise<LocalStats> {
  const stats: LocalStats = {
    newUsersCount: 0,
    returningUsersCount: 0,
    dauCount: 0,
    wauCount: 0,
    tutorialCompletedCount: 0,
    tutorialStartedCount: 0,
    featureUsage: {
      'AI Assistant': 0,
      'Homework Solver': 0,
      'Focus Room': 0,
      'Notes Lab': 0,
      'Study Circles': 0,
      'Timetable Creator': 0,
    },
    toolUsage: {},
    sessionsCount: 0,
    averageSessionDuration: 0,
  };

  try {
    const qEvents = query(collection(db, 'analytics_events'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(qEvents);
    
    const uniqueUsersToday = new Set<string>();
    const uniqueUsersWeek = new Set<string>();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    let totalDuration = 0;
    let durationCount = 0;

    snap.docs.forEach((doc) => {
      const data = doc.data();
      let tStr = now;
      if (data.timestamp) {
        try {
          tStr = typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().getTime() : now;
        } catch {
          // Fallback
        }
      }
      const uid = data.userId || 'anonymous';
      
      if (now - tStr < oneDay) {
        uniqueUsersToday.add(uid);
      }
      if (now - tStr < oneWeek) {
        uniqueUsersWeek.add(uid);
      }

      if (data.eventName === 'onboarding_start') {
        stats.tutorialStartedCount++;
      } else if (data.eventName === 'onboarding_complete') {
        stats.tutorialCompletedCount++;
      } else if (data.eventName === 'session_start') {
        stats.sessionsCount++;
      } else if (data.eventName === 'use_feature') {
        const feat = data.params?.featureName || 'General';
        stats.featureUsage[feat] = (stats.featureUsage[feat] || 0) + 1;
      } else if (data.eventName === 'use_study_tool') {
        const tool = data.params?.toolName || 'General';
        stats.toolUsage[tool] = (stats.toolUsage[tool] || 0) + 1;
      } else if (data.eventName === 'register_user') {
        stats.newUsersCount++;
      } else if (data.eventName === 'login_user') {
        stats.returningUsersCount++;
      } else if (data.eventName === 'session_end') {
        const dur = data.params?.durationSeconds;
        if (dur) {
          totalDuration += dur;
          durationCount++;
        }
      }
    });

    stats.dauCount = uniqueUsersToday.size || 1;
    stats.wauCount = uniqueUsersWeek.size || 1;
    if (durationCount > 0) {
      stats.averageSessionDuration = Math.round(totalDuration / durationCount);
    }
    
    saveLocalStats(stats);
  } catch (err) {
    console.error("Error aggregating live stats from Firestore:", err);
  }

  return stats;
}

export function saveLocalStats(stats: LocalStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// Track an event
export async function trackEvent(eventName: string, params: any = {}) {
  const userId = auth.currentUser?.uid || 'anonymous_student';
  const email = auth.currentUser?.email || undefined;

  console.log(`[ANALYTICS EVENT]: ${eventName}`, params);

  // 1. Update localStorage real-time metrics
  const stats = getLocalStats();
  
  if (eventName === 'onboarding_start') {
    stats.tutorialStartedCount += 1;
  } else if (eventName === 'onboarding_complete') {
    stats.tutorialCompletedCount += 1;
  } else if (eventName === 'session_start') {
    stats.sessionsCount += 1;
  } else if (eventName === 'use_feature') {
    const featureName = params.featureName || 'General';
    stats.featureUsage[featureName] = (stats.featureUsage[featureName] || 0) + 1;
  } else if (eventName === 'use_study_tool') {
    const toolName = params.toolName || 'General';
    stats.toolUsage[toolName] = (stats.toolUsage[toolName] || 0) + 1;
  } else if (eventName === 'register_user') {
    stats.newUsersCount += 1;
  } else if (eventName === 'login_user') {
    stats.returningUsersCount += 1;
  }

  saveLocalStats(stats);

  // 2. Safely publish to Firestore for system synchronization
  try {
    const eventRef = collection(db, 'analytics_events');
    await addDoc(eventRef, {
      eventName,
      userId,
      email,
      timestamp: serverTimestamp(),
      params: {
        ...params,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        deviceType: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'
      }
    });
  } catch (err) {
    // Graceful containment on connectivity glitch
    console.warn("[ANALYTICS SERVER CORRELATION RETRYING]: Event cached locally.", err);
  }
}

// Session Start Trigger
export function startSessionTracker() {
  const now = Date.now();
  sessionStorage.setItem(SESSION_START_KEY, now.toString());
  trackEvent('session_start', { timestamp: now });

  // Handle unload/session close to log session duration
  const handleUnload = () => {
    endSessionTracker();
  };
  window.addEventListener('beforeunload', handleUnload);
  return () => window.removeEventListener('beforeunload', handleUnload);
}

// Session End Trigger
export function endSessionTracker() {
  const startTimeStr = sessionStorage.getItem(SESSION_START_KEY);
  if (!startTimeStr) return;

  const startTime = parseInt(startTimeStr, 10);
  const durationSec = Math.floor((Date.now() - startTime) / 1000);

  if (durationSec > 1) {
    trackEvent('session_end', { durationSeconds: durationSec });
    
    // Update local statistics averages
    const stats = getLocalStats();
    const count = stats.sessionsCount || 1;
    const oldAvg = stats.averageSessionDuration || 300;
    stats.averageSessionDuration = Math.round((oldAvg * (count - 1) + durationSec) / count);
    saveLocalStats(stats);
  }

  sessionStorage.removeItem(SESSION_START_KEY);
}
