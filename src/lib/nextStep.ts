import { toDate } from './dateUtils';

export type NextStepType =
  | 'continue_session'
  | 'overdue_task'
  | 'today_task'
  | 'exam_prep'
  | 'continue_topic'
  | 'create_goal';

export interface NextStep {
  type: NextStepType;
  title: string;
  subtitle?: string;
  subject?: string;
  topic?: string;
  duration?: number;
  reason?: string;
  route: string;
  action: string;
  secondaryRoute?: string;
  secondaryAction?: string;
}

export interface TaskSource {
  id: string;
  text: string;
  completed: boolean;
  source: 'local' | 'group' | 'calendar';
  groupId?: string;
  groupName?: string;
  dueDate?: string;
  priority?: string;
  date?: string;
}

export interface SessionRecord {
  id: string;
  startTime: Date;
  duration: number;
  type?: string;
}

export interface CalendarNode {
  id: string;
  title: string;
  type: 'task' | 'plan' | 'completed';
  date: string;
}

export interface PausedTimer {
  remainMs: number;
  mode: string;
}

export interface HomeData {
  recentSessions: SessionRecord[];
  todayMinutes: number;
  tasks: TaskSource[];
  calendarNodes: CalendarNode[];
  pausedTimer: PausedTimer | null;
  notesCount: number;
  circlesCount: number;
}

function getTodayYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

export type DueStatus = 'overdue' | 'today' | 'upcoming' | 'none';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0, urgent: 0, high: 1, medium: 2, low: 3,
};

function normalizePriority(p?: string): number {
  return PRIORITY_ORDER[p?.toLowerCase() || 'medium'] ?? 2;
}

function parseDueDate(dueDate: string): Date | null {
  if (!dueDate) return null;
  const lower = dueDate.toLowerCase();

  if (lower.includes('today')) {
    const hourMatch = dueDate.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (hourMatch) {
      let hour = parseInt(hourMatch[1], 10);
      const min = parseInt(hourMatch[2], 10);
      const ampm = hourMatch[3].toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      const d = new Date();
      d.setHours(hour, min, 0, 0);
      return d;
    }
    return new Date();
  }

  if (lower.includes('tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }

  if (lower.includes('yesterday')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }

  const parsed = new Date(dueDate);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getDueStatus(dueDate?: string): DueStatus {
  if (!dueDate) return 'none';

  const lower = dueDate.toLowerCase();

  if (lower.includes('today')) {
    const parsed = parseDueDate(dueDate);
    if (parsed && parsed < new Date()) return 'overdue';
    return 'today';
  }

  if (lower.includes('yesterday')) return 'overdue';

  if (lower.includes('tomorrow')) return 'upcoming';

  const parsed = parseDueDate(dueDate);
  if (!parsed) return 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(parsed);
  taskDate.setHours(0, 0, 0, 0);

  if (taskDate < today) return 'overdue';
  if (taskDate.getTime() === today.getTime()) return 'today';

  const daysDiff = Math.round((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff <= 14) return 'upcoming';
  return 'none';
}

export function getDaysUntil(dueDate?: string): number {
  if (!dueDate) return 999;
  const lower = dueDate.toLowerCase();
  if (lower.includes('today')) return 0;
  if (lower.includes('tomorrow')) return 1;

  const parsed = parseDueDate(dueDate);
  if (!parsed) return 999;

  return Math.max(0, Math.round((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function computeNextStep(data: HomeData): NextStep {
  const today = getTodayYYYYMMDD();

  // 1. Continue an unfinished study session (paused focus timer)
  if (data.pausedTimer && data.pausedTimer.mode === 'work' && data.pausedTimer.remainMs > 0) {
    const mins = Math.round(data.pausedTimer.remainMs / 60000);
    return {
      type: 'continue_session',
      title: 'Resume your focus session',
      subtitle: `${mins}m remaining on your timer`,
      topic: 'Pomodoro Session',
      reason: 'You paused a session earlier',
      route: '/app/focus',
      action: 'Resume Session',
      secondaryRoute: '/app/focus',
      secondaryAction: 'Restart',
    };
  }

  // 2. Complete an overdue task
  const overdueTasks = data.tasks
    .filter(t => !t.completed && getDueStatus(t.dueDate) === 'overdue')
    .sort((a, b) => normalizePriority(a.priority) - normalizePriority(b.priority));

  if (overdueTasks.length > 0) {
    const task = overdueTasks[0];
    return {
      type: 'overdue_task',
      title: task.text,
      subtitle: task.groupName
        ? `${task.groupName} • Overdue`
        : 'Overdue task',
      subject: task.groupName,
      reason: 'Past its due date',
      route: task.groupId ? `/app/study-groups/${task.groupId}` : '/app/planner',
      action: 'Finish Now',
      secondaryRoute: '/app/planner',
      secondaryAction: 'View All',
    };
  }

  // 3. Complete today's scheduled study task
  const todayTasks = data.tasks
    .filter(t => !t.completed && getDueStatus(t.dueDate) === 'today')
    .sort((a, b) => normalizePriority(a.priority) - normalizePriority(b.priority));

  if (todayTasks.length > 0) {
    const task = todayTasks[0];
    return {
      type: 'today_task',
      title: task.text,
      subtitle: task.groupName ? `${task.groupName} • Today` : 'Scheduled for today',
      subject: task.groupName,
      reason: 'Due today',
      route: task.groupId ? `/app/study-groups/${task.groupId}` : '/app/planner',
      action: 'Start Now',
      secondaryRoute: '/app/focus',
      secondaryAction: 'Start Focus',
    };
  }

  // Today's calendar nodes
  const todayNodes = data.calendarNodes.filter(n =>
    n.type !== 'completed' && n.date === today
  );

  if (todayNodes.length > 0) {
    const node = todayNodes[0];
    return {
      type: 'today_task',
      title: node.title,
      subtitle: 'On your calendar today',
      reason: 'Scheduled for today',
      route: '/app/planner',
      action: 'View Plan',
      secondaryRoute: '/app/focus',
      secondaryAction: 'Start Focus',
    };
  }

  // 4. Prepare for the nearest upcoming exam/deadline
  const upcomingTasks = data.tasks
    .filter(t => !t.completed && getDueStatus(t.dueDate) === 'upcoming')
    .sort((a, b) => getDaysUntil(a.dueDate) - getDaysUntil(b.dueDate));

  if (upcomingTasks.length > 0) {
    const task = upcomingTasks[0];
    const daysLeft = getDaysUntil(task.dueDate);
    const isExam = /exam|test|quiz|midterm|final/i.test(task.text);

    return {
      type: 'exam_prep',
      title: task.text,
      subtitle: task.groupName
        ? `${task.groupName} • ${daysLeft}d left`
        : `${daysLeft} days left`,
      subject: task.groupName,
      reason: `Deadline in ${daysLeft} days`,
      route: task.groupId ? `/app/study-groups/${task.groupId}` : '/app/planner',
      action: isExam ? 'Prepare' : 'Start Preparing',
      secondaryRoute: '/app/learn',
      secondaryAction: 'Study Tools',
    };
  }

  // Upcoming calendar nodes (plan type = exam/milestone)
  const upcomingNodes = data.calendarNodes
    .filter(n => n.type === 'plan' && n.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcomingNodes.length > 0) {
    const node = upcomingNodes[0];
    const daysLeft = Math.max(
      0,
      Math.round((new Date(node.date).getTime() - Date.now()) / 86400000)
    );
    const isExam = /exam|test|quiz|midterm|final/i.test(node.title);

    return {
      type: 'exam_prep',
      title: node.title,
      subtitle: `${daysLeft} days remaining`,
      reason: 'Upcoming milestone',
      route: '/app/planner',
      action: isExam ? 'Prepare' : 'Review Plan',
      secondaryRoute: '/app/learn',
      secondaryAction: 'Study Tools',
    };
  }

  // 5. Continue the most recently studied topic
  if (data.recentSessions.length > 0) {
    const recent = data.recentSessions[0];

    return {
      type: 'continue_topic',
      title: 'Continue where you left off',
      subtitle: `Last session: ${recent.duration} min • ${recent.startTime.toLocaleDateString()}`,
      reason: 'Based on your recent activity',
      duration: recent.duration,
      route: '/app/learn',
      action: 'Continue Learning',
      secondaryRoute: '/app/focus',
      secondaryAction: 'Start Focus',
    };
  }

  // 6. Create first goal
  return {
    type: 'create_goal',
    title: 'Create your first study goal',
    subtitle: 'Build your study system to get personalized recommendations',
    reason: 'No academic data found yet',
    route: '/app/planner',
    action: 'Set Up Planner',
    secondaryRoute: '/app/focus',
    secondaryAction: 'Start Focus',
  };
}

export function hasAnyData(data: HomeData): boolean {
  return (
    data.tasks.filter(t => !t.completed).length > 0 ||
    data.recentSessions.length > 0 ||
    data.calendarNodes.length > 0
  );
}

export function getUpcomingExam(data: HomeData): { title: string; subtitle: string; daysLeft: number; route: string; action: string } | null {
  const today = getTodayYYYYMMDD();

  const upcomingTasks = data.tasks
    .filter(t => !t.completed && getDueStatus(t.dueDate) === 'upcoming')
    .sort((a, b) => getDaysUntil(a.dueDate) - getDaysUntil(b.dueDate));

  if (upcomingTasks.length > 0) {
    const task = upcomingTasks[0];
    const daysLeft = getDaysUntil(task.dueDate);
    return {
      title: task.text,
      subtitle: task.groupName ?? 'Upcoming deadline',
      daysLeft,
      route: task.groupId ? `/app/study-groups/${task.groupId}` : '/app/planner',
      action: 'Prepare',
    };
  }

  const upcomingNodes = data.calendarNodes
    .filter(n => n.type === 'plan' && n.date > today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcomingNodes.length > 0) {
    const node = upcomingNodes[0];
    const daysLeft = Math.max(
      0,
      Math.round((new Date(node.date).getTime() - Date.now()) / 86400000)
    );
    return {
      title: node.title,
      subtitle: 'Exam / milestone',
      daysLeft,
      route: '/app/planner',
      action: 'Prepare',
    };
  }

  return null;
}
