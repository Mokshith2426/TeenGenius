/**
 * practice.ts — Lightweight practice question model + scoring.
 * Reuses PracticeResult / TopicMastery types from study.ts.
 * Persistence is handled by savePracticeResult() in study.ts.
 */
import { PracticeResult, TopicMastery, QuestionDifficulty } from './study';

export interface PracticeQuestion {
  id: string;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  difficulty: QuestionDifficulty;
  topicId: string;
  subjectId: string;
  topic: string;
  subject: string;
}

/** Generate a practice quiz for the given topic (or topic + subject). Shuffles to avoid identical repeats. */
export const generatePracticeQuestions = (topicId: string, subjectId?: string, count = 5): PracticeQuestion[] => {
  const bank = QUESTION_BANK[topicId];
  if (!bank || bank.length === 0) return [];
  const pool = subjectId ? bank.filter((q) => q.subjectId === subjectId) : bank;
  const source = pool.length > 0 ? pool : bank;
  // Fisher-Yates shuffle so consecutive quizzes differ when the bank has extra questions.
  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const out: PracticeQuestion[] = [];
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length]);
  return out;
};

/** Normalize answers for comparison. */
const normalizeAnswer = (a: string): string => a.toLowerCase().trim().replace(/^the\s+/, '').replace(/^answer:\s*/, '').trim();

/** Grade a quiz attempt. */
export const gradeQuiz = (
  questions: PracticeQuestion[],
  answers: Array<string | null>,
  durationSecs?: number
): { score: number; total: number; accuracy: number; correctIndices: number[]; wrongIndices: number[]; resultQuestions: PracticeResult['questions'] } => {
  let score = 0;
  const correctIndices: number[] = [];
  const wrongIndices: number[] = [];
  const resultQuestions: PracticeResult['questions'] = [];
  questions.forEach((q, i) => {
    const student = answers[i];
    const isCorrect = student !== null && normalizeAnswer(student) === normalizeAnswer(q.answer);
    if (isCorrect) { score++; correctIndices.push(i); } else { wrongIndices.push(i); }
    resultQuestions.push({ question: q.question, studentAnswer: student, correctAnswer: q.answer, explanation: q.explanation, difficulty: q.difficulty });
  });
  return { score, total: questions.length, accuracy: questions.length > 0 ? score / questions.length : 0, correctIndices, wrongIndices, resultQuestions };
};

/** Friendly status label from mastery. */
export const statusLabel = (m: TopicMastery | null): string => {
  if (!m || m.attempts === 0) return 'Not yet attempted';
  switch (m.status) {
    case 'strong': return 'Strong';
    case 'developing': return 'Developing';
    case 'needs-practice': return 'Needs Practice';
    default: return m.status;
  }
};

/** Retry-practice questions drawn from mistakes. */
export const getMistakeQuestions = (wrongIndices: number[], questions: PracticeQuestion[]): PracticeQuestion[] => questions.filter((_, i) => wrongIndices.includes(i));

/** Deterministic local question bank, keyed by topicId (matches study.ts TOPIC_CATALOG ids). */
export const QUESTION_BANK: Record<string, PracticeQuestion[]> = {
  'linear-equations': [
    { id: 'le-1', question: 'Solve for x: 2x + 3 = 11', options: ['x = 4', 'x = 5', 'x = 3.5', 'x = 3'], answer: 'x = 4', explanation: 'Subtract 3 from both sides: 2x = 8, then divide by 2.', difficulty: 'easy', topicId: 'linear-equations', subjectId: 'mathematics', topic: 'Linear Equations', subject: 'Mathematics' },
    { id: 'le-2', question: 'What is the slope of 3x - 2y = 6?', options: ['3/2', '-3/2', '2/3', '6'], answer: '3/2', explanation: 'Rewrite as y = (3/2)x - 3, so slope = 3/2.', difficulty: 'medium', topicId: 'linear-equations', subjectId: 'mathematics', topic: 'Linear Equations', subject: 'Mathematics' },
    { id: 'le-3', question: 'If 5(x - 2) = 3x + 4, what is x?', options: ['4', '5', '6', '7'], answer: '7', explanation: 'Expand: 5x - 10 = 3x + 4 -> 2x = 14 -> x = 7.', difficulty: 'medium', topicId: 'linear-equations', subjectId: 'mathematics', topic: 'Linear Equations', subject: 'Mathematics' },
  ],
  'photosynthesis': [
    { id: 'ps-1', question: 'What gas do plants absorb for photosynthesis?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], answer: 'Carbon dioxide', explanation: 'Plants take in CO2 through their stomata.', difficulty: 'easy', topicId: 'photosynthesis', subjectId: 'biology', topic: 'Photosynthesis', subject: 'Biology' },
    { id: 'ps-2', question: 'Which pigment captures light energy in chloroplasts?', options: ['Chlorophyll', 'Carotene', 'Xanthophyll', 'Melanin'], answer: 'Chlorophyll', explanation: 'Chlorophyll is the green pigment that captures sunlight.', difficulty: 'easy', topicId: 'photosynthesis', subjectId: 'biology', topic: 'Photosynthesis', subject: 'Biology' },
    { id: 'ps-3', question: 'Where in the plant cell does photosynthesis occur?', options: ['Mitochondria', 'Cell membrane', 'Chloroplasts', 'Nucleus'], answer: 'Chloroplasts', explanation: 'Chloroplasts contain chlorophyll and are the site of photosynthesis.', difficulty: 'medium', topicId: 'photosynthesis', subjectId: 'biology', topic: 'Photosynthesis', subject: 'Biology' },
  ],
  'electricity': [
    { id: 'el-1', question: "Ohm's Law: V = I x R. If I = 2A and R = 5Ohm, what is V?", options: ['7V', '10V', '2.5V', '10W'], answer: '10V', explanation: 'V = 2 x 5 = 10 volts.', difficulty: 'easy', topicId: 'electricity', subjectId: 'physics', topic: 'Electricity', subject: 'Physics' },
    { id: 'el-2', question: 'In a series circuit, what stays the same?', options: ['Voltage', 'Current', 'Resistance', 'Power'], answer: 'Current', explanation: 'Current is the same through all components in series.', difficulty: 'medium', topicId: 'electricity', subjectId: 'physics', topic: 'Electricity', subject: 'Physics' },
    { id: 'el-3', question: 'If a 10Ohm resistor carries 2A, how much power does it dissipate?', options: ['20W', '5W', '40W', '12W'], answer: '40W', explanation: 'P = I^2 x R = 4 x 10 = 40W.', difficulty: 'hard', topicId: 'electricity', subjectId: 'physics', topic: 'Electricity', subject: 'Physics' },
  ],
};
