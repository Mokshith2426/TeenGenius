import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon, Plus, Trash2, Check, Flag, Clock3,
  GraduationCap, BookOpen, PencilLine, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import {
  type PlannerTask,
  type PlannerTaskType,
  type PlannerPriority,
  SUBJECT_OPTIONS,
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  todayStr,
  loadPlannerTasks,
  savePlannerTasks,
  subscribePlannerUpdates,
  dueBucket,
  dueLabel,
  sortTasks,
  loadPlannerFromFirestore,
  savePlannerToFirestore,
} from '../lib/planner';
import { SUBJECT_CATALOG } from '../lib/study';

/** Map a planner subject name to the study catalog (for Learn links). */
const studySubjectFor = (name: string) =>
  SUBJECT_CATALOG.find((s) => s.name.toLowerCase() === (name || '').trim().toLowerCase());

const TASK_TYPE_ICONS: Record<PlannerTaskType, typeof BookOpen> = {
  homework: BookOpen,
  assignment: PencilLine,
  exam: GraduationCap,
  study: BookOpen,
};

type FilterKey = 'all' | 'today' | 'upcoming' | 'overdue' | 'done';

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'done', label: 'Done' },
];

function FilterTab({ active, label, count, onClick }: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer border',
        active
          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
      )}
    >
      {label}
      <span className={cn(
        'rounded-full px-1.5 text-[10px] font-bold',
        active ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'
      )}>
        {count}
      </span>
    </button>
  );
}
export default function PlannerHub() {
  const { user, isGuest } = useAuth();
  const isSyncedUser = !isGuest && !!user;
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<PlannerTask[]>(loadPlannerTasks);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string>('Other');
  const [type, setType] = useState<PlannerTaskType>('homework');
  const [dueDate, setDueDate] = useState(todayStr());
  const [priority, setPriority] = useState<PlannerPriority>('medium');
  const hasInteractedRef = useRef(false);

  // Keep this screen in sync with changes made elsewhere (e.g. Home)
  useEffect(() => {
    const unsubscribe = subscribePlannerUpdates(() => setTasks(loadPlannerTasks()));
    return unsubscribe;
  }, []);

  // One-time Firestore hydration: only adopt remote tasks when local storage is empty
  useEffect(() => {
    if (!isSyncedUser || !user) return;
    let cancelled = false;
    loadPlannerFromFirestore(user.uid).then((remote) => {
      if (cancelled || !remote || remote.length === 0) return;
      setTasks((prev) => {
        if (prev.length > 0) return prev;
        savePlannerTasks(remote);
        return remote;
      });
    });
    return () => { cancelled = true; };
  }, [user?.uid, isSyncedUser]);

  // Debounced Firestore sync of local changes (after the user actually acts)
  useEffect(() => {
    if (!isSyncedUser || !user || !hasInteractedRef.current) return;
    const t = setTimeout(() => {
      savePlannerToFirestore(user.uid, tasks);
    }, 350);
    return () => clearTimeout(t);
  }, [tasks, isSyncedUser, user?.uid]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    hasInteractedRef.current = true;
    const task: PlannerTask = {
      id: 'task_' + Date.now(),
      title: title.trim(),
      subject,
      type,
      dueDate: dueDate || '',
      priority,
      completed: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    setTitle('');
    setDueDate(todayStr());
  };

  const toggleTask = (id: string) => {
    hasInteractedRef.current = true;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: string) => {
    hasInteractedRef.current = true;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const clearAll = () => {
    hasInteractedRef.current = true;
    setTasks([]);
  };

  const doneCount = tasks.filter((t) => t.completed).length;
  const progress = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const overdueCount = tasks.filter((t) => !t.completed && dueBucket(t) === 'overdue').length;

  const visible = sortTasks(tasks).filter((t) => {
    if (filter === 'done') return t.completed;
    if (t.completed) return filter === 'all';
    if (filter === 'today') return dueBucket(t) === 'today';
    if (filter === 'upcoming') return dueBucket(t) === 'upcoming';
    if (filter === 'overdue') return dueBucket(t) === 'overdue';
    return true; // 'all'
  });
return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-7 md:px-9 pb-36 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="pt-3">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
          Study Planner
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Homework, assignments, exams and study sessions — with due dates and priorities.
        </p>
        {overdueCount > 0 && (
          <button
            onClick={() => setFilter('overdue')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs font-bold cursor-pointer"
          >
            <Clock3 size={13} /> {overdueCount} overdue — catch up
          </button>
        )}
      </div>

      {/* New task card */}
      <form
        onSubmit={addTask}
        className="rounded-3xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Sparkles size={15} className="text-indigo-500" />
            Add a task
          </h2>
          <span className="text-xs text-zinc-400 font-medium">
            {tasks.length === 0 ? 'Start with one item' : `${doneCount}/${tasks.length} done`}
          </span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Maths chapter 4 homework"
          className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-3.5 text-sm font-medium text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500/30 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Subject</span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50 outline-none"
            >
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50 outline-none"
            />
          </label>
        </div>

        {/* Task type segmented control */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(TASK_TYPE_LABELS) as PlannerTaskType[]).map((t) => {
            const Icon = TASK_TYPE_ICONS[t];
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold transition-all cursor-pointer',
                  active
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                )}
              >
                <Icon size={15} />
                <span className="text-[10px] leading-none">{TASK_TYPE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>

        {/* Priority pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mr-1">Priority:</span>
          {(Object.keys(PRIORITY_LABELS) as PlannerPriority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer border',
                priority === p
                  ? p === 'high'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : p === 'medium'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              )}
            >
              <Flag size={12} className="mr-1 inline -mt-0.5" />
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!title.trim()}
          className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-blue-600/10"
        >
          <Plus size={16} className="mr-1.5 inline -mt-0.5" />
          Add to planner
        </button>
      </form>
{/* Progress + filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span>Progress</span>
              <span>{doneCount} of {tasks.length} done</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={clearAll}
            disabled={tasks.length === 0}
            className="text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
            title="Clear all tasks"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {FILTER_OPTIONS.map((o) => {
            let count = 0;
            if (o.key === 'all') count = tasks.length;
            else if (o.key === 'done') count = doneCount;
            else count = tasks.filter((t) => !t.completed && dueBucket(t) === o.key).length;
            return (
              <FilterTab
                key={o.key}
                active={filter === o.key}
                label={o.label}
                count={count}
                onClick={() => setFilter(o.key)}
              />
            );
          })}
        </div>
      </div>
{/* Task list */}
      <div className="space-y-2.5">
        {tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 dark:bg-zinc-800 flex items-center justify-center">
              <CalendarIcon size={20} className="text-blue-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Your planner is empty</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Add a homework, assignment, exam or study session above. It will show up here and on your Home screen.
              </p>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 p-8 text-center space-y-1">
            <span className="text-xl">🎉</span>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Nothing in this filter right now.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visible.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors',
                  t.completed
                    ? 'bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-150 dark:border-zinc-800 opacity-75'
                    : 'bg-white dark:bg-zinc-800/60 border-zinc-150 dark:border-zinc-800'
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.completed ? 'Mark as not done' : 'Mark as done'}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer',
                    t.completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-400'
                  )}
                >
                  {t.completed && <Check size={13} strokeWidth={3} />}
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className={cn(
                    'text-sm font-semibold leading-snug truncate',
                    t.completed ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-900 dark:text-zinc-100'
                  )}>
                    {t.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {t.subject}
                    </span>
                    <span className={cn(
                      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                      t.type === 'exam'
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        : t.type === 'homework'
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                          : t.type === 'assignment'
                            ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                    )}>
                      {TASK_TYPE_LABELS[t.type]}
                    </span>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                      dueBucket(t) === 'overdue'
                        ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                        : dueBucket(t) === 'today'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                    )}>
                      <Clock3 size={11} />
                      {dueLabel(t)}
                    </span>
                    {!t.completed && studySubjectFor(t.subject) && (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/study/${studySubjectFor(t.subject)!.id}`)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                      >
                        <BookOpen size={11} />
                        Learn
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      t.priority === 'high' ? 'bg-rose-500' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
                    )}
                    title={`${PRIORITY_LABELS[t.priority]} priority`}
                  />
                  <button
                    type="button"
                    onClick={() => deleteTask(t.id)}
                    aria-label="Delete task"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}