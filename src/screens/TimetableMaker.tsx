import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  Plus, 
  X, 
  Sparkles, 
  Loader2, 
  Download, 
  Printer, 
  Save, 
  CheckCircle2, 
  GraduationCap, 
  Target, 
  HelpCircle,
  Award,
  ChevronRight,
  TrendingUp,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { safeFetch } from '../lib/api';

interface TimetableItem {
  time: string;
  activity: string;
  subject: string;
}

interface TimetableData {
  [day: string]: TimetableItem[];
}

export default function TimetableMaker({ isIntegrated = false }: { isIntegrated?: boolean }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [hours, setHours] = useState('4');
  const [preferences, setPreferences] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const { user, isGuest, triggerGuestPrompt } = useAuth();

  // Load from local storage cache on mount
  useEffect(() => {
    const cached = localStorage.getItem('STUDENT_LOCAL_TIMETABLE_CACHE');
    if (cached) {
      try {
        setTimetable(JSON.parse(cached));
      } catch (err) {
        console.error("[Timetable Cache Error]:", err);
      }
    }
  }, []);

  // Save changes to local storage when state updates
  useEffect(() => {
    if (timetable) {
      localStorage.setItem('STUDENT_LOCAL_TIMETABLE_CACHE', JSON.stringify(timetable));
    }
  }, [timetable]);

  // New Personalization States
  const [durationCategory, setDurationCategory] = useState<'quick' | 'daily' | 'multiday' | 'weekly' | 'longterm'>('weekly');
  const [durationValue, setDurationValue] = useState<string>('1_week');
  const [studentClass, setStudentClass] = useState('');
  const [board, setBoard] = useState('');
  const [stream, setStream] = useState('');
  const [weakSubjects, setWeakSubjects] = useState('');
  const [strongSubjects, setStrongSubjects] = useState('');
  const [examDates, setExamDates] = useState('');
  const [goals, setGoals] = useState('');

  const durationOptions = {
    quick: {
      label: "Quick Session",
      desc: "30 mins to 3 hours tactical prep",
      values: [
        { id: "30_mins", name: "30 Minutes" },
        { id: "1_hour", name: "1 Hour" },
        { id: "2_hours", name: "2 Hours" },
        { id: "3_hours", name: "3 Hours" }
      ],
      defaultVal: "1_hour"
    },
    daily: {
      label: "Daily Timetable",
      desc: "In-depth scheduling for today/tomorrow",
      values: [
        { id: "today", name: "Today Only" },
        { id: "tomorrow", name: "Tomorrow Only" }
      ],
      defaultVal: "today"
    },
    multiday: {
      label: "Multi-Day Timetable",
      desc: "Focus unit tests & mid-range goals",
      values: [
        { id: "3_days", name: "3 Days Plan" },
        { id: "5_days", name: "5 Days Plan" },
        { id: "7_days", name: "7 Days Plan" }
      ],
      defaultVal: "3_days"
    },
    weekly: {
      label: "Weekly Timetable",
      desc: "School routines & regular calendars",
      values: [
        { id: "1_week", name: "1 Week" },
        { id: "2_weeks", name: "2 Weeks" }
      ],
      defaultVal: "1_week"
    },
    longterm: {
      label: "Long-Term Timetable",
      desc: "Board prep & long-term exams",
      values: [
        { id: "30_days", name: "30 Days Roadmap" },
        { id: "60_days", name: "60 Days Roadmap" },
        { id: "90_days", name: "90 Days Roadmap" }
      ],
      defaultVal: "30_days"
    }
  };

  const handleCategoryChange = (cat: 'quick' | 'daily' | 'multiday' | 'weekly' | 'longterm') => {
    setDurationCategory(cat);
    setDurationValue(durationOptions[cat].defaultVal);
  };

  const addSubject = () => {
    if (newSubject.trim() && !subjects.includes(newSubject.trim())) {
      setSubjects([...subjects, newSubject.trim()]);
      setNewSubject('');
    }
  };

  const removeSubject = (sub: string) => {
    setSubjects(subjects.filter(s => s !== sub));
  };

  const generateTimetable = async () => {
    if (subjects.length === 0) return;
    if (!navigator.onLine) {
      setError("🔌 Timetable compilation is offline. AI generation requires an active internet connection. You can still access and view your recently generated timetable card lower down!");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await safeFetch('/api/gemini/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subjects, 
          hoursPerDay: hours, 
          preferences,
          durationCategory,
          durationValue,
          studentClass,
          board,
          stream,
          weakSubjects,
          strongSubjects,
          examDates,
          goals
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data?.error || "We could not generate your timetable right now. Please try again.");
      }
      setTimetable(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to generate timetable.");
    } finally {
      setIsLoading(false);
      setIsSaved(false);
    }
  };

  const saveTimetable = async () => {
    if (isGuest) {
      triggerGuestPrompt("Save personalized study timetables");
      return;
    }
    if (!navigator.onLine) {
      setError("🔌 Offline: Cloud sync is temporarily deferred. Your active schedule is preserved offline in your local browser cache!");
      return;
    }
    if (!timetable || !user || isSaving) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'timetables'), {
        userId: user.uid,
        subjects,
        timetableData: timetable,
        hoursPerDay: hours,
        preferences,
        durationCategory,
        durationValue,
        studentClass,
        board,
        stream,
        weakSubjects,
        strongSubjects,
        examDates,
        goals,
        createdAt: serverTimestamp(),
      });
      setIsSaved(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'timetables');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={cn(isIntegrated ? "space-y-4 w-full" : "p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8")}>
      {!isIntegrated && (
        <header className="space-y-2 md:space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <Sparkles size={12} /> AI Intelligent Scheduler
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">AI Timetable Maker</h1>
          <p className="text-zinc-600 dark:text-zinc-450 max-w-2xl text-xs md:text-sm leading-relaxed">
            Configure flexible study durations, target milestones, strong/weak areas, and syllabus topics to auto-compile a balanced schedule.
          </p>
        </header>
      )}

      {!timetable ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Main config Form Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step Progress Indicator Header */}
            <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-3xl border border-zinc-200/50 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                {[
                  { num: 1, label: "Scope & Subjects", desc: "Duration & topics" },
                  { num: 2, label: "Academic Profile", desc: "Class, Stream & Board" },
                  { num: 3, label: "Priorities", desc: "Strengths & Weaknesses" },
                  { num: 4, label: "Daily Workload", desc: "Hours & style" }
                ].map((s) => (
                  <button
                    key={s.num}
                    onClick={() => subjects.length > 0 && s.num < step && setStep(s.num)}
                    disabled={subjects.length === 0}
                    className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left group relative focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300",
                        step === s.num
                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/20 ring-4 ring-amber-500/10 scale-105"
                          : step > s.num
                            ? "bg-green-500 text-white"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                      )}>
                        {step > s.num ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          s.num
                        )}
                      </div>
                      {/* Connector Line for Desktop */}
                      {s.num < 4 && (
                        <div className="hidden sm:block flex-1 h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mx-2 overflow-hidden">
                          <div className={cn(
                            "h-full transition-all duration-500",
                            step > s.num ? "bg-green-500 w-full" : step === s.num ? "bg-amber-500/50 w-1/2" : "w-0"
                          )}></div>
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "hidden sm:block text-[11px] font-black uppercase tracking-wider mt-2.5 transition-colors",
                      step === s.num ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"
                    )}>
                      {s.label}
                    </span>
                    <span className="hidden md:block text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {s.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Content Wrapper */}
            <div className="bg-white dark:bg-zinc-900 p-5 sm:p-6 md:p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800 shadow-xs space-y-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="text-amber-500" size={20} /> Choose Study Duration
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Select the duration scope for this specific revision schedule.</p>
                    </div>

                    {/* Section 1: Duration Selector */}
                    <div className="space-y-3">
                      <label htmlFor="duration-category-select" className="text-[11px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                        Schedule Format
                      </label>
                      <div className="relative">
                        <select
                          id="duration-category-select"
                          value={durationCategory}
                          onChange={(e) => handleCategoryChange(e.target.value as any)}
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3.5 text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 appearance-none transition-all cursor-pointer"
                        >
                          <option value="quick">⚡ Quick Session (30 Mins - 3 Hours)</option>
                          <option value="daily">📅 Daily Timetable (Today / Tomorrow)</option>
                          <option value="multiday">🗓️ Multi-Day Timetable (3 - 7 Days)</option>
                          <option value="weekly">🔄 Weekly Timetable (1 - 2 Weeks)</option>
                          <option value="longterm">🚀 Long-Term Timetable (30 - 90 Days)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400 dark:text-zinc-500">
                          <ChevronRight size={16} className="rotate-90" />
                        </div>
                      </div>

                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block pt-2">
                        Adjust Specific Scope Value
                      </label>

                      {/* Sub-values Segmented Selector */}
                      <div className="bg-zinc-50 dark:bg-zinc-850/80 p-1.5 rounded-2xl border border-zinc-150 dark:border-zinc-800/60 flex flex-wrap gap-1">
                        {durationOptions[durationCategory].values.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setDurationValue(v.id)}
                            type="button"
                            className={cn(
                              "flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wide cursor-pointer text-center",
                              durationValue === v.id
                                ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs border border-zinc-200 dark:border-zinc-800"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                            )}
                          >
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <hr className="border-zinc-100 dark:border-zinc-800" />

                    {/* Section 2: Syllabus Subjects */}
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                          <BookOpen className="text-amber-500" size={20} /> Syllabus / Subjects to Cover
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Specify which topics or classes we should map out in your timetable.</p>
                      </div>

                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSubject()}
                          placeholder="e.g. Chemistry, Advanced Calculus, History..."
                          className="flex-1 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-900 dark:text-white border border-zinc-250 dark:border-zinc-800/80 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all placeholder:text-zinc-400 text-xs md:text-sm font-bold"
                        />
                        <button 
                          onClick={addSubject}
                          className="p-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-205 transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          <Plus size={18} />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <AnimatePresence>
                          {subjects.map(sub => (
                            <motion.span 
                              key={sub}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold border border-amber-500/20 dark:border-amber-500/15"
                            >
                              {sub}
                              <button onClick={() => removeSubject(sub)} className="p-0.5 hover:bg-amber-500/25 rounded-full cursor-pointer">
                                <X size={12} className="text-amber-600 hover:text-amber-900 transition-colors" />
                              </button>
                            </motion.span>
                          ))}
                        </AnimatePresence>
                        {subjects.length === 0 && (
                          <div className="w-full py-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs text-zinc-400 dark:text-zinc-500 italic">
                            No subjects added yet. Add at least one to move to Step 2.
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <GraduationCap className="text-amber-500" size={20} /> Academic Profile
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Provide your school system info to auto-calibrate appropriate study intervals.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {/* Class Field */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Student Class</label>
                        <select
                          value={studentClass}
                          onChange={(e) => setStudentClass(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 font-bold"
                        >
                          <option value="">Select Class</option>
                          <option value="Class 9">Class 9</option>
                          <option value="Class 10">Class 10 (High School)</option>
                          <option value="Class 11">Class 11</option>
                          <option value="Class 12">Class 12 (Board Prep)</option>
                          <option value="College Undergraduate">College / University</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Board Field */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Board / Curriculum</label>
                        <select
                          value={board}
                          onChange={(e) => setBoard(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 font-bold"
                        >
                          <option value="">Select Board</option>
                          <option value="CBSE">CBSE (Central Board)</option>
                          <option value="ICSE">ICSE / ISC</option>
                          <option value="State Board">State Board</option>
                          <option value="SSC">SSC (Secondary School)</option>
                          <option value="IB">IB Diploma</option>
                          <option value="CIE">Cambridge IGCSE</option>
                          <option value="AP/CollegeBoard">AP / SAT Curriculum</option>
                          <option value="Other">Other Curriculum</option>
                        </select>
                      </div>

                      {/* Academic Stream */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Academic Stream</label>
                        <select
                          value={stream}
                          onChange={(e) => setStream(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 font-bold"
                        >
                          <option value="">Select Academic Stream</option>
                          <option value="Science (PCM)">Science (Physics, Chemistry, Math)</option>
                          <option value="Science (PCB)">Science (Physics, Chemistry, Biology)</option>
                          <option value="Commerce">Commerce / Business Studies</option>
                          <option value="Humanities / Arts">Humanities & Creative Arts</option>
                          <option value="General academic">General Academy/Mixed</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Target className="text-amber-500" size={20} /> Priorities & Milestones
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Specify focus parameters so the algorithm gives extra coverage to priority topics.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Weak Subjects */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          Weak Subjects <span className="text-[10px] text-zinc-400 font-normal">(Needs Extra Focus)</span>
                        </label>
                        <input 
                          type="text"
                          value={weakSubjects}
                          onChange={(e) => setWeakSubjects(e.target.value)}
                          placeholder="e.g. Physics Equations, Integration"
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 placeholder:text-zinc-400 font-semibold"
                        />
                      </div>

                      {/* Strong Subjects */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          Strong Subjects <span className="text-[10px] text-zinc-400 font-normal">(Speed Revision)</span>
                        </label>
                        <input 
                          type="text"
                          value={strongSubjects}
                          onChange={(e) => setStrongSubjects(e.target.value)}
                          placeholder="e.g. Organic Chemistry, English Literature"
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 placeholder:text-zinc-400 font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Exam Milestone Dates */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Exam Milestone or Target Date</label>
                        <input 
                          type="date"
                          value={examDates}
                          onChange={(e) => setExamDates(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-850 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 font-bold"
                        />
                      </div>

                      {/* Target Goal Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Primary Academic Goal</label>
                        <select
                          value={goals}
                          onChange={(e) => setGoals(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 font-bold"
                        >
                          <option value="">Select Primary Goal</option>
                          <option value="Improve Weak Subject understanding">Improve Core concepts & understanding</option>
                          <option value="Exam score maximization & retrieval practice">Maximize Exam scores (Spaced retrieval)</option>
                          <option value="Syllabus coverage & time management">Complete syllabus backlog & manage time</option>
                          <option value="Regular revision & daily habit completion">Establish study habits & daily routines</option>
                          <option value="Stress reduction and mental stability">Reduce stress & balance study blocks</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="text-amber-500" size={20} /> Workload & Style
                      </h2>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">Configure study volume limits and your custom learning profile rules.</p>
                    </div>

                    <div className="space-y-6">
                      {/* Slider option */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          Daily Available Study Hours
                        </label>
                        <input 
                          type="range"
                          min="1"
                          max="12"
                          step="0.5"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg appearance-none"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                          <span>1 Hour</span>
                          <span className="text-amber-600 dark:text-amber-400 font-extrabold">{hours} Hours</span>
                          <span>12 Hours</span>
                        </div>
                      </div>

                      {/* Preferences textarea */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          Learning Style/Preferences
                        </label>
                        <textarea 
                          value={preferences}
                          onChange={(e) => setPreferences(e.target.value)}
                          placeholder="e.g. Spaced revision, deep focus blocks, morning learner, pomodoro breaks..."
                          className="w-full bg-zinc-50 dark:bg-zinc-850/50 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 h-24 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all resize-none placeholder:text-zinc-400 text-xs md:text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-zinc-800 gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(prev => Math.max(1, prev - 1))}
                  disabled={step === 1}
                  className="px-6 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-extrabold uppercase tracking-widest text-zinc-650 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => subjects.length > 0 && setStep(prev => Math.min(4, prev + 1))}
                    disabled={subjects.length === 0}
                    className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-extrabold uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next Step <ChevronRight size={14} />
                  </button>
                ) : (
                  <button 
                    onClick={generateTimetable}
                    disabled={subjects.length === 0 || isLoading}
                    className="flex-1 sm:flex-initial px-8 py-3.5 bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-700 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-650 text-white font-extrabold uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Creating Your Timetable...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Generate {durationOptions[durationCategory].label}
                      </>
                    )}
                  </button>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-2xl border border-red-500/20 mt-4">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right Column preview panel (Bento style) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl p-6 sm:p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center space-y-4 h-full min-h-[300px]">
              <div className="w-14 h-14 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center shadow-sm text-zinc-400 dark:text-zinc-650 shrink-0">
                <Target size={28} className="text-amber-500/80" />
              </div>
              <h3 className="text-sm font-black text-zinc-500 dark:text-zinc-450 uppercase tracking-widest">Active Workspace</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 max-w-xs leading-relaxed">
                Add your current subject list and pick a custom schedule duration format. 
                Our agent will apply spaced learning and retrieval blocks.
              </p>
              
              <div className="w-full space-y-2.5 pt-4">
                <div className="flex items-center gap-2.5 text-left text-xs bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl p-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                  <span className="text-zinc-500 truncate">Duration: <strong className="text-zinc-900 dark:text-white">{durationOptions[durationCategory].label}</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-left text-xs bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl p-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                  <span className="text-zinc-500 truncate">Academic Track: <strong className="text-zinc-900 dark:text-white">{stream || "General Subjects"}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          {/* Controls header bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-150 dark:border-zinc-800/85 pb-4 shrink-0">
            <button 
              onClick={() => setTimetable(null)}
              className="text-zinc-500 dark:text-zinc-450 hover:text-zinc-900 dark:hover:text-white font-extrabold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer self-start"
            >
              <X size={16} /> Start Over / Recalibrate
            </button>
            
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <button 
                onClick={saveTimetable}
                disabled={isSaving || isSaved}
                className={cn(
                  "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-extrabold uppercase text-[10px] tracking-widest transition-all shadow-md cursor-pointer disabled:cursor-not-allowed",
                  isSaved 
                    ? "bg-green-500 text-white shadow-green-150 dark:shadow-none" 
                    : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
                )}
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isSaved ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Save size={14} />
                )}
                {isSaving ? 'Encrypting...' : isSaved ? 'Saved to Vault' : 'Secure Save'}
              </button>
              
              <button 
                onClick={handlePrint}
                className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-650 dark:text-zinc-300 cursor-pointer"
                title="Print Timetable"
              >
                <Printer size={18} />
              </button>
            </div>
          </div>

          {/* Student Profile Metadata Overview */}
          <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 rounded-2xl flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
            <div><strong>Syllabus Focus:</strong> {subjects.join(', ')}</div>
            {studentClass && <div><strong>Class:</strong> {studentClass}</div>}
            {board && <div><strong>Board:</strong> {board}</div>}
            {stream && <div><strong>Stream:</strong> {stream}</div>}
            {durationCategory && <div><strong>Duration:</strong> {durationOptions[durationCategory].label} ({durationValue.replace('_', ' ')})</div>}
            {weakSubjects && <div><strong>Priority weakness study blocks:</strong> {weakSubjects}</div>}
          </div>

          {/* Schedule Dynamic Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {Object.entries(timetable as TimetableData).map(([dayKey, items]) => (
              <div key={dayKey} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-150 dark:border-zinc-800/80 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800/50 pb-3 flex items-center justify-between uppercase tracking-wider">
                  {dayKey}
                  <span className="text-[9px] font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2.5 py-1 rounded-full">
                    {Array.isArray(items) ? (items as TimetableItem[]).length : 0} Blocks
                  </span>
                </h3>
                <div className="space-y-2.5">
                  {Array.isArray(items) ? (items as TimetableItem[]).map((item, i) => (
                    <div 
                      key={i} 
                      className="p-3.5 bg-zinc-50/70 dark:bg-zinc-850/40 border border-zinc-100 dark:border-zinc-800/20 rounded-2xl space-y-1.5 group hover:bg-amber-500/10 dark:hover:bg-zinc-800 transition-colors cursor-default"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-widest">{item.time}</span>
                        <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 truncate max-w-[110px]">{item.subject}</span>
                      </div>
                      <div className="font-bold text-xs text-zinc-900 dark:text-zinc-200 group-hover:text-amber-900 dark:group-hover:text-amber-300">
                        {item.activity}
                      </div>
                    </div>
                  )) : (
                    <div className="text-xs text-zinc-400 italic">No schedules compiled.</div>
                  )}
                  {(!Array.isArray(items) || (items as TimetableItem[]).length === 0) && (
                    <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500 italic">No scheduled activities.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
