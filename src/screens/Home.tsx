import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  Users, 
  Sparkles, 
  FileText,
  Plus,
  Clock, 
  Flame, 
  Check, 
  Trash2, 
  Calendar, 
  MessageSquare,
  TrendingUp,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Brain,
  BookOpen,
  User,
  ChevronRight,
  Play,
  Clock as ClockIcon,
  TrendingUp as TrendingUpIcon,
  Award as AwardIcon,
  CalendarDays,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  limit, 
  orderBy, 
  serverTimestamp, 
  doc, 
  addDoc,
  getDoc 
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { toDate } from '../lib/dateUtils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import Logo from '../components/Logo';
import confetti from 'canvas-confetti';
import { trackEvent } from '../lib/analytics';
import AcademicActivityFeed from '../components/AcademicActivityFeed';
import OnboardingFlow from '../components/OnboardingFlow';
import { 
  NextStep,
  TaskSource,
  SessionRecord,
  CalendarNode
} from '../lib/nextStep';
import { formatDate, formatTime } from '../lib/dateUtils';
import { useNextAction, useStudentProfile, daysUntilExam } from '../lib/study';

// -------------------------------------------------------------
// TIMER SUBCOMPONENT (STUDY TIME MODULE)
// -------------------------------------------------------------
function StudyTimer({ onSessionSave }: { onSessionSave?: () => void }) {
  const { user, isGuest } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // Sync deferred local sessions when connectivity is recovered
  useEffect(() => {
    const syncSessions = async () => {
      if (!navigator.onLine || !user || isGuest) return;
      const queueRaw = localStorage.getItem('STUDENT_OFFLINE_QUEUED_SESSIONS');
      if (!queueRaw) return;
      try {
        const queue = JSON.parse(queueRaw);
        if (!queue || queue.length === 0) return;
        
        localStorage.setItem('STUDENT_OFFLINE_QUEUED_SESSIONS', '[]');
        
        for (const item of queue) {
          await addDoc(collection(db, 'studySessions'), {
            userId: item.userId,
            startTime: new Date(item.startTime),
            duration: item.duration,
            createdAt: serverTimestamp()
          });
        }
        if (onSessionSave) onSessionSave();
      } catch (err) {
        console.error("Timer offline sync failed:", err);
      }
    };

    window.addEventListener('online', syncSessions);
    if (navigator.onLine) syncSessions();
    return () => window.removeEventListener('online', syncSessions);
  }, [user, isGuest, onSessionSave]);

  const handleToggle = async () => {
    if (isActive && startTime) {
      const durationInMinutes = seconds / 60;
      if (durationInMinutes > 0.05) { // At least 3 seconds
        try {
          const isSandboxUser = isGuest || (user && user.uid.includes('sandbox'));
          if (isSandboxUser) {
            const saved = localStorage.getItem('SANDBOX_STUDY_SESSIONS') || '[]';
            const parsed = JSON.parse(saved);
            parsed.push({
              id: 'sb_sess_' + Date.now(),
              userId: user?.uid || 'guest',
              startTime: startTime.toISOString(),
              duration: durationInMinutes,
              createdAt: new Date().toISOString()
            });
            localStorage.setItem('SANDBOX_STUDY_SESSIONS', JSON.stringify(parsed));
          } else if (user) {
            if (!navigator.onLine) {
              const queueRaw = localStorage.getItem('STUDENT_OFFLINE_QUEUED_SESSIONS') || '[]';
              const queue = JSON.parse(queueRaw);
              queue.push({
                userId: user.uid,
                startTime: startTime.toISOString(),
                duration: durationInMinutes,
                createdAt: new Date().toISOString()
              });
              localStorage.setItem('STUDENT_OFFLINE_QUEUED_SESSIONS', JSON.stringify(queue));
            } else {
              await addDoc(collection(db, 'studySessions'), {
                userId: user.uid,
                startTime: startTime,
                duration: durationInMinutes,
                createdAt: serverTimestamp()
              });
            }
          }
          if (onSessionSave) onSessionSave();
        } catch (e) {
          console.error("Failed to save study session:", e);
        }
      }
      setIsActive(false);
      setSeconds(0);
      setStartTime(null);
    } else {
      setStartTime(new Date());
      setIsActive(true);
    }
  };

  const formatTime = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-zinc-900 border border-zinc-800 text-white rounded-[2rem] gap-4 w-full">
      <div className="space-y-1.5 text-center sm:text-left flex-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-widest leading-none">
          <Flame size={11} className="animate-pulse" />
          <span>Study Timer</span>
        </div>
        <p className="text-zinc-400 text-xs font-semibold">
          {isActive ? "Session in progress — keep going!" : "Start a session to track today's study time."}
        </p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        className={cn(
          "w-full sm:w-auto px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-md shrink-0 cursor-pointer",
          isActive 
            ? "bg-amber-500 text-black hover:bg-amber-400" 
            : "bg-white text-zinc-900 hover:bg-zinc-100"
        )}
      >
        <Clock size={16} className={cn("shrink-0", isActive && "animate-pulse text-black")} />
        <span className="font-mono font-bold tracking-tight">{isActive ? formatTime(seconds) : "Start Session"}</span>
      </button>
    </div>
    );
}

// ─── Next Step Recommendation ─────────────────────────────────────────────
// Derives a single clear recommendation for "What should I do right now?"
// from the user's existing task data and study-session history.
function NextStepRecommendation({
  tasks,
  todayMinutes,
  dailyTarget,
  hasStudyHistory,
  onAddTask,
}: {
  tasks: { id: string; text: string; completed: boolean }[];
  todayMinutes: number;
  dailyTarget: number;
  hasStudyHistory: boolean;
  onAddTask: (text: string) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const firstIncomplete = tasks.find(t => !t.completed);
  const targetMins = Math.round(dailyTarget * 60);
  const goalMet = todayMinutes >= targetMins && todayMinutes > 0;

  // Personal study engine recommendation (learn → practice loop). Takes priority
  // when the student has real study data; the legacy task/goal cards remain as fallback.
  const studyAction = useNextAction();
  const StudyActionIcon = ({ Play, ClipboardCheck, BookOpen, Target, Sparkles, ChevronRight } as Record<string, any>)[studyAction?.icon ?? ''] ?? Sparkles;
  const { profile } = useStudentProfile();

  // Calm exam countdown (≤14 days) — links into the exam prep workflow.
  const upcomingExam = (profile?.exams ?? [])
    .map((e) => ({ e, d: daysUntilExam(e.date) }))
    .filter((x) => x.d >= 0)
    .sort((a, b) => a.d - b.d)[0] ?? null;

  return (
    <section className="space-y-5 max-w-7xl mx-auto pt-2">
      {/* Greeting — concise */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.displayName ? user.displayName.split(' ')[0] : 'Scholar'}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-450 font-medium">
          What should you focus on right now?
        </p>
      </div>

      {/* Upcoming exam countdown (calm, only ≤14 days out) */}
      {upcomingExam && upcomingExam.d <= 14 && (
        <Link to={`/app/exam/${upcomingExam.e.id}`} className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-2xl hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', upcomingExam.d <= 3 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500')}>
            <CalendarDays size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{upcomingExam.e.name}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              {upcomingExam.d === 0 ? 'Today' : upcomingExam.d === 1 ? 'Tomorrow' : `In ${upcomingExam.d} days`} · tap to prepare
            </p>
          </div>
          <ChevronRight size={15} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
        </Link>
      )}

      {/* Next Step card — study engine first, legacy flow fallback */}
      {studyAction && studyAction.type !== 'start' ? (
        <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white border border-blue-500/20 rounded-[2rem] shadow-lg shadow-blue-600/15 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2.5 min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-100 bg-white/15 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
              <Sparkles size={11} />
              Recommended for you
            </span>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-snug truncate">
              {studyAction.title}
            </h2>
            <p className="text-xs text-blue-100 font-medium">{studyAction.subtitle}</p>
          </div>
          <button
            onClick={() => navigate(studyAction.type === 'exam-prep' ? '/app/planner' : studyAction.to)}
            className="px-5 py-3 bg-white text-blue-700 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            <StudyActionIcon size={12} />
            {studyAction.action}
          </button>
        </div>
      ) : firstIncomplete ? (
        <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-[2rem] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2.5 min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-full inline-block">
              Next on Deck
            </span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-snug truncate">
              {firstIncomplete.text}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-450 font-medium">
              Your top priority for today.
            </p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => navigate('/app/focus')}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-md cursor-pointer"
              aria-label="Start focus session"
            >
              <Play size={12} fill="currentColor" />
              Start
            </button>
            <button
              onClick={() => navigate('/app/planner')}
              className="px-4 py-3 bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-zinc-100 transition-all active:scale-95 cursor-pointer"
              aria-label="View all tasks"
            >
              All Tasks
            </button>
          </div>
        </div>
      ) : goalMet ? (
        <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-[2rem] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2.5 min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full inline-block">
              Daily Goal Reached
            </span>
            <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              Great job today!
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-450 font-medium">
              You've hit your {targetMins}m study target. Ready for more?
            </p>
          </div>
          <button
            onClick={() => navigate('/app/learn')}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            <Brain size={12} />
            Review Concepts
          </button>
        </div>
      ) : (
        <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-[2rem] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2.5 min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-full inline-block">
              Focus Time
            </span>
            <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              {hasStudyHistory ? 'Ready for another session?' : 'Create your first study goal'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-450 font-medium">
              {hasStudyHistory
                ? `You've logged ${todayMinutes}m today. Aim for ${targetMins}m to hit your target.`
                : 'Add a task below or start a focused study session to begin.'}
            </p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => navigate('/app/focus')}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Play size={12} fill="currentColor" />
              Start Session
            </button>
            <button
              onClick={() => onAddTask('Study for upcoming exam')}
              className="px-4 py-3 bg-zinc-50 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-zinc-100 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={12} />
              Add Task
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// MAIN HOME MODULE
// -------------------------------------------------------------
export default function Home() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [sessionTrigger, setSessionTrigger] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(() => {
    const saved = localStorage.getItem('TEENGENIUS_DAILY_TARGET');
    return saved ? parseFloat(saved) : 2.0;
  });

  interface DailyTask {
    id: string;
    text: string;
    completed: boolean;
  }

  // Today's schedule data - starts completely empty unless user has typed tasks
  const [tasks, setTasks] = useState<DailyTask[]>(() => {
    const saved = localStorage.getItem('TEENGENIUS_DAILY_TASKS');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return [];
  });

  const [taskInput, setTaskInput] = useState('');
  const [isGoalMet, setIsGoalMet] = useState(false);

  // Initialize stats to 0, matching a clean empty-state initially
  const [stats, setStats] = useState([
    { label: 'Weekly Study', value: '0.0h', icon: Target },
    { label: 'Study Streak', value: '0 days', icon: Flame },
    { label: 'Today\'s Target', value: `0m / ${Math.round(dailyTarget * 60)}m`, icon: Sparkles },
  ]);

  const [chartData, setChartData] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  // State counts for actual notes and circles
  const [notesCount, setNotesCount] = useState<number>(0);
  const [circlesCount, setCirclesCount] = useState<number>(0);

  useEffect(() => {
    trackEvent('use_feature', { featureName: 'Dashboard' });
  }, []);

  useEffect(() => {
    localStorage.setItem('TEENGENIUS_DAILY_TASKS', JSON.stringify(tasks));
  }, [tasks]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1']
    });
  };

  useEffect(() => {
    const currentHours = todayMinutes / 60;
    if (currentHours >= dailyTarget && currentHours > 0) {
      if (!isGoalMet) {
        setIsGoalMet(true);
        triggerConfetti();
      }
    } else {
      setIsGoalMet(false);
    }
  }, [todayMinutes, dailyTarget, isGoalMet]);

  const addTask = (text: string) => {
    if (!text.trim()) return;
    const newTask: DailyTask = {
      id: 'task_' + Date.now(),
      text: text.trim(),
      completed: false
    };
    setTasks(prev => [...prev, newTask]);
    setTaskInput('');
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        if (nextCompleted) triggerConfetti();
        return { ...t, completed: nextCompleted };
      }
      return t;
    }));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Dynamically calculate study streak from list of completed sessions
  const calculateRealStreak = (sessions: any[]) => {
    if (sessions.length === 0) return 0;

    // Extract unique ISO date strings (local day resolution)
    const uniqueDates = Array.from(new Set(sessions.map(s => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }))).sort((a, b) => b.localeCompare(a)); // Sort in descending order (newest first)

    if (uniqueDates.length === 0) return 0;

    const todayStr = new Date().toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const mostRecentStudyDate = uniqueDates[0];
    if (mostRecentStudyDate !== todayStr && mostRecentStudyDate !== yesterdayStr) {
      return 0; // Streak was broken
    }

    let streak = 0;
    let currentCheckDay = new Date(mostRecentStudyDate);

    for (let i = 0; i < uniqueDates.length; i++) {
      const expectedDayStr = currentCheckDay.toISOString().split('T')[0];
      if (uniqueDates.includes(expectedDayStr)) {
        streak++;
        currentCheckDay.setDate(currentCheckDay.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  // Sync databases or fetch stats
  useEffect(() => {
    if (!user) return;
    const isSandbox = isGuest || user.uid.includes('sandbox');

    if (isSandbox) {
      // 1. Fetch Real Sessions
      const savedSessions = localStorage.getItem('SANDBOX_STUDY_SESSIONS') || '[]';
      let parsedSessions: any[] = [];
      try {
        parsedSessions = JSON.parse(savedSessions);
      } catch (_) {}

      const totalMins = parsedSessions.reduce((acc: number, item: any) => acc + (item.duration || 0), 0);
      const today = new Date();
      const todayString = today.toDateString();
      const parsedToday = parsedSessions.filter((item: any) => new Date(item.startTime).toDateString() === todayString);
      const todaySum = parsedToday.reduce((acc: number, item: any) => acc + (item.duration || 0), 0);

      setTodayMinutes(todaySum);

      // Create Last 7 weekdays list
      const days: Record<string, number> = {};
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString(undefined, { weekday: 'short' });
      }).reverse();
      last7Days.forEach(day => days[day] = 0);

      parsedSessions.forEach((item: any) => {
        const d = new Date(item.startTime);
        const k = d.toLocaleDateString(undefined, { weekday: 'short' });
        if (days[k] !== undefined) days[k] += Math.round(item.duration);
      });

      setChartData(Object.entries(days).map(([name, value]) => ({ name, value })));
      setRecentSessions(parsedSessions.map((x: any) => ({ ...x, startTime: new Date(x.startTime) })).slice(0, 5));

      const calculatedStreak = calculateRealStreak(parsedSessions);
      setStats([
        { label: 'Weekly Study', value: (totalMins / 60).toFixed(1) + 'h', icon: Target },
        { label: 'Study Streak', value: `${calculatedStreak} days`, icon: Flame },
        { label: 'Today\'s Target', value: `${Math.round(todaySum)}m / ${Math.round(dailyTarget * 60)}m`, icon: Sparkles }
      ]);

      // 2. Fetch Real Sandbox Counts
      try {
        const savedNotes = localStorage.getItem('STUDENT_SAVED_NOTES_TAGGED') || '[]';
        setNotesCount(JSON.parse(savedNotes).length);
      } catch (_) {}

      setCirclesCount(0);
      return;
    }

    // --- FIRESTORE ACTIVE SUBSCRIPTIONS ---
    
    // A. Sub to Study sessions
    const sessionQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', user.uid)
    );

    const unsubscribeSessions = onSnapshot(sessionQuery, (snap) => {
      let totalMinutes = 0;
      let todaySum = 0;
      const todayStr = new Date().toDateString();
      const days: Record<string, number> = {};

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toLocaleDateString(undefined, { weekday: 'short' });
      }).reverse();
      last7Days.forEach(day => days[day] = 0);

      const items: any[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        const start = toDate(data.startTime);
        const mins = data.duration || 0;
        totalMinutes += mins;

        if (start) {
          items.push({ id: doc.id, duration: mins, startTime: start });
          const key = start.toLocaleDateString(undefined, { weekday: 'short' });
          if (days[key] !== undefined) days[key] += Math.round(mins);
          if (start.toDateString() === todayStr) todaySum += mins;
        }
      });

      // Sort in-memory by startTime descending
      items.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      setTodayMinutes(todaySum);
      setChartData(Object.entries(days).map(([name, value]) => ({ name, value })));
      setRecentSessions(items.slice(0, 5));

      const calculatedStreak = calculateRealStreak(items);
      setStats([
        { label: 'Weekly Study', value: (totalMinutes / 60).toFixed(1) + 'h', icon: Target },
        { label: 'Study Streak', value: `${calculatedStreak} days`, icon: Flame },
        { label: 'Today\'s Target', value: `${Math.round(todaySum)}m / ${Math.round(dailyTarget * 60)}m`, icon: Sparkles }
      ]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'studySessions'));

    // B. Sub to Notes lab metrics
    const notesQuery = query(collection(db, 'notesLab'), where('userId', '==', user.uid));
    const unsubscribeNotes = onSnapshot(notesQuery, (snap) => {
      setNotesCount(snap.size);
    }, () => setNotesCount(0));

    // C. Sub to Circles (where user is part of group)
    const circlesQuery = query(collection(db, 'studyGroups'));
    const unsubscribeCircles = onSnapshot(circlesQuery, (snap) => {
      const count = snap.docs.filter(d => {
        const memberIds = d.data().memberIds || [];
        return memberIds.includes(user.uid);
      }).length;
      setCirclesCount(count);
    }, () => setCirclesCount(0));

    return () => {
      unsubscribeSessions();
      unsubscribeNotes();
      unsubscribeCircles();
    };
  }, [user, isGuest, sessionTrigger]);

  const CONTINUE_LEARNING_TOOLS = [
    { name: "AI Tutor", desc: "No-judgment assistant for asking difficult questions and clarifying concepts", path: "/app/ai-assistant", icon: Sparkles, color: "text-purple-600 bg-purple-100 dark:bg-purple-950/40" },
    { name: "Notes Lab", desc: "Upload study materials to instantly generate quick revision notes", path: "/app/notes", icon: FileText, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40" },
    { name: "Focus Zone", desc: "Study audio and a Pomodoro timer to keep your focus sessions distraction-free", path: "/app/focus", icon: Target, color: "text-rose-600 bg-rose-100 dark:bg-rose-950/40" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-3.5 sm:p-6 md:p-8 space-y-8 overflow-x-hidden">
      
      {/* First-run onboarding for new students (self-dismissing once complete) */}
      <OnboardingFlow />

      {/* SECTION 1: GREETING + NEXT STEP RECOMMENDATION (PRIMARY) */}
      <NextStepRecommendation
        tasks={tasks}
        todayMinutes={todayMinutes}
        dailyTarget={dailyTarget}
        hasStudyHistory={recentSessions.length > 0}
        onAddTask={addTask}
      />

      {/* DASHBOARD STATS OVERVIEWS ROW - TERTIARY DETAILS */}
      <div className="grid grid-cols-3 gap-4 max-w-7xl mx-auto select-none pt-2">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-2xl md:rounded-[1.5rem] flex flex-col sm:flex-row items-center sm:justify-between gap-2.5 text-center sm:text-left transition-all hover:scale-[1.01]">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[8px] sm:text-[9.5px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block leading-none">{stat.label}</span>
                <span className="text-sm sm:text-base font-black text-zinc-850 dark:text-white block tracking-tight leading-normal truncate">{stat.value}</span>
              </div>
              <div className={cn(
                "w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0",
                stat.label === 'Weekly Study' ? 'bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400' :
                stat.label === 'Study Streak' ? 'bg-amber-50 dark:bg-zinc-800 text-amber-600 dark:text-amber-400' :
                'bg-purple-50 dark:bg-zinc-800 text-purple-600 dark:text-purple-400'
              )}>
                <Icon size={14} strokeWidth={2.4} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-w-7xl mx-auto">
        <StudyTimer onSessionSave={() => setSessionTrigger(prev => prev + 1)} />
      </div>

      {/* QUESTION 1: WHAT SHOULD I DO TODAY? (PRIMARY) */}
      <section className="space-y-6 max-w-7xl mx-auto pt-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase tracking-widest rounded-full">
            <CheckCircle2 size={11} />
            <span>Today's Plan</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">What should I do today?</h2>
          <p className="text-xs text-zinc-500 font-medium">
            Your tasks for today — check them off as you go.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Custom Task Checklist Card (Primary Emphasis - occupies 2 columns in large screen) */}
          <div className="lg:col-span-2 p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-[2.5rem] space-y-6 shadow-xs flex flex-col justify-between min-h-[320px]">
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">Daily Checklist</span>
                  <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">Today's Tasks</h3>
                </div>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    addTask(taskInput);
                  }}
                  className="flex gap-2.5"
                >
                  <input
                    type="text"
                    placeholder="e.g. Solve Calc Worksheet..."
                    value={taskInput}
                    onChange={e => setTaskInput(e.target.value)}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-800 dark:text-white placeholder-zinc-400 px-4 py-3 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full max-w-[240px] font-semibold transition-all"
                  />
                  <button 
                    type="submit"
                    className="px-5 py-3 bg-zinc-905 dark:bg-white dark:text-zinc-900 text-white hover:bg-zinc-805 hover:scale-[1.02] active:scale-95 rounded-2xl cursor-pointer text-xs font-black uppercase tracking-widest shrink-0 transition-all shadow-sm"
                  >
                    Add Task
                  </button>
                </form>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-3">
                    <p className="text-xs font-bold text-zinc-455 dark:text-zinc-500 italic max-w-md mx-auto">
                      No tasks for today yet — add your first one above.
                    </p>
                    <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold leading-relaxed max-w-sm mx-auto">
                      Tasks are saved on this device, so they'll be here when you come back.
                    </p>
                  </div>
                ) : (
                  tasks.map(item => (
                    <div 
                      key={item.id}
                      className={cn(
                        "p-4 rounded-2xl border flex items-center justify-between transition-all gap-4 text-xs font-bold",
                        item.completed
                          ? "bg-zinc-50/50 dark:bg-zinc-955/20 border-zinc-150 text-zinc-400 line-through dark:border-zinc-850/60"
                          : "bg-zinc-50 dark:bg-zinc-955 border-zinc-150/40 dark:border-zinc-850 text-zinc-700 dark:text-zinc-200"
                      )}
                    >
                      <label className="flex items-center gap-3.5 cursor-pointer flex-1 select-none">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleTask(item.id)}
                          className="w-4.5 h-4.5 rounded-lg text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                        <span className="leading-relaxed">{item.text}</span>
                      </label>
                      
                      <button 
                        onClick={() => deleteTask(item.id)}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                        title="Remove task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Today's Goals Metrics & Study Status Card (Primary Emphasis - 1 column) */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-600 to-indigo-750 text-white rounded-[2.5rem] space-y-6 shadow-sm flex flex-col justify-between min-h-[320px]">
            <div className="space-y-4">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/60 block leading-none">Today's Progress</span>
              <h3 className="text-xl font-black uppercase tracking-tight">Daily Study Goal</h3>
              <p className="text-xs text-white/80 leading-relaxed font-medium">
                {todayMinutes >= (dailyTarget * 60)
                  ? "Target hit — great work! Come back tomorrow to keep your streak going."
                  : `You've studied ${Math.round(todayMinutes)} minutes today — ${Math.max(0, Math.round(dailyTarget * 60) - Math.round(todayMinutes))}m more to hit your ${Math.round(dailyTarget * 60)}m goal.`
                }
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end text-xs font-mono font-bold select-none text-white/90">
                <span>Today</span>
                <span>{Math.round(todayMinutes)}m / {Math.round(dailyTarget * 60)}m</span>
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden select-none">
                <div 
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min(100, (todayMinutes / (dailyTarget * 60)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-amber-400 animate-pulse" />
                <span className="font-bold">Streak · {stats[1]?.value || '0 days'}</span>
              </div>
              <Link 
                to="/app/focus" 
                className="text-[10px] font-black uppercase tracking-widest bg-white text-zinc-900 px-4 py-2.5 rounded-xl block text-center hover:bg-zinc-100 transition-all shadow-sm font-bold"
              >
                Focus Zone
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* QUESTION 2: WHAT IS COMING UP NEXT? (SECONDARY) */}
      <section className="space-y-6 max-w-7xl mx-auto pt-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            <span>Coming Up</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">What is coming up next?</h2>
          <p className="text-xs text-zinc-500 font-medium">
            Announcements and activity from your classes and study circles.
          </p>
        </div>
        
        <AcademicActivityFeed />
      </section>

      {/* QUESTION 3: WHERE CAN I CONTINUE STUDYING? (PRIMARY) */}
      <section className="space-y-6 max-w-7xl mx-auto pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full">
              <Sparkles size={11} strokeWidth={2.5} />
              <span>Study Tools</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Where can I continue studying?</h2>
            <p className="text-xs text-zinc-500 font-medium">
              Ask the AI tutor, generate revision notes, or run a focus session.
            </p>
          </div>
          <Link 
            to="/app/learn" 
            className="self-start sm:self-center px-5 py-3 bg-zinc-905 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-sm font-bold active:scale-95 text-center"
          >
            Open Learn Hub
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CONTINUE_LEARNING_TOOLS.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <motion.div 
                key={i}
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(tool.path)}
                className="p-6 sm:p-7 bg-white dark:bg-zinc-900 border border-zinc-155 dark:border-zinc-850 rounded-[2rem] hover:border-blue-500 dark:hover:border-indigo-650/40 cursor-pointer shadow-xs hover:shadow-md transition-all group flex flex-col justify-between min-h-[220px]"
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tool.color} group-hover:scale-110 transition-transform shadow-xs`}>
                  <Icon size={18} strokeWidth={2.4} />
                </div>
                
                <div className="space-y-2 pt-4">
                  <h4 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {tool.name}
                  </h4>
                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-450 font-medium min-h-[32px] line-clamp-3">
                    {tool.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 6: QUICK ACTIONS FLOATING MENU */}
      <div className="fixed bottom-24 right-5 sm:right-8 z-[150] flex flex-col items-end gap-3 select-none">
        <AnimatePresence>
          {isQuickOpen && (
            <>
              {/* Click outside backdrop */}
              <div 
                onClick={() => setIsQuickOpen(false)} 
                className="fixed inset-0 bg-transparent cursor-default z-[-1]"
              />
              
              <div className="flex flex-col items-end gap-3 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickOpen(false);
                    navigate('/app/ai-assistant');
                  }}
                  className="flex items-center gap-2.5 bg-zinc-900 dark:bg-zinc-950 border border-zinc-850 text-white pl-4 pr-3.5 py-2.5 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-zinc-805"
                >
                  <span className="text-[9.5px] tracking-wider">Ask AI Tutor</span>
                  <div className="w-7 h-7 bg-purple-600 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Sparkles size={13} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickOpen(false);
                    navigate('/app/chats');
                  }}
                  className="flex items-center gap-2.5 bg-zinc-900 dark:bg-zinc-950 border border-zinc-850 text-white pl-4 pr-3.5 py-2.5 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-zinc-805"
                >
                  <span className="text-[9.5px] tracking-wider">Secure Chat</span>
                  <div className="w-7 h-7 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0">
                    <MessageSquare size={13} />
                  </div>
                </button>
              </div>
            </>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setIsQuickOpen(!isQuickOpen)}
          className={cn(
            "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white transition-all duration-350 shadow-xl focus:outline-none cursor-pointer border border-white/10 active:scale-95 z-55",
            isQuickOpen 
              ? "bg-zinc-805 rotate-45 scale-105 hover:bg-zinc-700" 
              : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 shadow-lg"
          )}
          title="Quick Actions"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </div>

    </div>
  );
}
