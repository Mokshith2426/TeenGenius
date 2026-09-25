import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, CalendarDays, ChevronRight, Plus, Trash2, CheckCircle2,
  BookOpen, Target, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useStudentProfile, SUBJECT_CATALOG, saveExam, deleteExam, daysUntilExam,
  getAllMastery, ExamGoal, TopicMastery,
} from '../lib/study';
import { cn } from '../lib/utils';

const daysLabel = (d: number) => (d < 0 ? 'Passed' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`);
const daysChipCls = (d: number) =>
  d < 0 ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
    : d <= 3 ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
      : d <= 14 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500'
        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400';

/** Look up subject/topic names for a topic id (for practice/learn links). */
const topicInfo = (topicId: string) => {
  for (const s of SUBJECT_CATALOG) {
    const t = s.topics.find((x) => x.id === topicId);
    if (t) return { topicId, subjectId: s.id, subjectName: s.name, topicName: t.name };
  }
  return null;
};

// ─── Exam list + create ─────────────────────────────────────────────────────
function ExamList() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const { profile, loading } = useStudentProfile();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [localExams, setLocalExams] = useState<ExamGoal[] | null>(null);

  const exams = localExams ?? profile?.exams ?? [];
  const toggleSubject = (v: string) => setSubjectIds((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  const create = async () => {
    if (!name.trim() || subjectIds.length === 0) return;
    setSaving(true);
    try {
      const topicIds = SUBJECT_CATALOG.filter((s) => subjectIds.includes(s.id)).flatMap((s) => s.topics.map((t) => t.id));
      const created = await saveExam(uid, { name, date, subjectIds, topicIds });
      setLocalExams([...exams, created]);
      setShowCreate(false);
      setName('');
      setSubjectIds([]);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this exam?')) return;
    await deleteExam(uid, id);
    setLocalExams(exams.filter((e) => e.id !== id));
  };

  const coverage = (e: ExamGoal) => {
    const started = e.topicIds.filter((t) => profile?.startedTopics?.includes(t)).length;
    return { started, total: e.topicIds.length };
  };

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3 animate-fade-in">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 pb-32 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app')} aria-label="Back" className="p-2 -ml-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Exams</h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Focus your prep on what matters.</p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} aria-label="New exam"
          className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 cursor-pointer hover:bg-blue-500 transition-colors">
          {showCreate ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-4 space-y-3.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exam name — e.g. Science Final"
            className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-blue-400" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Date</p>
            <input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-blue-400 dark:[color-scheme:dark]" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Subjects in scope</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_CATALOG.map((s) => {
                const on = subjectIds.includes(s.id);
                return (
                  <button key={s.id} onClick={() => toggleSubject(s.id)}
                    className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer',
                      on ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' : 'border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-200 dark:hover:border-zinc-700')}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={create} disabled={!name.trim() || subjectIds.length === 0 || saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer">
            <CheckCircle2 size={14} /> {saving ? 'Saving…' : 'Create exam'}
          </button>
        </motion.div>
      )}

      {exams.length === 0 && !showCreate && (
        <div className="py-14 text-center space-y-2">
          <CalendarDays size={28} className="mx-auto text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No exams yet</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Create one to get a focused plan for what to study first.</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer">Create your first exam</button>
        </div>
      )}

      <div className="space-y-2.5">
        {[...exams].sort((a, b) => daysUntilExam(a.date) - daysUntilExam(b.date)).map((e) => {
          const d = daysUntilExam(e.date);
          const cov = coverage(e);
          return (
            <motion.button key={e.id} whileTap={{ scale: 0.99 }} onClick={() => navigate(`/app/exam/${e.id}`)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-3.5 text-left cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{e.name}</p>
                  <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full', daysChipCls(d))}>{daysLabel(d)}</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{e.date} · {cov.started}/{cov.total} topics studied</p>
              </div>
              <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Exam detail ────────────────────────────────────────────────────────────
function ExamDetail({ examId }: { examId: string }) {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const { profile, loading } = useStudentProfile();
  const mastery: TopicMastery[] = getAllMastery(uid);

  const exam = profile?.exams?.find((e) => e.id === examId) ?? null;

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3 animate-fade-in">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />)}
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-4 max-w-2xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <CalendarDays size={28} className="mx-auto text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm text-zinc-500 font-medium">We couldn't find that exam.</p>
        <button onClick={() => navigate('/app/exam')} className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer">Back to Exams</button>
      </div>
    );
  }

  const d = daysUntilExam(exam.date);
  const started = exam.topicIds.filter((t) => profile?.startedTopics?.includes(t));
  const weak = mastery.filter((m) => exam.topicIds.includes(m.topicId) && m.status === 'needs-practice');
  const unstarted = exam.topicIds
    .filter((t) => !started.includes(t) && !weak.some((w) => w.topicId === t))
    .map(topicInfo)
    .filter((x): x is NonNullable<ReturnType<typeof topicInfo>> => !!x);
  const pct = exam.topicIds.length ? Math.round((started.length / exam.topicIds.length) * 100) : 0;
  const weakRec = weak[0] ?? null;
  const weakRecInfo = weakRec ? topicInfo(weakRec.topicId) : null;
  const nextLearn = unstarted[0] ?? null;
  const scopeNames = exam.subjectIds.map((id) => SUBJECT_CATALOG.find((s) => s.id === id)?.name).filter(Boolean).join(', ');

  const removeExam = async () => {
    if (!window.confirm('Delete this exam?')) return;
    await deleteExam(uid, exam.id);
    navigate('/app/exam');
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 pb-32 animate-fade-in">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/app/exam')} aria-label="Back" className="p-2 -ml-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0 space-y-1">
          <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{exam.name}</h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">{scopeNames || 'Custom scope'} · {exam.date}</p>
        </div>
        <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0', daysChipCls(d))}>{daysLabel(d)}</span>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Topics studied</p>
          <p className="text-xs font-black text-zinc-700 dark:text-zinc-200">{started.length}/{exam.topicIds.length} · {pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-3xl p-4 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Target size={17} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Today's focus</p>
          <p className="text-sm font-bold truncate">
            {weakRec ? `Practice ${weakRecInfo?.topicName ?? 'weak topic'}` : nextLearn ? `Learn ${nextLearn.topicName}` : "You're on track"}
          </p>
          <p className="text-[11px] text-blue-100 font-medium truncate">
            {weakRec ? `${Math.round(weakRec.accuracy * 100)}% accuracy so far — worth another round.` : nextLearn ? `Not started yet — ${nextLearn.subjectName}.` : 'Keep practicing to stay sharp.'}
          </p>
        </div>
        {weakRec ? (
          <button onClick={() => navigate(`/app/practice?subject=${weakRec.subjectId}&topic=${weakRec.topicId}`)}
            className="px-3.5 py-2 bg-white text-blue-700 font-black text-[10px] uppercase tracking-widest rounded-xl shrink-0 cursor-pointer active:scale-95 transition-transform">Go</button>
        ) : nextLearn ? (
          <button onClick={() => navigate(`/app/study/${nextLearn.subjectId}/${nextLearn.topicId}`)}
            className="px-3.5 py-2 bg-white text-blue-700 font-black text-[10px] uppercase tracking-widest rounded-xl shrink-0 cursor-pointer active:scale-95 transition-transform">Go</button>
        ) : null}
      </div>
      {weak.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Needs practice ({weak.length})</p>
          {weak.slice(0, 4).map((w) => {
            const info = topicInfo(w.topicId);
            return (
              <button key={w.topicId} onClick={() => info && navigate(`/app/practice?subject=${info.subjectId}&topic=${w.topicId}`)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:border-rose-300 dark:hover:border-rose-800 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{info?.topicName ?? w.topic}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{info?.subjectName} · {Math.round(w.accuracy * 100)}% accuracy</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 shrink-0">Practice</span>
              </button>
            );
          })}
          {weak.length > 4 && <p className="text-[11px] text-zinc-400 font-medium">+{weak.length - 4} more — start with these first.</p>}
        </div>
      )}

      {unstarted.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Not started yet ({unstarted.length})</p>
          {unstarted.slice(0, 4).map((u) => (
            <button key={u.topicId} onClick={() => navigate(`/app/study/${u.subjectId}/${u.topicId}`)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3 text-left cursor-pointer hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{u.topicName}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{u.subjectName}</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 shrink-0 flex items-center gap-1"><BookOpen size={11} /> Learn</span>
            </button>
          ))}
          {unstarted.length > 4 && <p className="text-[11px] text-zinc-400 font-medium">+{unstarted.length - 4} more to cover.</p>}
        </div>
      )}

      <button onClick={removeExam} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-rose-500 cursor-pointer flex items-center gap-1.5 mx-auto pt-2">
        <Trash2 size={12} /> Delete exam
      </button>
    </div>
  );
}

export default function ExamPrep() {
  const { examId } = useParams<{ examId?: string }>();
  if (examId) return <ExamDetail examId={examId} />;
  return <ExamList />;
}