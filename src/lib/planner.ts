/**
 * Shared study planner task model for TeenGenius.
 *
 * Local-first (localStorage) with best-effort Firestore sync for signed-in
 * (non-guest) users. Storage key is shared with the legacy PlannerHub format
 * so existing entries survive the upgrade.
 */

export type PlannerTaskType = 'homework' | 'assignment' | 'exam' | 'study';
export type PlannerPriority = 'low' | 'medium' | 'high';

export interface PlannerTask {
  id: string;
  title: string;
  subject: string;
  type: PlannerTaskType;
  dueDate: string; // YYYY-MM-DD (empty string = no due date)
  priority: PlannerPriority;
  completed: boolean;
  createdAt: number;
}

export const PLANNER_STORAGE_KEY = 'tg_planner_hub_tasks';
export const PLANNER_UPDATE_EVENT = 'tg-planner-updated';

export const SUBJECT_OPTIONS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'English',
  'History',
  'Geography',
  'Economics',
  'General Science',
  'Other',
] as const;

export const TASK_TYPE_LABELS: Record<PlannerTaskType, string> = {
  homework: 'Homework',
  assignment: 'Assignment',
  exam: 'Exam',
  study: 'Study',
};

export const PRIORITY_LABELS: Record<PlannerPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function normalizeLegacyTask(raw: any): PlannerTask {
  return {
    id: raw?.id || `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(raw?.title || 'Untitled task'),
    subject: raw?.subject || 'Other',
    type: raw?.type && TASK_TYPE_LABELS[raw.type as PlannerTaskType]
      ? (raw.type as PlannerTaskType)
      : 'study',
    dueDate: (raw?.dueDate as string) || '',
    priority:
      raw?.priority && PRIORITY_LABELS[raw.priority as PlannerPriority]
        ? (raw.priority as PlannerPriority)
        : raw?.category === 'Critical'
          ? 'high'
          : raw?.category === 'Minor'
            ? 'low'
            : 'medium',
    completed: !!raw?.completed,
    createdAt: raw?.createdAt || Date.now(),
  };
}

export function loadPlannerTasks(): PlannerTask[] {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLegacyTask).filter((t) => t && typeof t.title === 'string');
  } catch (e) {
    console.warn('[Planner] Failed to load tasks:', e);
    return [];
  }
}

export function savePlannerTasks(tasks: PlannerTask[]): void {
  try {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('[Planner] Failed to save tasks locally:', e);
  }
  notifyPlannerUpdate();
}

/** Lets other tabs/screens (e.g. Home) refresh immediately after local changes. */
export function notifyPlannerUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent(PLANNER_UPDATE_EVENT));
  } catch (e) {
    // ignore
  }
}

/** Subscribes a listener to planner updates; returns an unsubscribe function. */
export function subscribePlannerUpdates(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === PLANNER_STORAGE_KEY) listener();
  };
  window.addEventListener(PLANNER_UPDATE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PLANNER_UPDATE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Days from today until dueDate (negative = past). Null when no due date. */
export function daysUntil(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  if (isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export type DueBucket = 'overdue' | 'today' | 'upcoming' | 'someday';

export function dueBucket(task: PlannerTask): DueBucket {
  const days = daysUntil(task.dueDate);
  if (task.completed) return 'someday';
  if (days === null) return 'someday';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return 'upcoming';
}

/** Human-friendly due label, e.g. "Today", "Tomorrow", "In 3 days", "4 days overdue". */
export function dueLabel(task: PlannerTask): string {
  const days = daysUntil(task.dueDate);
  if (days === null) return 'No due date';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days overdue`;
}
export function isOverdue(task: PlannerTask): boolean {
  return !task.completed && dueBucket(task) === 'overdue';
}

/** Sorted list with incomplete/urgent tasks first. */
export function sortTasks(tasks: PlannerTask[]): PlannerTask[] {
  const priorityRank: Record<PlannerPriority, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const aDays = daysUntil(a.dueDate);
    const bDays = daysUntil(b.dueDate);
    if (aDays !== null && bDays !== null && aDays !== bDays) return aDays - bDays;
    return priorityRank[a.priority] - priorityRank[b.priority];
  });
}

/** The single most urgent incomplete task (for Home). */
export function getTopTask(tasks: PlannerTask[]): PlannerTask | null {
  const sorted = sortTasks(tasks.filter((t) => !t.completed));
  return sorted[0] ?? null;
}

/** Next upcoming exam/assignment with a due date, for the Home "exam in N days" banner. */
export function getUpcomingMilestone(tasks: PlannerTask[]): PlannerTask | null {
  const sorted = sortTasks(
    tasks.filter(
      (t) =>
        !t.completed &&
        (t.type === 'exam' || t.type === 'assignment') &&
        dueBucket(t) !== 'overdue'
    )
  );
  return sorted[0] ?? null;
}

// ============================================================================
// FIRESTORE SYNC (best-effort, local-first)
// ============================================================================

const FIRESTORE_COLLECTION = 'plannerTasks';

export async function loadPlannerFromFirestore(uid: string): Promise<PlannerTask[] | null> {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const remote = Array.isArray(data.tasks) ? (data.tasks as any[]).map(normalizeLegacyTask) : [];
    return remote;
  } catch (e) {
    console.warn('[Planner] Firestore load skipped:', e);
    return null;
  }
}

export async function savePlannerToFirestore(uid: string, tasks: PlannerTask[]): Promise<void> {
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const sanitized = tasks.map((t) => ({
      id: t.id,
      title: String(t.title).slice(0, 300),
      subject: t.subject,
      type: t.type,
      dueDate: t.dueDate,
      priority: t.priority,
      completed: !!t.completed,
      createdAt: t.createdAt,
    }));
    await setDoc(doc(db, FIRESTORE_COLLECTION, uid), { tasks: sanitized }, { merge: true });
  } catch (e) {
    // Firestore may be unavailable offline; the planner still works locally.
    console.warn('[Planner] Firestore sync deferred:', e);
  }
}