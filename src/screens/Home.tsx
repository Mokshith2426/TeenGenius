import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  Users, 
  Sparkles, 
  FileText, 
  ArrowRight, 
  Plus, 
  Clock, 
  GraduationCap, 
  Flame, 
  Check, 
  Trash2, 
  Calendar, 
  MessageSquare,
  TrendingUp,
  Award,
  CheckCircle2
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
          <span>Live Session Clock</span>
        </div>
        <p className="text-zinc-400 text-xs font-semibold">
          {isActive ? "Study session currently running is counting..." : "Earn growth credits by starting the timer while studying."}
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
  const [onboardStep, setOnboardStep] = useState<number | null>(null);

  // Initialize stats to 0, matching a clean empty-state initially
  const [stats, setStats] = useState([
    { label: 'Weekly Study', value: '0.0h', icon: Target },
    { label: 'Study Streak', value: '0 days', icon: Flame },
    { label: 'Today\'s Target', value: `0m / ${Math.round(dailyTarget * 60)}m`, icon: Sparkles },
  ]);

  const [chartData, setChartData] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  // State counts for actual homework, notes, and circles
  const [notesCount, setNotesCount] = useState<number>(0);
  const [homeworkCount, setHomeworkCount] = useState<number>(0);
  const [circlesCount, setCirclesCount] = useState<number>(0);

  useEffect(() => {
    trackEvent('use_feature', { featureName: 'Dashboard' });
    const onboarded = localStorage.getItem('TEENGENIUS_ONBOARDED_1');
    if (!onboarded) setOnboardStep(1);
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

      try {
        const savedHomework = localStorage.getItem(`STUDENT_LOCAL_HOMEWORK_CACHE_${user.uid}`) || '[]';
        setHomeworkCount(JSON.parse(savedHomework).length);
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

    // C. Sub to Homework solved metrics
    const homeworkQuery = query(collection(db, 'homeworkSolutions'), where('userId', '==', user.uid));
    const unsubscribeHomework = onSnapshot(homeworkQuery, (snap) => {
      setHomeworkCount(snap.size);
    }, () => setHomeworkCount(0));

    // D. Sub to Circles (where user is part of group)
    const circlesQuery = query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', user.uid));
    const unsubscribeCircles = onSnapshot(circlesQuery, (snap) => {
      setCirclesCount(snap.size);
    }, () => setCirclesCount(0));

    return () => {
      unsubscribeSessions();
      unsubscribeNotes();
      unsubscribeHomework();
      unsubscribeCircles();
    };
  }, [user, isGuest, sessionTrigger]);

  const CONTINUE_LEARNING_TOOLS = [
    { name: "AI Tutor", desc: "No-judgment assistant for asking difficult questions and clarifying concepts", path: "/app/ai-assistant", icon: Sparkles, color: "text-purple-600 bg-purple-100 dark:bg-purple-950/40" },
    { name: "Homework Solver", desc: "Instant step-by-step guidance to solve tough academic questions", path: "/app/homework-solver", icon: GraduationCap, color: "text-blue-600 bg-blue-100 dark:bg-blue-950/40" },
    { name: "Notes Lab", desc: "Upload study materials to instantly generate quick revision notes", path: "/app/notes", icon: FileText, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/40" },
    { name: "Timetable Maker", desc: "Personal weekly class agenda planner", path: "/app/timetable", icon: Calendar, color: "text-amber-600 bg-amber-100 dark:bg-amber-950/40" },
    { name: "Focus Zone", desc: "Procedural soundscapes and focus clocks to keep your study sessions distraction-free", path: "/app/focus", icon: Target, color: "text-rose-600 bg-rose-100 dark:bg-rose-955/40" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto p-3.5 sm:p-6 md:p-8 space-y-8 overflow-x-hidden">
      
      {/* Onboarding Tour overlay */}
      <AnimatePresence>
        {onboardStep !== null && (
          <div className="fixed inset-0 bg-zinc-950/75 z-[300] flex items-center justify-center p-4 backdrop-blur-sm select-none">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-3xl p-6 sm:p-10 max-w-lg w-full space-y-5 text-zinc-900 dark:text-white shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-3.5 py-1 rounded-full">
                  Step {onboardStep} of 3 • Quick Tour
                </span>
                <button 
                  onClick={() => {
                    localStorage.setItem('TEENGENIUS_ONBOARDED_1', 'true');
                    setOnboardStep(null);
                  }}
                  className="text-xs font-black uppercase text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 tracking-wider transition-colors cursor-pointer"
                >
                  Skip Tour
                </button>
              </div>

              {onboardStep === 1 && (
                <div className="space-y-3">
                  <span className="text-4xl">🚀</span>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Active Headquarters</h2>
                  <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-300 font-medium leading-relaxed">
                    Say hello to TeenGenius Version 1.0! A fast, modern study workspace styled beautifully to help you conquer assignments, draft neat notes, organize classes, and revise with AI tutors.
                  </p>
                </div>
              )}

              {onboardStep === 2 && (
                <div className="space-y-3">
                  <span className="text-4xl">📚</span>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Five Study Tools</h2>
                  <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-300 font-medium leading-relaxed">
                    Access our AI Tutor, Homework Solver, Notes Lab, Timetable Maker, and Focus Zone from the brand-new <b>Educational Tools</b> segment. Everything you need grouped in one clean panel.
                  </p>
                </div>
              )}

              {onboardStep === 3 && (
                <div className="space-y-3">
                  <span className="text-4xl">⏱️</span>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Frictionless Tracking</h2>
                  <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-300 font-medium leading-relaxed">
                    Earn Study Streak days and Growth Credits dynamically by clicking the action button inside the Study Timer. Keep your focus high!
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onboardStep < 3) {
                      setOnboardStep(prev => prev! + 1);
                    } else {
                      localStorage.setItem('TEENGENIUS_ONBOARDED_1', 'true');
                      setOnboardStep(null);
                      triggerConfetti();
                    }
                  }}
                  className="w-full py-3.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-805 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                >
                  {onboardStep === 3 ? "Complete Tour 🎉" : "Continue"}
                  <ArrowRight size={13} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SECTION 1: WELCOME MESSAGE */}
      <header className="space-y-4 max-w-7xl mx-auto pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-50/70 dark:bg-zinc-900 border border-blue-105/30 dark:border-zinc-800 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full select-none">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>Personal Workspace Active</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
              Welcome, {user?.displayName ? user.displayName.split(' ')[0] : 'Scholar'} ⚡
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-semibold italic">
              "Let's conquer today's study goals together."
            </p>
          </div>
          <div className="flex items-center gap-2 select-none self-start sm:self-center bg-white dark:bg-zinc-900 px-4 py-2 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-450">Ecosystem:</span>
            <span className="text-zinc-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-tight">
              V1.0 Live
            </span>
          </div>
        </div>
      </header>

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
            <span>Interactive Custom Planner & Active Assignments</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">What should I do today?</h2>
          <p className="text-xs text-zinc-500 font-medium">
            Review your custom objectives and make sure your homework targets are completed before the day ends.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Custom Task Checklist Card (Primary Emphasis - occupies 2 columns in large screen) */}
          <div className="lg:col-span-2 p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-[2.5rem] space-y-6 shadow-xs flex flex-col justify-between min-h-[320px]">
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">Personal Objectives</span>
                  <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">Active Agenda & Checklists</h3>
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
                    Add Goal
                  </button>
                </form>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-3">
                    <p className="text-xs font-bold text-zinc-455 dark:text-zinc-500 italic max-w-md mx-auto">
                      "No personal targets listed for today. Write your first study goal above to keep track of your focus targets!"
                    </p>
                    <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold leading-relaxed max-w-sm mx-auto">
                      Your items are cached securely in your school profile. Adding targets automatically helps you earn growth badges.
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
                        title="Remove objective"
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
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/60 block leading-none">Daily Study Progress</span>
              <h3 className="text-xl font-black uppercase tracking-tight">Today's Focus Goal</h3>
              <p className="text-xs text-white/80 leading-relaxed font-medium">
                {todayMinutes >= (dailyTarget * 60) 
                  ? "Outstanding! You have reached your active study goals and earned full daily badges." 
                  : `You logged ${Math.round(todayMinutes)} minutes of study time today. Complete your active sessions to fulfill your target.`
                }
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end text-xs font-mono font-bold select-none text-white/90">
                <span>Accumulated</span>
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
                <span className="font-bold">Streak Live: {stats[1]?.value || '0 days'}</span>
              </div>
              <Link 
                to="/app/focus" 
                className="text-[10px] font-black uppercase tracking-widest bg-white text-zinc-900 px-4 py-2.5 rounded-xl block text-center hover:bg-zinc-100 transition-all shadow-sm font-bold"
              >
                Focus Room
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
            <span>Reminders & Class Announcements</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">What is coming up next?</h2>
          <p className="text-xs text-zinc-500 font-medium">
            Stay on top of active school room agendas, upcoming quizzes, announcements, and peer updates.
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
              <span>Core Academic Workspace Portals</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Where can I continue studying?</h2>
            <p className="text-xs text-zinc-500 font-medium">
              Boot up secure, no-judgment AI tools to solve formulas, draft notes, or practice deep concentration rituals.
            </p>
          </div>
          <Link 
            to="/app/learn" 
            className="self-start sm:self-center px-5 py-3 bg-zinc-905 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all cursor-pointer shadow-sm font-bold active:scale-95 text-center"
          >
            All Platforms
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
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
                    navigate('/app/homework-solver');
                  }}
                  className="flex items-center gap-2.5 bg-zinc-900 dark:bg-zinc-950 border border-zinc-850 text-white pl-4 pr-3.5 py-2.5 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-zinc-805"
                >
                  <span className="text-[9.5px] tracking-wider">Solve Homework</span>
                  <div className="w-7 h-7 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                    <GraduationCap size={13} />
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
