/**
 * study.ts — The personal study data layer for TeenGenius.
 * Data ownership: signed-in non-guest -> users/{uid}/... in Firestore;
 * guest users -> fully local (localStorage + in-memory), never Firestore.
 */
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

// ─── Local storage keys ───────────────────────────────────────────────────
const LS_PROFILE = 'tg_student_profile';
const LS_SESSIONS = 'tg_study_sessions';
const LS_PRACTICE = 'tg_practice_results';
const LS_MASTERY = 'tg_topic_mastery';
const ONBOARDING_KEY = 'tg_onboarding_complete';
const lsGet = (k: string): any => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };
const lsSet = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const lsPush = (k: string, item: any) => { const arr = lsGet(k) ?? []; arr.push(item); lsSet(k, arr); };

// ─── Core types ───────────────────────────────────────────────────────────
export type MasteryStatus = 'strong' | 'developing' | 'needs-practice';
export type StudyMode = 'quick' | 'deep' | 'exam' | 'teach';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface TopicDef { id: string; subjectId: string; name: string; description: string; quickLearnMins?: number; children?: string[]; }
export interface SubjectDef { id: string; name: string; description: string; color: string; icon: string; topics: TopicDef[]; }
export interface StudentSubject { id: string; name: string; color: string; icon?: string; custom?: boolean; }
export interface ExamGoal { id: string; name: string; subjectIds: string[]; date: string; topicIds: string[]; createdAt: string; }
export interface StudentStudyProfile {
  subjects: StudentSubject[]; goal: string; helpFocus: string[]; startedTopics: string[];
  currentContext: { subjectId: string; topicId: string; subject: string; topic: string; updatedAt: string } | null;
  recentActivity: { type: 'learn' | 'practice' | 'review' | 'plan' | 'ai'; label: string; subject?: string; topic?: string; ts: string; }[];
  exams: ExamGoal[]; onboardingComplete: boolean;
}
export interface StudySession { id: string; uid: string; subjectId: string; subject: string; topicId: string; topic: string; mode: StudyMode; minutes: number; completed: boolean; createdAt: string; }
export interface PracticeResult {
  id: string; uid: string; subjectId: string; topicId: string; topic: string;
  questions: Array<{ question: string; studentAnswer: string | null; correctAnswer: string; explanation?: string; difficulty: QuestionDifficulty; }>;
  correctIndices: number[]; score: number; total: number; accuracy: number; durationSecs?: number; createdAt: string;
}
export interface TopicMastery { topicId: string; subjectId: string; topic: string; accuracy: number; attempts: number; lastAttempted: string; status: MasteryStatus; }
export interface StudySnapshot {
  profile: StudentStudyProfile | null; recentSession: StudySession | null; weakTopics: TopicMastery[]; strongTopics: TopicMastery[];
  upcomingExams: ExamGoal[]; hasPracticeHistory: boolean; totalStudyMinutes: number; hasOnboarding: boolean;
}
const DEFAULT_PROFILE: StudentStudyProfile = { subjects: [], goal: 'regular', helpFocus: [], startedTopics: [], currentContext: null, recentActivity: [], exams: [], onboardingComplete: false };

// ─── Subject catalog ───────────────────────────────────────────────────────
export const SUBJECT_CATALOG: SubjectDef[] = [
  { id: 'mathematics', name: 'Mathematics', description: 'Algebra, geometry, calculus — all the numbers.', color: 'blue', icon: 'Calculator', topics: [
    { id: 'linear-equations', subjectId: 'mathematics', name: 'Linear Equations', description: 'Equations with one variable solved in a straight line.', quickLearnMins: 12 },
    { id: 'quadratics', subjectId: 'mathematics', name: 'Quadratic Equations', description: 'Polynomial equations of degree two.', quickLearnMins: 15 },
    { id: 'functions', subjectId: 'mathematics', name: 'Functions', description: 'Inputs, outputs, and how they relate.', quickLearnMins: 14 },
    { id: 'geometry-basics', subjectId: 'mathematics', name: 'Geometry Basics', description: 'Shapes, angles, and proofs.', quickLearnMins: 16 },
    { id: 'trigonometry', subjectId: 'mathematics', name: 'Trigonometry', description: 'Triangles, sine, cosine, and tangent.', quickLearnMins: 18 },
  ] },
  { id: 'physics', name: 'Physics', description: 'How the universe works, from atoms to galaxies.', color: 'purple', icon: 'Atom', topics: [
    { id: 'motion', subjectId: 'physics', name: 'Motion', description: 'Speed, velocity, acceleration, Newton\'s laws.', quickLearnMins: 14 },
    { id: 'electricity', subjectId: 'physics', name: 'Electricity', description: 'Current, voltage, resistance, Ohm\'s law.', quickLearnMins: 16 },
    { id: 'waves', subjectId: 'physics', name: 'Waves & Sound', description: 'Frequency, amplitude, the nature of sound.', quickLearnMins: 15 },
    { id: 'thermodynamics', subjectId: 'physics', name: 'Thermodynamics', description: 'Heat, energy, and the laws.', quickLearnMins: 18 },
    { id: 'optics', subjectId: 'physics', name: 'Optics', description: 'Light, lenses, reflection, refraction.', quickLearnMins: 15 },
  ] },
  { id: 'chemistry', name: 'Chemistry', description: 'The science of matter and its interactions.', color: 'teal', icon: 'FlaskCircle', topics: [
    { id: 'atoms', subjectId: 'chemistry', name: 'Atomic Structure', description: 'Protons, neutrons, electrons, periodic table.', quickLearnMins: 14 },
    { id: 'bonding', subjectId: 'chemistry', name: 'Chemical Bonding', description: 'Ionic, covalent, and metallic bonds.', quickLearnMins: 16 },
    { id: 'reactions', subjectId: 'chemistry', name: 'Chemical Reactions', description: 'Balancing equations and reaction types.', quickLearnMins: 15 },
    { id: 'stoichiometry', subjectId: 'chemistry', name: 'Stoichiometry', description: 'Calculating amounts in reactions.', quickLearnMins: 18 },
    { id: 'acids', subjectId: 'chemistry', name: 'Acids & Bases', description: 'pH, neutralization, pH scale.', quickLearnMins: 14 },
  ] },
  { id: 'biology', name: 'Biology', description: 'Life and living organisms, from cells to ecosystems.', color: 'emerald', icon: 'Leaf', topics: [
    { id: 'cells', subjectId: 'biology', name: 'Cell Structure', description: 'Organelles, membrane, basics of life.', quickLearnMins: 16 },
    { id: 'photosynthesis', subjectId: 'biology', name: 'Photosynthesis', description: 'How plants turn light into food.', quickLearnMins: 14 },
    { id: 'dna', subjectId: 'biology', name: 'DNA & Genetics', description: 'Heredity, genes, traits.', quickLearnMins: 18 },
    { id: 'ecosystems', subjectId: 'biology', name: 'Ecosystems', description: 'Producers, consumers, food web.', quickLearnMins: 15 },
    { id: 'human-body', subjectId: 'biology', name: 'Human Body Systems', description: 'Circulatory, respiratory systems.', quickLearnMins: 20 },
  ] },
  { id: 'english', name: 'English', description: 'Reading, writing, critical thinking.', color: 'sky', icon: 'BookOpen', topics: [
    { id: 'grammar', subjectId: 'english', name: 'Grammar', description: 'Parts of speech and sentence structure.', quickLearnMins: 12 },
    { id: 'literature', subjectId: 'english', name: 'Literature', description: 'Novels, poetry, analysis.', quickLearnMins: 16 },
    { id: 'writing', subjectId: 'english', name: 'Essay Writing', description: 'Planning, structuring, polishing.', quickLearnMins: 18 },
    { id: 'comprehension', subjectId: 'english', name: 'Reading Comprehension', description: 'Understanding and interpreting texts.', quickLearnMins: 14 },
  ] },
  { id: 'social-science', name: 'Social Science', description: 'History, geography, civics, economics.', color: 'amber', icon: 'Landmark', topics: [
    { id: 'world-history', subjectId: 'social-science', name: 'World History', description: 'Major events and turning points.', quickLearnMins: 16 },
    { id: 'geography', subjectId: 'social-science', name: 'Geography', description: 'Physical and human geography.', quickLearnMins: 14 },
    { id: 'civics', subjectId: 'social-science', name: 'Civics', description: 'Government, rights, responsibilities.', quickLearnMins: 14 },
    { id: 'economics', subjectId: 'social-science', name: 'Economics', description: 'Micro and macro basics.', quickLearnMins: 16 },
  ] },
];

export const getSubjectDef = (subjectId: string): SubjectDef | undefined => SUBJECT_CATALOG.find((s) => s.id === subjectId);
export const getTopicDef = (topicId: string): TopicDef | undefined => SUBJECT_CATALOG.flatMap((s) => s.topics).find((t) => t.id === topicId);
export const getTopicDefForSubject = (subjectId: string, topicId: string): TopicDef | undefined => SUBJECT_CATALOG.find((s) => s.id === subjectId)?.topics.find((t) => t.id === topicId);

// ─── Options ───────────────────────────────────────────────────────────────
export const GOAL_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: 'regular', label: 'Regular school study', desc: 'Keep up with coursework day by day.' },
  { value: 'tests', label: 'Unit tests', desc: 'Prepare for upcoming chapter tests.' },
  { value: 'midterms', label: 'Midterms', desc: 'Get ready for your midterm exams.' },
  { value: 'finals', label: 'Finals', desc: 'Prepare for end-of-year final exams.' },
  { value: 'board', label: 'Board exams', desc: 'Focused prep for board-level exams.' },
  { value: 'competitive', label: 'Competitive exams', desc: 'Prepare for entrance exams.' },
];
export const HELP_FOCUS_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: 'concepts', label: 'Understanding concepts', icon: 'Lightbulb' },
  { value: 'homework', label: 'Homework', icon: 'BookOpen' },
  { value: 'revision', label: 'Revision', icon: 'RefreshCw' },
  { value: 'practice', label: 'Practice', icon: 'ClipboardCheck' },
  { value: 'exams', label: 'Exam preparation', icon: 'GraduationCap' },
  { value: 'planning', label: 'Planning & time management', icon: 'Calendar' },
];
export const TEACHING_MODES: Array<{ id: StudyMode; label: string; desc: string; icon: string }> = [
  { id: 'quick', label: 'Quick Learn', desc: 'Short explanation + example.', icon: 'Zap' },
  { id: 'deep', label: 'Deep Learn', desc: 'More detailed explanation.', icon: 'BookOpen' },
  { id: 'exam', label: 'Exam Mode', desc: 'Focus on assessment content.', icon: 'Target' },
  { id: 'teach', label: 'Teach Me', desc: 'Interactive tutor that checks you.', icon: 'GraduationCap' },
];

// ─── Onboarding flag ───────────────────────────────────────────────────────
export const isOnboardingComplete = (): boolean => { try { return !!localStorage.getItem(ONBOARDING_KEY); } catch { return false; } };
export const setOnboardingComplete = (v = true) => { try { if (v) localStorage.setItem(ONBOARDING_KEY, '1'); else localStorage.removeItem(ONBOARDING_KEY); } catch {} };

// ─── Firestore path helpers ────────────────────────────────────────────────
const profileDocRef = (uid: string) => doc(db, 'users', uid);
const subCol = (uid: string, name: string) => collection(db, 'users', uid, name);

// ─── Profile persistence ───────────────────────────────────────────────────
/** Load the student profile (Firestore for signed-in, localStorage for guests). */
export const loadStudentProfile = async (uid: string | null): Promise<StudentStudyProfile> => {
  const cached = lsGet(LS_PROFILE);
  if (!uid) return cached ?? DEFAULT_PROFILE;
  try {
    const snap = await getDoc(profileDocRef(uid));
    if (snap.exists()) {
      const data = snap.data() as { studyProfile?: StudentStudyProfile };
      const profile = data.studyProfile ?? DEFAULT_PROFILE;
      lsSet(LS_PROFILE, profile);
      return profile;
    }
    return cached ?? DEFAULT_PROFILE;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'users');
    return cached ?? DEFAULT_PROFILE;
  }
};

/** Merge + persist student profile. Always mirrors to localStorage. */
export const saveStudentProfile = async (uid: string | null, updates: Partial<StudentStudyProfile>): Promise<void> => {
  const existing = await loadStudentProfile(uid);
  const merged: StudentStudyProfile = { ...DEFAULT_PROFILE, ...existing, ...updates, onboardingComplete: updates.onboardingComplete ?? existing.onboardingComplete };
  lsSet(LS_PROFILE, merged);
  if (uid) {
    try { await setDoc(profileDocRef(uid), { studyProfile: merged }, { merge: true }); }
         catch (err) { handleFirestoreError(err, OperationType.UPDATE, 'users'); }
  }
};

// ─── Study session persistence ─────────────────────────────────────────────
export const saveStudySession = async (uid: string | null, session: Omit<StudySession, 'id' | 'uid'>): Promise<StudySession | null> => {
  const full: StudySession = { id: crypto.randomUUID(), uid: uid ?? 'local', ...session, createdAt: new Date().toISOString() };
  lsPush(LS_SESSIONS, full);
  if (uid) { try { await addDoc(subCol(uid, 'studySessions'), { ...full, createdAt: serverTimestamp() }); } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'studySessions'); } }
  return full;
};

export const subscribeStudySessions = (uid: string | null, callback: (sessions: StudySession[]) => void) => {
  if (!uid) { callback(lsGet(LS_SESSIONS) ?? []); return () => {}; }
  try {
    return onSnapshot(query(subCol(uid, 'studySessions'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
      const sessions: StudySession[] = snap.docs.map((d) => d.data() as StudySession);
      lsSet(LS_SESSIONS, sessions);
      callback(sessions);
    }, (err) => { handleFirestoreError(err, OperationType.LIST, 'studySessions'); callback(lsGet(LS_SESSIONS) ?? []); });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'studySessions');
    callback(lsGet(LS_SESSIONS) ?? []);
    return () => {};
  }
};

// ─── Practice results + mastery ────────────────────────────────────────────
const computeMasteryStatus = (accuracy: number, attempts: number): MasteryStatus => {
  if (attempts < 1) return 'needs-practice';
  if (accuracy >= 0.85) return 'strong';
  if (accuracy >= 0.55) return 'developing';
  return 'needs-practice';
};

const loadMastery = (uid: string | null): TopicMastery[] => {
  const all = lsGet(LS_MASTERY) ?? [];
  if (!uid) return (all as any[]).filter((m) => !m._uid) as TopicMastery[];
  return (all as any[]).filter((m) => m._uid === uid) as TopicMastery[];
};
const persistMastery = (uid: string | null, masteries: TopicMastery[]) => {
  const existing = lsGet(LS_MASTERY) ?? [];
  const without = (existing as any[]).filter((m) => (m._uid ? m._uid !== uid : !uid));
  lsSet(LS_MASTERY, [...without, ...masteries.map((m) => ({ ...m, _uid: uid ?? null }))]);
};

export const updateMastery = (uid: string | null, topicId: string, subjectId: string, topicName: string, results: PracticeResult[]): TopicMastery => {
  const relevant = results.filter((r) => r.topicId === topicId && r.subjectId === subjectId);
  if (relevant.length === 0) {
    const m: TopicMastery = { topicId, subjectId, topic: topicName, accuracy: 0, attempts: 0, lastAttempted: new Date().toISOString(), status: 'needs-practice' };
    persistMastery(uid, [m, ...loadMastery(uid).filter((x) => x.topicId !== topicId)]);
    return m;
  }
  const recent = [...relevant].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, Math.min(5, relevant.length));
  const correct = recent.reduce((a, r) => a + r.score, 0);
  const total = recent.reduce((a, r) => a + r.total, 0);
  const accuracy = total > 0 ? correct / total : 0;
  const m: TopicMastery = { topicId, subjectId, topic: topicName, accuracy, attempts: relevant.length, lastAttempted: recent[0].createdAt, status: computeMasteryStatus(accuracy, relevant.length) };
  persistMastery(uid, [m, ...loadMastery(uid).filter((x) => x.topicId !== topicId)]);
  return m;
};

export const savePracticeResult = async (uid: string | null, result: Omit<PracticeResult, 'id' | 'uid' | 'createdAt'>): Promise<{ result: PracticeResult; mastery: TopicMastery } | null> => {
  const full: PracticeResult = { id: crypto.randomUUID(), uid: uid ?? 'local', ...result, createdAt: new Date().toISOString() };
  const allResults: PracticeResult[] = [...(lsGet(LS_PRACTICE) ?? []), full];
  lsSet(LS_PRACTICE, allResults);
  if (uid) { try { await addDoc(subCol(uid, 'practiceResults'), { ...full, createdAt: serverTimestamp() }); } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'practiceResults'); } }
  return { result: full, mastery: updateMastery(uid, full.topicId, full.subjectId, full.topic, allResults) };
};

export const subscribePracticeResults = (uid: string | null, callback: (results: PracticeResult[]) => void) => {
  if (!uid) { callback(lsGet(LS_PRACTICE) ?? []); return () => {}; }
  try {
    return onSnapshot(query(subCol(uid, 'practiceResults'), orderBy('createdAt', 'desc'), limit(200)), (snap) => {
      const results: PracticeResult[] = snap.docs.map((d) => d.data() as PracticeResult);
      lsSet(LS_PRACTICE, results);
      callback(results);
    }, (err) => { handleFirestoreError(err, OperationType.LIST, 'practiceResults'); callback(lsGet(LS_PRACTICE) ?? []); });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'practiceResults');
        callback(lsGet(LS_PRACTICE) ?? []);
    return () => {};
  }
};

// ─── Derived reads (from localStorage cache) ───────────────────────────────
export const getAllMastery = (uid: string | null): TopicMastery[] => loadMastery(uid);
export const getMasteryForTopic = (uid: string | null, topicId: string): TopicMastery | null => loadMastery(uid).find((m) => m.topicId === topicId) ?? null;
export const getResultsForTopic = (uid: string | null, topicId: string): PracticeResult[] => [...(lsGet(LS_PRACTICE) ?? [])].filter((r) => r.topicId === topicId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
export const getMistakesForTopic = (uid: string | null, topicId: string): PracticeResult[] => [...(lsGet(LS_PRACTICE) ?? [])].filter((r) => r.topicId === topicId && r.correctIndices.length < r.total).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
export const getRecentSession = (uid: string | null): StudySession | null => [...(lsGet(LS_SESSIONS) ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;

export const getWeakTopics = (uid: string | null, limitCount = 3): TopicMastery[] => {
  const attempted = loadMastery(uid).filter((m) => m.attempts > 0);
  return [...attempted].sort((a, b) => (a.accuracy !== b.accuracy ? a.accuracy - b.accuracy : (b.lastAttempted || '').localeCompare(a.lastAttempted || ''))).slice(0, limitCount);
};
export const getStrongTopics = (uid: string | null, limitCount = 3): TopicMastery[] => {
  const strong = loadMastery(uid).filter((m) => m.attempts > 0 && m.status === 'strong');
  return [...strong].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0)).slice(0, limitCount);
};
export const getTotalAccuracy = (uid: string | null): { correct: number; total: number; accuracy: number } => {
  const results: PracticeResult[] = lsGet(LS_PRACTICE) ?? [];
  const total = results.reduce((a, r) => a + r.total, 0);
  const correct = results.reduce((a, r) => a + r.score, 0);
    return { correct, total, accuracy: total > 0 ? correct / total : 0 };
};

// ─── Recommendation engine ─────────────────────────────────────────────────
const explainStatus = (status: MasteryStatus): string => {
  switch (status) {
    case 'strong': return 'strong';
    case 'developing': return 'developing';
    case 'needs-practice': return 'needs practice';
    default: return status;
  }
};

/**
 * Decide the single most useful thing for the student to do now.
 * Purely data-driven — no fake recommendations.
 */
export const getNextAction = (uid: string | null, profile: StudentStudyProfile | null) => {
  const ctx = profile?.currentContext;
  const recentSession = getRecentSession(uid);
  const weak = getWeakTopics(uid, 3);
  const strong = getStrongTopics(uid, 3);
  const exams: ExamGoal[] = profile?.exams ?? [];
  const today = new Date().toISOString().slice(0, 10);

  // 1) Urgent exam today/tomorrow
  const urgentExam = exams.find((e) => {
    const diffDays = Math.ceil((new Date(e.date).getTime() - new Date(today).getTime()) / 86400000);
    return diffDays <= 1;
  });
  if (urgentExam) {
    return { type: 'exam-prep' as const, title: `Prepare for ${urgentExam.name}`, subtitle: `${urgentExam.topicIds.length} topics in scope`, action: 'Review weak topics', icon: 'Target', to: `/app/exam/${urgentExam.id}` };
  }

  // 2) Continue learning (session today/yesterday)
  if (ctx && recentSession) {
    const age = (Date.now() - new Date(recentSession.createdAt).getTime()) / 86400000;
    if (age <= 1) {
      return { type: 'continue' as const, title: `Continue ${ctx.subject}`, subtitle: `${ctx.topic} — pick up where you left off.`, action: 'Continue learning', icon: 'Play', to: `/app/study/${ctx.subjectId}/${ctx.topicId}` };
    }
  }

  // 3) Practice a weak topic
  if (weak.length > 0) {
    const w = weak[0];
    return { type: 'practice-weak' as const, title: `Practice ${w.topic}`, subtitle: `Accuracy ${Math.round(w.accuracy * 100)}% — ${explainStatus(w.status)}.`, action: 'Start practice', icon: 'ClipboardCheck', to: `/app/practice?topic=${w.topicId}&subject=${w.subjectId}` };
  }

  // 4) Suggest learning if subjects chosen but no mastery
  if (profile?.subjects && profile.subjects.length > 0 && strong.length === 0) {
    const firstSubject = profile.subjects[0];
    const def = getSubjectDef(firstSubject.id);
    if (def && def.topics.length > 0) {
      const t = def.topics[0];
      if (!profile.startedTopics.includes(t.id)) {
        return { type: 'learn-topic' as const, title: `Learn ${t.name}`, subtitle: `In ${def.name}.`, action: 'Start learning', icon: 'BookOpen', to: `/app/study/${def.id}/${t.id}` };
      }
    }
  }

  // 5) Strong topics — move forward
  if (strong.length > 0) {
    const s = strong[0];
    return { type: 'plan' as const, title: `Keep going with ${s.topic}`, subtitle: 'You\'re getting strong here. Try the next topic.', action: 'View topics', icon: 'ChevronRight', to: `/app/study/${s.subjectId}` };
  }

  // 6) Starter
  return { type: 'start' as const, title: 'Start your first study session', subtitle: 'Pick a subject and topic to begin.', action: 'Browse subjects', icon: 'Sparkles', to: '/app/learn' };
};

/** Human-readable explanation of WHY a topic is weak (for "Why this?"). */
export const getMasteryRationale = (uid: string | null, topicId: string): string => {
  const mastery = getMasteryForTopic(uid, topicId);
  if (!mastery) return 'You haven\'t practiced this topic yet.';
  const results = getResultsForTopic(uid, topicId);
  const wrong = results.filter((r) => r.correctIndices.length < r.total).length;
    return `You attempted this ${mastery.attempts} ${mastery.attempts === 1 ? 'time' : 'times'} with ${Math.round((mastery.accuracy || 0) * 100)}% accuracy. ${wrong > 0 ? `${wrong} attempt${wrong === 1 ? '' : 's'} had mistakes.` : 'On the right track.'}`;
};

// ─── Context setter ────────────────────────────────────────────────────────
/** Set the student's current learning context (subject/topic) and record activity. */
export const setCurrentLearningContext = async (uid: string | null, subjectId: string, topicId: string): Promise<void> => {
  const subjectDef = getSubjectDef(subjectId);
  const topicDef = getTopicDefForSubject(subjectId, topicId);
  if (!subjectDef || !topicDef) return;
  await saveStudentProfile(uid, {
    currentContext: { subjectId, topicId, subject: subjectDef.name, topic: topicDef.name, updatedAt: new Date().toISOString() },
  });
  const existing = await loadStudentProfile(uid);
  const started = existing.startedTopics ?? [];
  if (!started.includes(topicId)) {
    await saveStudentProfile(uid, { startedTopics: [...started, topicId] });
  }
};

// ─── React hooks ───────────────────────────────────────────────────────────
/** Current student study profile + uid for the authenticated user. */
export const useStudentProfile = () => {
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const [profile, setProfile] = useState<StudentStudyProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    loadStudentProfile(uid).then((p) => { if (mounted) { setProfile(p); setLoading(false); } });
  }, [uid]);
  return { profile, loading, uid, isGuest };
};

/** Full study snapshot for the dashboard. */
export const useStudySnapshot = () => {
  const { profile, loading, uid, isGuest } = useStudentProfile();
  if (loading || !profile) return { snapshot: null, loading: true, uid, isGuest };
  const snapshot: StudySnapshot = {
    profile,
    recentSession: getRecentSession(uid),
    weakTopics: getWeakTopics(uid, 3),
    strongTopics: getStrongTopics(uid, 3),
    upcomingExams: profile.exams.filter((e) => new Date(e.date) >= new Date()).slice(0, 3),
    hasPracticeHistory: getTotalAccuracy(uid).total > 0,
    totalStudyMinutes: 0,
    hasOnboarding: profile.onboardingComplete,
  };
  return { snapshot, loading: false, uid, isGuest };
};

/** Weak topics subscription (reactive to localStorage changes). */
export const useWeakTopics = (limitCount = 5) => {
  const { uid } = useStudentProfile();
  const [data, setData] = useState<TopicMastery[]>([]);
  const read = () => setData(getWeakTopics(uid, limitCount));
  useEffect(() => { read(); const i = setInterval(read, 1500); return () => clearInterval(i); }, [uid]);
  return data;
};

/** Next-action recommendation (Home primary CTA). */
export const useNextAction = () => {
  const { uid, profile } = useStudentProfile();
  const [action, setAction] = useState(() => getNextAction(uid, profile ?? null));
  useEffect(() => { setAction(getNextAction(uid, profile ?? null)); }, [uid, profile]);
  return action;
};

/** Student subject catalog filtered to chosen subjects. */
export const useStudentCatalog = () => {
  const { profile, loading, uid } = useStudentProfile();
  const chosen = profile?.subjects.map((s) => s.id) ?? [];
  const subjects = chosen.length > 0 ? SUBJECT_CATALOG.filter((s) => chosen.includes(s.id)) : SUBJECT_CATALOG;
  return { subjects, chosenIds: chosen, loading, uid, profile };
};

// ─── Exam goals ─────────────────────────────────────────────────────────────
/** Create an exam goal (name, date, subject ids, topic ids in scope). */
export const saveExam = async (
  uid: string | null,
  exam: { name: string; date: string; subjectIds: string[]; topicIds: string[] },
): Promise<ExamGoal> => {
  const profile = await loadStudentProfile(uid);
  const full: ExamGoal = {
    id: crypto.randomUUID(),
    name: exam.name.trim(),
    date: exam.date,
    subjectIds: exam.subjectIds,
    topicIds: exam.topicIds,
    createdAt: new Date().toISOString(),
  };
  await saveStudentProfile(uid, { exams: [...(profile.exams ?? []), full] });
  return full;
};

/** Remove an exam goal. */
export const deleteExam = async (uid: string | null, examId: string): Promise<void> => {
  const profile = await loadStudentProfile(uid);
  await saveStudentProfile(uid, { exams: (profile.exams ?? []).filter((e) => e.id !== examId) });
};

/** Whole days from today until the exam date (negative = in the past). */
export const daysUntilExam = (date: string): number => {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.ceil((new Date(date).getTime() - today) / 86400000);
};


