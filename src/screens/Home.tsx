/**
 * Home — the student's starting point.
 *
 * Deliberately NOT an analytics dashboard. It answers three questions fast:
 *   1. What was I doing?  -> Continue learning
 *   2. What can I do now?  -> Create notes / Ask the tutor
 *   3. What is due?       -> Today's plan + upcoming exams
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, Calendar, Sparkles, ArrowRight,
  CheckCircle2, Clock, GraduationCap, Link2, Upload, Type, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudentProfile, getAllMastery, daysUntilExam } from '../lib/study';
import { loadPlannerTasks, dueLabel, dueBucket, sortTasks, getUpcomingMilestone } from '../lib/planner';
import OnboardingFlow from '../components/OnboardingFlow';
import { cn } from '../lib/utils';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const firstName = (name?: string | null) => (name || 'there').trim().split(/\s+/)[0];

export default function Home() {
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const { profile, loading } = useStudentProfile();

  const mastery = useMemo(() => getAllMastery(uid), [uid, profile]);
  const tasks = useMemo(() => loadPlannerTasks(), [profile]);

  const resume = profile?.currentContext ?? null;
  const todayTasks = tasks.filter((t) => !t.completed && dueBucket(t) === 'today');
  const overdueCount = tasks.filter((t) => !t.completed && dueBucket(t) === 'overdue').length;
  const nextTask = sortTasks(tasks.filter((t) => !t.completed))[0] ?? null;
  const milestone = getUpcomingMilestone(tasks);
  const exams = (profile?.exams ?? [])
    .filter((e) => daysUntilExam(e.date) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 2);

  const weakest = mastery.find((m) => m.status === 'needs-practice') ?? null;
  const weakCount = mastery.filter((m) => m.status === 'needs-practice').length;
  const hasStarted = resume !== null || mastery.length > 0 || tasks.length > 0;
  const practiceHref =
    weakest && weakCount > 0
      ? `/app/practice?subject=${weakest.subjectId}&topic=${weakest.topicId}`
      : '/app/practice';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 sm:pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
          {greeting()}, {firstName(user?.displayName)}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Learn it, note it, practise it, plan it.
        </p>
      </header>

      {/* ── Continue learning ─────────────────────────────────────────── */}
      {resume && (
        <Link
          to={`/app/study/${resume.subjectId}/${resume.topicId}`}
          className="mb-5 block rounded-2xl border border-blue-200 bg-blue-50 p-4 transition-colors active:scale-[0.99] dark:border-blue-900/60 dark:bg-blue-950/25"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Continue learning
          </p>
          <p className="mt-1 text-base font-black text-zinc-900 dark:text-white">{resume.topic}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{resume.subject}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400">
            Pick up where you left off <ArrowRight size={14} />
          </span>
        </Link>
      )}

      {/* ── Core actions ──────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/app/notes"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 transition-colors active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center gap-2">
            <FileText size={17} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-black text-zinc-900 dark:text-white">Create notes</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Turn a YouTube video, an article, a photo or your own text into short revision
            notes.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              { icon: Link2, label: 'Link' },
              { icon: Upload, label: 'File' },
              { icon: Type, label: 'Text' },
            ].map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <chip.icon size={11} /> {chip.label}
              </span>
            ))}
          </div>
        </Link>

        <Link
          to="/app/ai-assistant"
          className="group rounded-2xl border border-zinc-200 bg-white p-4 transition-colors active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-black text-zinc-900 dark:text-white">Ask the AI tutor</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Stuck on a concept? Get a clear explanation and a quick check on what you
            understood.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400">
            Start a question <ArrowRight size={13} />
          </span>
        </Link>
      </section>

      {/* ── Today's plan ──────────────────────────────────────────────── */}
      <section className="mt-6">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
            <Calendar size={16} className="text-zinc-400" /> Today&apos;s plan
          </h2>
          <Link
            to="/app/planner"
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400"
          >
            Plan <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No tasks yet. Add what you need to finish today.
            </p>
            <Link
              to="/app/planner"
              className="mt-3 inline-flex min-h-[40px] items-center rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
            >
              Add a task
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {overdueCount > 0 && (
              <li className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                <Clock size={14} /> {overdueCount} overdue {overdueCount === 1 ? 'task' : 'tasks'} —
                clear these first.
              </li>
            )}
            {(todayTasks.length ? todayTasks : nextTask ? [nextTask] : [])
              .slice(0, 3)
              .map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {task.subject} · {dueLabel(task)}
                    </p>
                  </div>
                  {task.type === 'exam' ? (
                    <GraduationCap size={16} className="shrink-0 text-rose-500" />
                  ) : (
                    <CheckCircle2 size={16} className="shrink-0 text-zinc-300 dark:text-zinc-700" />
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* ── Exams ─────────────────────────────────────────────────────── */}
      {(exams.length > 0 || milestone) && (
        <section className="mt-6">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
            <GraduationCap size={16} className="text-zinc-400" /> Coming up
          </h2>
          <ul className="space-y-2">
            {exams.map((exam) => {
              const days = daysUntilExam(exam.date);
              return (
                <li
                  key={exam.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {exam.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(exam.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                      days <= 3
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                        : days <= 10
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                    )}
                  >
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                  </span>
                </li>
              );
            })}
            {!exams.length && milestone && (
              <li className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {milestone.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {milestone.subject} · {dueLabel(milestone)}
                  </p>
                </div>
                <GraduationCap size={16} className="shrink-0 text-rose-500" />
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ── Keep practising ───────────────────────────────────────────── */}
      {hasStarted && (
        <section className="mt-6">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
            <ClipboardCheck size={16} className="text-zinc-400" /> Keep practising
          </h2>
          <Link
            to={practiceHref}
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {weakCount > 0
                  ? `${weakCount} ${weakCount === 1 ? 'topic needs' : 'topics need'} another round`
                  : 'Take a quick quiz'}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Short question sets that show you exactly what to revise.
              </p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-zinc-400" />
          </Link>
        </section>
      )}

      {/* ── First-run nudge ───────────────────────────────────────────── */}
      {!hasStarted && !loading && (
        <section className="mt-6">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
            <BookOpen size={16} className="text-zinc-400" /> Start here
          </h2>
          <Link
            to="/app/learn"
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Pick a subject
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Choose a topic, learn it, then turn it into short notes.
              </p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-zinc-400" />
          </Link>
        </section>
      )}

      {/* First-run setup: subjects, goal, and what they want help with. */}
      <OnboardingFlow />
    </div>
  );
}
