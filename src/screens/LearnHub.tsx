import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, BookOpen, Calculator, FlaskConical, Leaf, Globe2, Code2, TrendingUp,
  Languages, Landmark, ChevronRight, Play, Zap, GraduationCap, Target,
  CheckCircle2, Clock, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useStudentCatalog, useStudentProfile, getSubjectDef, getTopicDefForSubject,
  getMasteryForTopic, getMasteryRationale, getAllMastery, setCurrentLearningContext,
  saveStudySession, TEACHING_MODES, SubjectDef, TopicDef, TopicMastery, StudyMode,
} from '../lib/study';
import { cn } from '../lib/utils';

// ─── Shared visual helpers ──────────────────────────────────────────────────
const ICONS: Record<string, any> = { Calculator, FlaskConical, Leaf, Globe2, Code2, TrendingUp, Languages, Landmark };
const subjectIcon = (icon?: string) => ICONS[icon ?? ''] ?? BookOpen;

const ICON_STYLES: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500',
  rose: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400',
  sky: 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400',
};
const iconStyleFor = (color?: string) => ICON_STYLES[color ?? ''] ?? ICON_STYLES.blue;

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  strong: { label: 'Strong', cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' },
  developing: { label: 'Developing', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500' },
  'needs-practice': { label: 'Needs practice', cls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' },
};

function MasteryChip({ mastery }: { mastery?: TopicMastery | null }) {
  if (!mastery) {
    return <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Not started</span>;
  }
  const s = STATUS_STYLES[mastery.status] ?? STATUS_STYLES.developing;
  return (
    <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full', s.cls)}>
      {s.label} · {Math.round(mastery.accuracy * 100)}%
    </span>
  );
}

// ─── View A: subject picker ─────────────────────────────────────────────────
function SubjectPickerView() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const { subjects, profile, loading } = useStudentCatalog();
  const [mastery, setMastery] = useState<TopicMastery[]>([]);

  useEffect(() => { setMastery(getAllMastery(uid)); }, [uid]);

  const bySubject = useMemo(() => {
    const acc: Record<string, { total: number; sum: number }> = {};
    for (const m of mastery) {
      const e = acc[m.subjectId] ?? (acc[m.subjectId] = { total: 0, sum: 0 });
      e.total += 1; e.sum += m.accuracy;
    }
    return acc;
  }, [mastery]);

  const ctx = profile?.currentContext ?? null;

  if (loading) {
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-3 animate-fade-in">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-3xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6 pb-32 animate-fade-in">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Learn</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
          {profile?.startedTopics?.length ? 'Pick up where you left off, or start something new.' : 'Pick a subject and start your first study session.'}
        </p>
      </div>

      {ctx && (
        <motion.button whileTap={{ scale: 0.99 }} onClick={() => navigate(`/app/study/${ctx.subjectId}/${ctx.topicId}`)}
          className="w-full text-left bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-5 flex items-center gap-4 shadow-lg shadow-blue-600/15 cursor-pointer">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Play size={18} className="ml-0.5" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Continue learning</p>
            <p className="text-base font-bold truncate">{ctx.topic}</p>
            <p className="text-xs text-blue-100 truncate">{ctx.subject}</p>
          </div>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </motion.button>
      )}

      <div className="space-y-3">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Your subjects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subjects.map((s) => {
            const Icon = subjectIcon(s.icon);
            const prog = bySubject[s.id];
            const subtitle = prog ? `${Math.round((prog.sum / prog.total) * 100)}% avg accuracy · ${prog.total} attempted` : s.description;
            return (
              <motion.button key={s.id} whileTap={{ scale: 0.985 }} onClick={() => navigate(`/app/study/${s.id}`)}
                className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-4 flex items-center gap-4 text-left cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
                <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', iconStyleFor(s.color))}><Icon size={19} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">{subtitle}</p>
                </div>
                <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── View B: topic list for a subject ───────────────────────────────────────
function TopicListView({ subjectId }: { subjectId: string }) {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const { profile } = useStudentProfile();
  const subjectDef: SubjectDef | undefined = getSubjectDef(subjectId);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  useEffect(() => { setMastery(getAllMastery(uid)); }, [uid]);

  if (!subjectDef) {
    return (
      <div className="p-4 max-w-2xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <BookOpen size={28} className="mx-auto text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm text-zinc-500 font-medium">We couldn't find that subject.</p>
        <button onClick={() => navigate('/app/learn')} className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer">Back to Learn</button>
      </div>
    );
  }
  const Icon = subjectIcon(subjectDef.icon);
  const started = profile?.startedTopics ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5 pb-32 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/learn')} aria-label="Back" className="p-2 -ml-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"><ArrowLeft size={18} /></button>
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', iconStyleFor(subjectDef.color))}><Icon size={18} /></div>
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white truncate">{subjectDef.name}</h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{subjectDef.topics.length} topics</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {subjectDef.topics.map((t) => {
          const m = mastery.find((x) => x.topicId === t.id);
          const isStarted = started.includes(t.id);
          return (
            <motion.button key={t.id} whileTap={{ scale: 0.99 }} onClick={() => navigate(`/app/study/${subjectId}/${t.id}`)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 text-left cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white">{t.name}</p>
                  <MasteryChip mastery={m} />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium line-clamp-2">{t.description}</p>
                {isStarted && !m && (
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"><Clock size={11} /> In progress</p>
                )}
              </div>
              <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── View C: topic detail + teaching modes ──────────────────────────────────
function TopicDetailView({ subjectId, topicId }: { subjectId: string; topicId: string }) {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const subjectDef = getSubjectDef(subjectId);
  const topicDef: TopicDef | undefined = getTopicDefForSubject(subjectId, topicId);
  const [mode, setMode] = useState<StudyMode>('quick');
  const [mastery, setMastery] = useState<TopicMastery | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => { setMastery(getMasteryForTopic(uid, topicId)); }, [uid, topicId]);

  if (!topicDef || !subjectDef) {
    return (
      <div className="p-4 max-w-2xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <BookOpen size={28} className="mx-auto text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm text-zinc-500 font-medium">We couldn't find that topic.</p>
        <button onClick={() => navigate('/app/learn')} className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer">Back to Learn</button>
      </div>
    );
  }

  const rationale = mastery ? getMasteryRationale(uid, topicId) : 'No practice yet — learn the concept first, then try a quick quiz.';

  const startLearning = async () => {
    setStarting(true);
    try {
      await setCurrentLearningContext(uid, subjectId, topicId);
      await saveStudySession(uid, {
        subjectId, subject: subjectDef.name, topicId, topic: topicDef.name,
        mode, minutes: topicDef.quickLearnMins ?? 15, completed: false,
        createdAt: new Date().toISOString(),
      });
      const prompts: Record<StudyMode, string> = {
        quick: `Teach me "${topicDef.name}" (${subjectDef.name}) quickly: 1) explain it simply, 2) one clear example, 3) one quick check question.`,
        deep: `Teach me "${topicDef.name}" (${subjectDef.name}) in depth: break it into small sections — the concept, why it matters, a step-by-step explanation, a worked example, and common mistakes. End with a quick understanding check.`,
        exam: `I'm preparing for an exam. Teach me "${topicDef.name}" (${subjectDef.name}) focused on what's most likely to be tested: key points, typical exam questions, and how to avoid common mistakes.`,
        teach: `Teach me "${topicDef.name}" (${subjectDef.name}) interactively: explain one small piece at a time, then check my understanding with a question before moving on.`,
      };
      navigate('/app/ai-assistant', { state: { initialPrompt: prompts[mode] } });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 pb-32 animate-fade-in">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(`/app/study/${subjectId}`)} aria-label="Back" className="p-2 -ml-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"><ArrowLeft size={18} /></button>
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{topicDef.name}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{subjectDef.name} · ~{topicDef.quickLearnMins ?? 15} min</p>
        </div>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">{topicDef.description}</p>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Where you stand</p>
          <MasteryChip mastery={mastery} />
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">{rationale}</p>
      </div>

      <div className="space-y-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">How do you want to learn this?</p>
        <div className="grid grid-cols-2 gap-2.5">
          {TEACHING_MODES.map((m) => {
            const ModeIcon = m.id === 'quick' ? Zap : m.id === 'deep' ? BookOpen : m.id === 'exam' ? Target : GraduationCap;
            const active = mode === m.id;
            return (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={cn('rounded-2xl p-3.5 text-left border transition-colors cursor-pointer',
                  active ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700' : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-200 dark:hover:border-zinc-700')}>
                <ModeIcon size={16} className={active ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'} />
                <p className={cn('text-xs font-bold mt-2', active ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200')}>{m.label}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        <button onClick={startLearning} disabled={starting}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer">
          {starting ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
          {starting ? 'Starting…' : 'Start learning'}
        </button>
        <button onClick={() => navigate(`/app/practice?subject=${subjectId}&topic=${topicId}`)}
          className="w-full py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-black text-[11px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer hover:border-zinc-300">
          <CheckCircle2 size={15} className="text-blue-500" />
          Practice this topic
        </button>
      </div>
    </div>
  );
}

// ─── Route switch ───────────────────────────────────────────────────────────
export default function LearnHub() {
  const { subjectId, topicId } = useParams<{ subjectId?: string; topicId?: string }>();
  if (subjectId && topicId) return <TopicDetailView subjectId={subjectId} topicId={topicId} />;
  if (subjectId) return <TopicListView subjectId={subjectId} />;
  return <SubjectPickerView />;
}
