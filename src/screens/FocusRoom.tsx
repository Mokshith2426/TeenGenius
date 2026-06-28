import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, Bell, BellOff,
  SkipForward, Settings2, CheckCircle2, Plus, Check, X,
  History, Clock, ChevronLeft, SkipBack, Loader2, Trophy,
  BarChart3, Flame, Target, Headphones, Radio,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  collection, addDoc, serverTimestamp, query,
  where, orderBy, onSnapshot, limit
} from 'firebase/firestore';
import { formatDate, toDate } from '../lib/dateUtils';
import { useMusic } from '../context/MusicContext';
import { awardGamificationPoints } from '../lib/gamification';
import {
  AmbientEngine,
  AMBIENT_TRACKS,
  playChime,
  sendNotification,
  AmbientId
} from '../lib/ambientEngine';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Task { id: string; text: string; completed: boolean }
interface SessionRecord { id: string; startTime: string | any; duration: number; type: string }
type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerState {
  mode: TimerMode;
  endTime: number | null;   // epoch ms when current session ends
  remainMs: number;          // cached remaining ms (updated each tick)
  isRunning: boolean;
  sessionCount: number;      // completed work sessions this cycle
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LONG_BREAK_INTERVAL = 4; // work sessions before long break
const STORAGE_KEY = 'TG_FOCUS_TIMER_v2';

const PRESETS = [
  { name: 'Pomodoro',    work: 25, shortBreak: 5,  longBreak: 15, label: '25/5' },
  { name: 'Short Sprint',work: 15, shortBreak: 3,  longBreak: 10, label: '15/3' },
  { name: 'Deep Work',   work: 50, shortBreak: 10, longBreak: 20, label: '50/10' },
  { name: 'Custom',      work: 0,  shortBreak: 0,  longBreak: 0,  label: 'Custom' },
] as const;

// ─── Helper: compute duration ms for a mode ──────────────────────────────────
function durationMs(mode: TimerMode, work: number, shortBreak: number, longBreak: number) {
  if (mode === 'work') return work * 60_000;
  if (mode === 'shortBreak') return shortBreak * 60_000;
  return longBreak * 60_000;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FocusRoom() {
  const { user, isGuest, isSandbox } = useAuth();
  const navigate = useNavigate();

  // Durations (minutes)
  const [workDur,  setWorkDur]  = useState(25);
  const [shortDur, setShortDur] = useState(5);
  const [longDur,  setLongDur]  = useState(15);

  // Timer state (timestamp-based = no drift)
  const [timer, setTimer] = useState<TimerState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TimerState;
        // If the end time is still in the future, restore running state
        if (parsed.isRunning && parsed.endTime && parsed.endTime > Date.now()) {
          return { ...parsed, remainMs: parsed.endTime - Date.now() };
        }
        // Otherwise restore paused state
        return { ...parsed, isRunning: false, endTime: null };
      }
    } catch {}
    return { mode: 'work', endTime: null, remainMs: 25 * 60_000, isRunning: false, sessionCount: 0 };
  });

  const rafRef = useRef<number | null>(null);
  const completeHandledRef = useRef(false);

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');

  // UI
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'ambient' | 'radio'>('ambient');
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [localTrigger, setLocalTrigger] = useState(0);
  const [gamificationAlert, setGamificationAlert] = useState<{ xp: number; badges: string[] } | null>(null);
  const [activePreset, setActivePreset] = useState(0);

  // Ambient audio
  const engineRef = useRef<AmbientEngine | null>(null);
  const [activeAmbient, setActiveAmbient] = useState<AmbientId | null>(null);
  const [ambientVol, setAmbientVol] = useState(0.4);
  const [isAmbientMuted, setIsAmbientMuted] = useState<boolean>(false);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState<boolean>(true);

  // Load saved configurations on mount
  useEffect(() => {
    const savedAmbient = localStorage.getItem('LAST_ACTIVE_AMBIENT') as AmbientId | null;
    const savedVol = localStorage.getItem('ambientVol');
    const savedMute = localStorage.getItem('ambientMute') === 'true';
    const savedPlay = localStorage.getItem('ambientPlay') !== 'false';

    if (savedVol) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed)) setAmbientVol(parsed);
    }
    setIsAmbientMuted(savedMute);
    setIsAmbientPlaying(savedPlay);

    // If matching a correct non-none id, restore it
    if (savedAmbient && (savedAmbient as string) !== 'none') {
      setActiveAmbient(savedAmbient);
    } else {
      setActiveAmbient(null);
    }
  }, []);

  // Radio (MusicContext)
  const {
    tracks, currentTrackIndex, currentTrack, isPlaying, status,
    volume, isMuted, error: musicError, currentTime, trackDuration,
    playTrack, togglePlay, nextTrack, prevTrack, changeVolume, toggleMuted, seek
  } = useMusic();

  // Unified Synchronization of Ambient & Radio with the Session Timer
  useEffect(() => {
    if (timer.isRunning) {
      if (activeTab === 'ambient' && activeAmbient && isAmbientPlaying) {
        if (!engineRef.current) {
          engineRef.current = new AmbientEngine();
        }
        engineRef.current.stop(); // Clear any pending cleanup intervals
        engineRef.current = new AmbientEngine();
        engineRef.current.start(activeAmbient, isAmbientMuted ? 0 : ambientVol);
      }
    } else {
      // Pause or stop smoothly when Focus session is not running (ends/pause)
      if (engineRef.current) {
        engineRef.current.stop();
      }
      if (activeTab === 'radio' && isPlaying) {
        togglePlay(); // Pause radio
      }
    }
  }, [timer.isRunning, activeAmbient, isAmbientPlaying, activeTab]);

  // Synchronize dynamic volume / mute sliders instantly
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setVolume(isAmbientMuted ? 0 : ambientVol);
    }
  }, [ambientVol, isAmbientMuted]);

  // ── Persist timer state ─────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
  }, [timer]);

  // ── RAF tick loop (timestamp-based, no drift) ────────────────────────────────
  useEffect(() => {
    if (!timer.isRunning || !timer.endTime) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    completeHandledRef.current = false;

    const tick = () => {
      const now = Date.now();
      const remain = timer.endTime! - now;

      if (remain <= 0) {
        if (!completeHandledRef.current) {
          completeHandledRef.current = true;
          setTimer(prev => ({ ...prev, isRunning: false, endTime: null, remainMs: 0 }));
          handleComplete();
        }
        return;
      }

      setTimer(prev => ({ ...prev, remainMs: remain }));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [timer.isRunning, timer.endTime]);

  // ── Visibility change: recalculate remaining when tab regains focus ──────────
  useEffect(() => {
    const onVisible = () => {
      if (timer.isRunning && timer.endTime) {
        const remain = timer.endTime - Date.now();
        if (remain <= 0) {
          setTimer(prev => ({ ...prev, isRunning: false, endTime: null, remainMs: 0 }));
          handleComplete();
        } else {
          setTimer(prev => ({ ...prev, remainMs: remain }));
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [timer.isRunning, timer.endTime]);

  // ── Session complete handler ─────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    if (chimeEnabled) playChime(timer.mode === 'work' ? 'work' : 'break');

    if (timer.mode === 'work') {
      const nextCount = timer.sessionCount + 1;
      const nextMode: TimerMode = nextCount % LONG_BREAK_INTERVAL === 0 ? 'longBreak' : 'shortBreak';

      if (notifEnabled) {
        await sendNotification(
          '🎉 Focus session complete!',
          `Great work! Time for a ${nextMode === 'longBreak' ? 'long' : 'short'} break.`
        );
      }

      // Save session to DB
      if (user) {
        try {
          if (isSandbox) {
            const saved = localStorage.getItem('SANDBOX_STUDY_SESSIONS') || '[]';
            const arr = JSON.parse(saved);
            arr.push({ id: `sb_${Date.now()}`, userId: user.uid, startTime: new Date().toISOString(), duration: workDur, type: 'work' });
            localStorage.setItem('SANDBOX_STUDY_SESSIONS', JSON.stringify(arr));
            setLocalTrigger(p => p + 1);
          } else {
            await addDoc(collection(db, 'studySessions'), {
              userId: user.uid, startTime: serverTimestamp(), duration: workDur, type: 'work'
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'studySessions');
        }

        try {
          const res = await awardGamificationPoints(user.uid, 'FOCUS_SESSION_COMPLETE', isGuest);
          if (res.xpAwarded > 0) {
            setGamificationAlert({ xp: res.xpAwarded, badges: res.newBadgesEarned });
            setTimeout(() => setGamificationAlert(null), 5000);
          }
        } catch {}
      }

      setTimer(prev => ({
        ...prev,
        mode: nextMode,
        sessionCount: nextCount,
        remainMs: durationMs(nextMode, workDur, shortDur, longDur),
        endTime: null,
        isRunning: false,
      }));
    } else {
      if (notifEnabled) {
        await sendNotification('⏰ Break over!', 'Time to focus again. You got this!');
      }
      setTimer(prev => ({
        ...prev,
        mode: 'work',
        remainMs: workDur * 60_000,
        endTime: null,
        isRunning: false,
      }));
    }
  }, [timer.mode, timer.sessionCount, chimeEnabled, notifEnabled, user, isGuest, workDur, shortDur, longDur]);

  // ── Controls ────────────────────────────────────────────────────────────────
  const startResume = useCallback(() => {
    setTimer(prev => ({
      ...prev,
      isRunning: true,
      endTime: Date.now() + prev.remainMs,
    }));
  }, []);

  const pause = useCallback(() => {
    setTimer(prev => ({
      ...prev,
      isRunning: false,
      endTime: null,
      remainMs: prev.endTime ? Math.max(0, prev.endTime - Date.now()) : prev.remainMs,
    }));
  }, []);

  const reset = useCallback(() => {
    setTimer(prev => ({
      ...prev,
      isRunning: false,
      endTime: null,
      remainMs: durationMs(prev.mode, workDur, shortDur, longDur),
    }));
  }, [workDur, shortDur, longDur]);

  const skip = useCallback(() => {
    const nextMode: TimerMode = timer.mode === 'work'
      ? ((timer.sessionCount + 1) % LONG_BREAK_INTERVAL === 0 ? 'longBreak' : 'shortBreak')
      : 'work';
    setTimer(prev => ({
      ...prev,
      isRunning: false,
      endTime: null,
      mode: nextMode,
      sessionCount: timer.mode === 'work' ? prev.sessionCount + 1 : prev.sessionCount,
      remainMs: durationMs(nextMode, workDur, shortDur, longDur),
    }));
  }, [timer.mode, timer.sessionCount, workDur, shortDur, longDur]);

  const switchMode = useCallback((mode: TimerMode) => {
    setTimer(prev => ({
      ...prev,
      mode,
      isRunning: false,
      endTime: null,
      remainMs: durationMs(mode, workDur, shortDur, longDur),
    }));
  }, [workDur, shortDur, longDur]);

  // ── Formatted time ──────────────────────────────────────────────────────────
  const { displayMin, displaySec, totalMs, progressPct } = useMemo(() => {
    const totalMs = durationMs(timer.mode, workDur, shortDur, longDur);
    const remain = Math.max(0, timer.remainMs);
    const secs = Math.floor(remain / 1000);
    return {
      displayMin: String(Math.floor(secs / 60)).padStart(2, '0'),
      displaySec: String(secs % 60).padStart(2, '0'),
      totalMs,
      progressPct: remain / totalMs,
    };
  }, [timer.remainMs, timer.mode, workDur, shortDur, longDur]);

  // ── History ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (isSandbox) {
      try {
        const arr = JSON.parse(localStorage.getItem('SANDBOX_STUDY_SESSIONS') || '[]');
        setHistory(arr.slice(-10).reverse());
      } catch {}
      return;
    }
    const q = query(collection(db, 'studySessions'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const records = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          startTime: toDate(data.startTime)
        } as SessionRecord;
      });
      // Sort in-memory by startTime descending
      records.sort((a, b) => {
        const timeA = a.startTime ? a.startTime.getTime() : 0;
        const timeB = b.startTime ? b.startTime.getTime() : 0;
        return timeB - timeA;
      });
      setHistory(records.slice(0, 20));
    }, err => handleFirestoreError(err, OperationType.LIST, 'studySessions'));
    return unsub;
  }, [user, localTrigger]);

  // ── Ambient controls ────────────────────────────────────────────────────────
  const toggleAmbient = useCallback((id: AmbientId | 'none') => {
    if (id === 'none') {
      setActiveAmbient(null);
      localStorage.removeItem('LAST_ACTIVE_AMBIENT');
      if (engineRef.current) {
        engineRef.current.stop();
      }
    } else {
      setActiveAmbient(id);
      localStorage.setItem('LAST_ACTIVE_AMBIENT', id);
      setIsAmbientPlaying(true);
      localStorage.setItem('ambientPlay', 'true');
    }
  }, []);

  const handleAmbientVol = useCallback((v: number) => {
    setAmbientVol(v);
    localStorage.setItem('ambientVol', String(v));
    if (v > 0 && isAmbientMuted) {
      setIsAmbientMuted(false);
      localStorage.setItem('ambientMute', 'false');
    }
  }, [isAmbientMuted]);

  const toggleAmbientPlay = useCallback(() => {
    setIsAmbientPlaying(prev => {
      const next = !prev;
      localStorage.setItem('ambientPlay', String(next));
      return next;
    });
  }, []);

  const toggleAmbientMute = useCallback(() => {
    setIsAmbientMuted(prev => {
      const next = !prev;
      localStorage.setItem('ambientMute', String(next));
      return next;
    });
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    engineRef.current?.stop();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Statistics ──────────────────────────────────────────────────────────────
  const { todayMin, todaySessions, streak, weeklyStats, maxWeekMin } = useMemo(() => {
    const today = new Date().toDateString();
    const todaySess = history.filter(s => s.startTime && new Date(s.startTime).toDateString() === today);
    const todayMin = todaySess.reduce((a, s) => a + (s.duration || 0), 0);
    const todaySessions = todaySess.length;

    // Daily streak
    let streak = 0;
    const d = new Date();
    while (true) {
      const ds = d.toDateString();
      const hasSess = history.some(s => s.startTime && new Date(s.startTime).toDateString() === ds);
      if (!hasSess) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }

    const weeklyStats = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const ds = d.toDateString();
      const min = history.filter(s => s.startTime && new Date(s.startTime).toDateString() === ds)
        .reduce((a, s) => a + (s.duration || 0), 0);
      return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), min, isToday: i === 6 };
    });
    const maxWeekMin = Math.max(...weeklyStats.map(s => s.min), 1);

    return { todayMin, todaySessions, streak, weeklyStats, maxWeekMin };
  }, [history]);

  // ── Circular progress params ────────────────────────────────────────────────
  const RADIUS = 130;
  const CIRC = 2 * Math.PI * RADIUS;
  const strokeOffset = CIRC * (1 - progressPct);

  // ── Mode label / color ───────────────────────────────────────────────────────
  const modeColor = timer.mode === 'work' ? 'blue' : timer.mode === 'shortBreak' ? 'emerald' : 'violet';
  const modeLabel = timer.mode === 'work' ? 'FOCUS' : timer.mode === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK';

  // ── Audio time formatter ────────────────────────────────────────────────────
  const fmtTime = (s: number) => { if (isNaN(s)) return '0:00'; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; };

  const applySettings = (w: number, sb: number, lb: number) => {
    setWorkDur(w); setShortDur(sb); setLongDur(lb);
    setTimer(prev => ({
      ...prev,
      isRunning: false,
      endTime: null,
      remainMs: durationMs(prev.mode, w, sb, lb),
    }));
    setShowSettings(false);
  };

  return (
    <div className="space-y-8 pb-24 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app')}
            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 hover:text-blue-600 transition-all active:scale-95 cursor-pointer lg:hidden"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase leading-none">
              Focus <span className="text-blue-600">Zone</span>
            </h1>
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Deep Work Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 hover:text-blue-600 transition-all cursor-pointer"
            title="Session History"
            aria-label="Session history"
          >
            <History size={18} />
          </button>
          <button
            onClick={async () => {
              if (Notification.permission === 'default') await Notification.requestPermission();
              setNotifEnabled(p => !p);
            }}
            className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 hover:text-blue-600 transition-all cursor-pointer"
            title={notifEnabled ? 'Disable notifications' : 'Enable notifications'}
            aria-label="Toggle notifications"
          >
            {notifEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        </div>
      </header>

      {/* ── Stats Bar ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: `${todayMin}`, unit: 'MIN', icon: Clock, color: 'blue' },
          { label: 'Sessions', value: `${todaySessions}`, unit: 'TODAY', icon: Target, color: 'indigo' },
          { label: 'Streak', value: `${streak}`, unit: 'DAYS', icon: Flame, color: 'orange' },
          { label: 'Cycle', value: `${(timer.sessionCount % LONG_BREAK_INTERVAL) + 1}/${LONG_BREAK_INTERVAL}`, unit: 'SESSION', icon: BarChart3, color: 'emerald' },
        ].map(({ label, value, unit, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-${color}-100 dark:bg-${color}-950/40`}>
              <Icon size={16} className={`text-${color}-600 dark:text-${color}-400`} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black tabular-nums text-zinc-900 dark:text-white">{value}</span>
                <span className="text-[8px] font-black text-zinc-400">{unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ────────────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-8 items-start">

        {/* Timer Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-zinc-100/50 dark:shadow-none flex flex-col items-center gap-6">

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-full max-w-sm">
            {([['work', 'Focus'], ['shortBreak', 'Short Break'], ['longBreak', 'Long Break']] as [TimerMode, string][]).map(([m, lbl]) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  timer.mode === m
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            {PRESETS.slice(0, 3).map((p, i) => (
              <button
                key={p.name}
                onClick={() => {
                  setActivePreset(i);
                  applySettings(p.work, p.shortBreak, p.longBreak);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer",
                  activePreset === i
                    ? "bg-blue-600/10 border-blue-500/60 text-blue-600 dark:text-blue-400"
                    : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200/60 dark:border-zinc-700 text-zinc-450 hover:text-blue-500"
                )}
              >
                {p.name} <span className="opacity-60">({p.label})</span>
              </button>
            ))}
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border bg-zinc-50 dark:bg-zinc-800 border-zinc-200/60 dark:border-zinc-700 text-zinc-450 hover:text-blue-500 cursor-pointer transition-all"
            >
              Custom
            </button>
          </div>

          {/* Circular progress */}
          <div className="relative w-72 h-72">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 300 300">
              <circle cx="150" cy="150" r={RADIUS}
                className="fill-none stroke-zinc-100 dark:stroke-zinc-800" strokeWidth={10} />
              <motion.circle
                cx="150" cy="150" r={RADIUS}
                className={cn("fill-none", {
                  'stroke-blue-600': timer.mode === 'work',
                  'stroke-emerald-500': timer.mode === 'shortBreak',
                  'stroke-violet-500': timer.mode === 'longBreak',
                })}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                animate={{ strokeDashoffset: strokeOffset }}
                transition={{ duration: 0.5, ease: 'linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                key={`${displayMin}:${displaySec}`}
                className="text-7xl font-black tracking-tighter text-zinc-900 dark:text-white tabular-nums leading-none"
              >
                {displayMin}:{displaySec}
              </motion.span>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-[0.4em] mt-3",
                { 'text-blue-500': modeColor === 'blue', 'text-emerald-500': modeColor === 'emerald', 'text-violet-500': modeColor === 'violet' }
              )}>
                {modeLabel}
              </span>
              {timer.isRunning && (
                <span className="mt-1.5 text-[8px] text-zinc-400 font-black uppercase tracking-widest animate-pulse">
                  Running
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-5">
            <button
              onClick={reset}
              className="p-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-full transition-all cursor-pointer"
              aria-label="Reset timer"
            >
              <RotateCcw size={24} />
            </button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={timer.isRunning ? pause : startResume}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer",
                timer.mode === 'work'
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30"
                  : timer.mode === 'shortBreak'
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-400/30"
                    : "bg-violet-500 hover:bg-violet-600 text-white shadow-violet-400/30"
              )}
              aria-label={timer.isRunning ? 'Pause' : 'Start'}
            >
              {timer.isRunning
                ? <Pause size={40} fill="currentColor" />
                : <Play size={40} fill="currentColor" className="ml-1" />}
            </motion.button>

            <button
              onClick={skip}
              className="p-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-full transition-all cursor-pointer"
              aria-label="Skip to next session"
            >
              <SkipForward size={24} />
            </button>
          </div>

          {/* Weekly chart */}
          <div className="w-full border-t border-zinc-100 dark:border-zinc-800 pt-6 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Weekly Progress</p>
            <div className="flex items-end justify-between h-14 gap-1.5">
              {weeklyStats.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[8px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                      {s.min}m
                    </div>
                  </div>
                  <div className="w-full flex items-end h-10 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((s.min / maxWeekMin) * 100, s.min > 0 ? 8 : 0)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.05 }}
                      className={cn("w-full rounded-b-sm",
                        s.isToday ? "bg-gradient-to-t from-blue-600 to-blue-400" : "bg-zinc-300 dark:bg-zinc-600"
                      )}
                    />
                  </div>
                  <span className={cn("text-[8px] font-black uppercase", s.isToday ? "text-blue-600 dark:text-blue-400" : "text-zinc-400")}>
                    {s.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-6">

          {/* Tasks */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2rem] p-6 space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-blue-600" /> Focus Tasks
            </h3>
            <form onSubmit={e => { e.preventDefault(); if (!newTask.trim()) return; setTasks(p => [...p, { id: `${Date.now()}`, text: newTask.trim(), completed: false }]); setNewTask(''); }} className="flex gap-2">
              <input
                type="text"
                placeholder="What are you working on?"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!newTask.trim()}
                className="p-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:scale-105 disabled:opacity-40 transition-all cursor-pointer"
                aria-label="Add task"
              >
                <Plus size={18} />
              </button>
            </form>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="py-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                  <p className="text-xs font-bold text-zinc-400">Add tasks to stay focused</p>
                </div>
              ) : tasks.map(t => (
                <motion.div
                  key={t.id}
                  layout
                  onClick={() => setTasks(p => p.map(x => x.id === t.id ? { ...x, completed: !x.completed } : x))}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border select-none",
                    t.completed
                      ? "bg-zinc-50/50 dark:bg-zinc-800/20 border-transparent opacity-50"
                      : "bg-white dark:bg-zinc-800/40 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                    t.completed ? "bg-blue-600 border-blue-600" : "border-zinc-300 dark:border-zinc-600"
                  )}>
                    {t.completed && <Check size={12} className="text-white" />}
                  </div>
                  <span className={cn("text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1", t.completed && "line-through text-zinc-400")}>
                    {t.text}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setTasks(p => p.filter(x => x.id !== t.id)); }}
                    className="p-1 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Remove task"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Audio Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2rem] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Headphones size={14} /> Study Audio
              </h3>
              <div className="flex gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                {(['ambient', 'radio'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      activeTab === tab ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400"
                    )}
                  >
                    {tab === 'ambient' ? 'Ambient' : 'Radio'}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'ambient' ? (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  {AMBIENT_TRACKS.map(({ id, label, emoji, desc }) => (
                    <button
                      key={id}
                      onClick={() => toggleAmbient(id)}
                      className={cn(
                        "p-3.5 rounded-2xl flex flex-col items-start gap-2 border transition-all cursor-pointer text-left",
                        activeAmbient === id
                          ? "bg-blue-600 border-blue-600 text-white animate-fade-in"
                          : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:border-blue-400/50 hover:text-blue-600"
                      )}
                    >
                      <span className="text-xl">{emoji}</span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider leading-none">{label}</p>
                        <p className={cn("text-[9px] mt-0.5", activeAmbient === id ? "text-blue-200" : "text-zinc-400")}>{desc}</p>
                      </div>
                    </button>
                  ))}

                  {/* No Music Card */}
                  <button
                    onClick={() => toggleAmbient('none')}
                    className={cn(
                      "p-3.5 rounded-2xl flex flex-col items-start gap-2 border transition-all cursor-pointer text-left",
                      !activeAmbient
                        ? "bg-blue-600 border-blue-600 text-white animate-fade-in"
                        : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:border-blue-400/50 hover:text-blue-600"
                    )}
                  >
                    <span className="text-xl">🔇</span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider leading-none">No Music</p>
                      <p className={cn("text-[9px] mt-0.5", !activeAmbient ? "text-blue-200" : "text-zinc-400")}>Silence & quietude</p>
                    </div>
                  </button>
                </div>

                {activeAmbient ? (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {AMBIENT_TRACKS.find(t => t.id === activeAmbient)?.emoji}
                        </span>
                        <div>
                          <h4 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">
                            {AMBIENT_TRACKS.find(t => t.id === activeAmbient)?.label} Soundscape
                          </h4>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-widest",
                            timer.isRunning && isAmbientPlaying
                              ? "text-blue-500 animate-pulse"
                              : "text-zinc-400"
                          )}>
                            {timer.isRunning && isAmbientPlaying
                              ? "Active & Playing"
                              : !isAmbientPlaying
                                ? "User Paused"
                                : "Ready - Starts with Session"}
                          </span>
                        </div>
                      </div>

                      {timer.isRunning && isAmbientPlaying && (
                        <div className="flex items-end gap-0.5 h-4">
                          {[6, 12, 8, 10, 4].map((h, i) => (
                            <div
                              key={i}
                              className="w-0.5 bg-blue-500 rounded-full animate-pulse"
                              style={{
                                height: h,
                                animationDelay: `${i * 150}ms`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-100/50 dark:border-zinc-800/50">
                      <button
                        onClick={toggleAmbientPlay}
                        className={cn(
                          "p-2 rounded-xl transition-all cursor-pointer",
                          isAmbientPlaying
                            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                        aria-label={isAmbientPlaying ? "Pause ambient sound" : "Play ambient sound"}
                        title={isAmbientPlaying ? "Pause ambient sound" : "Play ambient sound"}
                      >
                        {isAmbientPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                      </button>

                      <div className="flex-1 flex items-center gap-2">
                        <button
                          onClick={toggleAmbientMute}
                          className="text-zinc-400 hover:text-zinc-600 cursor-pointer focus:outline-none"
                          aria-label={isAmbientMuted ? "Unmute" : "Mute"}
                        >
                          {isAmbientMuted || ambientVol === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isAmbientMuted ? 0 : ambientVol}
                          onChange={e => handleAmbientVol(parseFloat(e.target.value))}
                          className="flex-1 h-1 accent-blue-600 cursor-pointer bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none"
                          aria-label="Ambient sound volume slider"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
                    <p className="text-[10px] text-zinc-400 font-medium">No ambient soundscape selected. Select one above to play during focus!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {/* Mini player */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">{(currentTrack as any)?.genre || 'Lo-Fi'}</p>
                      <h4 className="text-sm font-extrabold text-zinc-800 dark:text-white truncate">{(currentTrack as any)?.title || 'No track'}</h4>
                      <p className="text-[10px] text-zinc-400 truncate">{(currentTrack as any)?.desc || ''}</p>
                    </div>
                    <div className="flex items-end gap-0.5 h-5 shrink-0">
                      {[12, 18, 8, 15, 6].map((h, i) => (
                        <div key={i} className={cn("w-1 bg-blue-600 dark:bg-blue-400 rounded-full transition-all",
                          isPlaying ? "animate-pulse" : "")}
                          style={{ height: isPlaying ? h : 3, animationDelay: `${i * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <input type="range" min={0} max={trackDuration || 100} value={currentTime || 0}
                      onChange={e => seek(parseFloat(e.target.value))} disabled={!trackDuration}
                      className="w-full h-1 accent-blue-600 cursor-pointer" aria-label="Seek" />
                    <div className="flex justify-between text-[9px] font-mono text-zinc-400 mt-1">
                      <span>{fmtTime(currentTime)}</span>
                      <span>{trackDuration ? fmtTime(trackDuration) : (currentTrack as any)?.durationLabel || '0:00'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={prevTrack} className="p-2 rounded-xl bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-500 hover:text-zinc-900 transition-all cursor-pointer" aria-label="Previous">
                        <SkipBack size={13} />
                      </button>
                      <button onClick={togglePlay}
                        className={cn("p-2.5 rounded-full transition-all cursor-pointer",
                          isPlaying ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "bg-blue-600 text-white hover:bg-blue-700")}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                      </button>
                      <button onClick={nextTrack} className="p-2 rounded-xl bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-zinc-500 hover:text-zinc-900 transition-all cursor-pointer" aria-label="Next">
                        <SkipForward size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={toggleMuted} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                        {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                      <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                        onChange={e => changeVolume(parseFloat(e.target.value))}
                        className="w-20 h-1 accent-blue-500 cursor-pointer" aria-label="Volume" />
                    </div>
                  </div>

                  {musicError && (
                    <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 rounded-xl p-2.5">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <p className="text-[10px] font-medium">{musicError}</p>
                    </div>
                  )}
                </div>

                {/* Track list */}
                <div className="space-y-1.5 animate-fade-in">
                  {tracks.map((track, i) => {
                    const active = i === currentTrackIndex;
                    return (
                      <button key={track.id} onClick={() => playTrack(i)}
                        className={cn("w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer",
                          active ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/50" : "bg-zinc-50/50 dark:bg-zinc-800/30 border-transparent hover:border-zinc-200")}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[9px] font-mono text-zinc-400 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                          <div className="min-w-0">
                            <p className={cn("text-xs font-bold truncate", active ? "text-blue-600 dark:text-blue-400" : "text-zinc-800 dark:text-zinc-200")}>{track.title}</p>
                            <p className="text-[9px] text-zinc-400 truncate">{track.genre}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {active && isPlaying && <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 animate-pulse">LIVE</span>}
                          <span className="text-[9px] font-mono text-zinc-400">{track.durationLabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Settings Modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase">Timer Settings</h2>
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Custom durations</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {[
                { label: 'Focus Duration', val: workDur, set: setWorkDur, max: 120, accent: '#2563eb' },
                { label: 'Short Break', val: shortDur, set: setShortDur, max: 30, accent: '#10b981' },
                { label: 'Long Break', val: longDur, set: setLongDur, max: 60, accent: '#8b5cf6' },
              ].map(({ label, val, set, max, accent }) => (
                <div key={label} className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</label>
                    <span className="text-xl font-black tabular-nums text-zinc-900 dark:text-white w-12 text-right">{val}<span className="text-xs text-zinc-400 font-bold ml-1">min</span></span>
                  </div>
                  <input type="range" min={1} max={max} value={val} onChange={e => set(Number(e.target.value))}
                    className="w-full h-2 rounded-full cursor-pointer appearance-none"
                    style={{ accentColor: accent }}
                    aria-label={label}
                  />
                </div>
              ))}

              <div className="flex items-center justify-between py-4 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <p className="text-xs font-black text-zinc-800 dark:text-white">Completion Chime</p>
                  <p className="text-[10px] text-zinc-400">Sound when session ends</p>
                </div>
                <button onClick={() => setChimeEnabled(p => !p)} className={cn("w-12 h-6 rounded-full transition-all cursor-pointer relative", chimeEnabled ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700")}>
                  <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", chimeEnabled ? "left-7" : "left-1")} />
                </button>
              </div>

              <button
                onClick={() => { setActivePreset(3); applySettings(workDur, shortDur, longDur); }}
                className="w-full mt-4 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] transition-all shadow-lg cursor-pointer"
              >
                Apply Settings
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── History Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-black tracking-tighter uppercase">Session History</h2>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Recent focus sessions</p>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 animate-fade-in">
                {history.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <Trophy size={32} className="mx-auto text-zinc-300 dark:text-zinc-600" />
                    <p className="text-sm font-bold text-zinc-400">No sessions yet</p>
                    <p className="text-xs text-zinc-300 dark:text-zinc-600">Complete a focus session to see it here</p>
                  </div>
                ) : history.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Clock size={11} />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          {s.startTime ? formatDate(s.startTime, { month: 'short', day: 'numeric' }) : '—'}
                        </span>
                      </div>
                      <p className="text-sm font-black text-zinc-900 dark:text-white">Focus Session</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black tabular-nums text-blue-600">{s.duration}</span>
                      <span className="text-[9px] font-black text-zinc-400 ml-1">MIN</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Gamification Toast ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {gamificationAlert && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.92 }}
            className="fixed bottom-24 right-4 md:right-8 z-[200] max-w-sm w-full bg-zinc-900 dark:bg-zinc-800 border border-zinc-700 text-white rounded-2xl p-5 shadow-2xl flex gap-4"
          >
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Session Complete</p>
              <p className="text-sm font-black mt-0.5">+{gamificationAlert.xp} XP Earned!</p>
              {gamificationAlert.badges.length > 0 && (
                <p className="text-[10px] text-amber-300 mt-1">🏆 {gamificationAlert.badges[0]}</p>
              )}
            </div>
            <button onClick={() => setGamificationAlert(null)} className="text-zinc-450 hover:text-white cursor-pointer p-1">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
