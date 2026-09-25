import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { savePracticeResult, getMasteryForTopic, getMistakesForTopic, setCurrentLearningContext } from '../lib/study';
import { generatePracticeQuestions, gradeQuiz, statusLabel, PracticeQuestion } from '../lib/practice';
import { getTopicDefForSubject, getSubjectDef, SubjectDef } from '../lib/study';
import { cn } from '../lib/utils';
import { safeFetch } from '../lib/api';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, BarChart3, Loader2, AlertTriangle } from 'lucide-react';

type Phase = 'instructions' | 'quizzing' | 'review';

const normAnswer = (a: string): string => a.toLowerCase().trim().replace(/^the\s+/, '').replace(/^answer:\s*/, '').trim();

export default function PracticeExperience() {
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const navigate = useNavigate();
  const location = useLocation();
  const { subject: subjParam, topic: topicParam } = useParams<{ subject?: string; topic?: string }>();
  const sp = new URLSearchParams(location.search);

  const subjectId = sp.get('subject') ?? subjParam ?? '';
  const topicId = sp.get('topic') ?? topicParam ?? '';
  const topicDef = getTopicDefForSubject(subjectId, topicId);
  const subjectDef: SubjectDef | undefined = subjectId ? getSubjectDef(subjectId) : undefined;

  const [phase, setPhase] = useState<Phase>('instructions');
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Array<string | null>>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [mastery, setMastery] = useState<ReturnType<typeof getMasteryForTopic> | null>(null);
  const [loadingQs, setLoadingQs] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  const topicName = topicDef?.name ?? 'this topic';
  const subjectName = subjectDef?.name ?? subjectId ?? '';
  const masteryStatus = mastery ? statusLabel(mastery) : 'Not yet attempted';
  const selectedCount = answers.filter((a) => a !== null).length;
    const canSubmit = selectedCount === questions.length && questions.length > 0;

  // Load current mastery on mount
  useEffect(() => { setMastery(getMasteryForTopic(uid, topicId)); }, [uid, topicId]);
  // Set learning context
  useEffect(() => { if (topicId && subjectId) setCurrentLearningContext(uid, subjectId, topicId); }, [uid, topicId, subjectId]);

  /** Defensively validate one AI-returned question before trusting it. */
  const mapAiQuestion = (raw: any, i: number): PracticeQuestion | null => {
    if (!raw || typeof raw.question !== 'string' || !Array.isArray(raw.options) || raw.options.length < 2) return null;
    const idx = typeof raw.correctAnswerIndex === 'number' ? raw.correctAnswerIndex : -1;
    const answer = idx >= 0 && idx < raw.options.length ? String(raw.options[idx]) : '';
    if (!answer) return null;
    const difficulty = (['easy', 'medium', 'hard'] as const).includes(raw.difficulty) ? raw.difficulty : 'medium';
    return {
      id: `ai-${topicId}-${Date.now()}-${i}`,
      question: raw.question,
      options: raw.options.map(String),
      answer,
      explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
      difficulty,
      topicId, subjectId, topic: topicName, subject: subjectName,
    };
  };

  /** Top up (or build) a quiz from the AI quiz endpoint. Throws on failure. */
  const fetchAiQuestions = async (count: number): Promise<PracticeQuestion[]> => {
    const res = await safeFetch('/api/ai/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: `${topicName} (${subjectName})` }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'AI request failed');
    const raw: any[] = Array.isArray(data?.quiz?.questions) ? data.quiz.questions : [];
    return raw.map(mapAiQuestion).filter((q: PracticeQuestion | null): q is PracticeQuestion => q !== null).slice(0, count);
  };

  const beginQuiz = (qs: PracticeQuestion[]) => {
    setQuestions(qs);
    setAnswers(Array(qs.length).fill(null));
    setStartTime(Date.now());
    setPhase('quizzing');
  };

  const startQuiz = async (count = 5) => {
    setQuizError(null);
    const local = generatePracticeQuestions(topicId, subjectId, count);
    if (local.length >= count) {
      beginQuiz(local);
      return;
    }
    // Local bank is short for this topic — fill the gap from the AI endpoint.
    setLoadingQs(true);
    try {
      const ai = await fetchAiQuestions(count);
      const merged = [...ai, ...local.filter((l) => !ai.some((a) => a.question === l.question))].slice(0, Math.max(count, ai.length));
      const finalQs = merged.length > 0 ? merged : local;
      if (finalQs.length === 0) {
        setQuizError("Couldn't load questions for this topic. Check your connection and try again.");
        return;
      }
      beginQuiz(finalQs);
    } catch {
      if (local.length > 0) {
        beginQuiz(local);
      } else {
        setQuizError("Couldn't load questions for this topic. Check your connection and try again.");
      }
    } finally {
      setLoadingQs(false);
    }
  };

  const startMistakesReview = () => {
    const mistakes = getMistakesForTopic(uid, topicId);
    if (mistakes.length === 0) return;
    const latest = mistakes[0];
    const wrong = latest.questions
      .map((q, i) => ({ q, wrong: !latest.correctIndices.includes(i) }))
      .filter((x) => x.wrong)
      .map((x) => x.q);
    if (wrong.length === 0) return;
    const qs: PracticeQuestion[] = wrong.map((rq, i) => ({
      id: `mistake-${i}`, question: rq.question, options: [], answer: rq.correctAnswer,
      explanation: rq.explanation ?? '', difficulty: rq.difficulty, topicId, subjectId, topic: topicName, subject: subjectName,
    }));
    setQuestions(qs);
    setAnswers(Array(qs.length).fill(null));
    setStartTime(Date.now());
    setPhase('quizzing');
  };

  const submitQuiz = async () => {
    if (!topicDef) return;
    const durationSecs = Math.round((Date.now() - startTime) / 1000);
    const grading = gradeQuiz(questions, answers, durationSecs);
    const result = await savePracticeResult(uid, {
      subjectId, topicId, topic: topicName, questions: grading.resultQuestions,
      correctIndices: grading.correctIndices, score: grading.score, total: grading.total, accuracy: grading.accuracy, durationSecs,
    });
    setScore(grading.score);
    if (result) setMastery(result.mastery);
    setPhase('review');
  };

  const isAnswerCorrect = (i: number): boolean => {
    const a = answers[i];
    if (!a) return false;
    const q = questions[i];
    return normAnswer(a) === normAnswer(q.answer);
  };

  /** Re-quiz only the questions the student got wrong (mistakes are signals, not failures). */
  const retryMistakes = () => {
    const wrong = questions.filter((_, i) => !isAnswerCorrect(i));
    if (wrong.length === 0) return;
    setScore(0);
    beginQuiz(wrong);
  };

    if (!topicDef) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="text-center py-12">
          <p className="text-zinc-500 dark:text-zinc-400">No topic selected for practice.</p>
          <button onClick={() => navigate('/app/learn')} className="mt-4 text-blue-600 font-semibold">Browse topics</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <header className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-bold text-lg text-zinc-900 dark:text-white truncate">{topicName}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{subjectName}</p>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">
        {phase === 'instructions' && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <h2 className="font-semibold text-zinc-900 dark:text-white mb-1">Practice {topicName}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">
                {mastery ? `Your accuracy here is ${Math.round((mastery.accuracy || 0) * 100)}% (${masteryStatus}).` : 'You haven\'t practiced this topic yet.'}
              </p>
              {getMistakesForTopic(uid, topicId).length > 0 && (
                <button onClick={startMistakesReview} className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 font-medium text-xs">Review My Mistakes</button>
              )}
            </div>
            {quizError && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span className="flex-1">{quizError}</span>
              </div>
            )}
            {quizError && (
              <button onClick={() => startQuiz(5)} disabled={loadingQs} className="w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                <RefreshCw size={15} className={loadingQs ? 'animate-spin' : ''} /> Retry
              </button>
            )}
            <button onClick={() => startQuiz(5)} disabled={loadingQs} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors">
              {loadingQs ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />}
              {loadingQs ? 'Preparing your quiz…' : 'Start 5-question quiz'}
            </button>
            <button onClick={() => navigate('/app/study/' + subjectId)} className="w-full py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-blue-600 font-medium">
              ← Back to {subjectName} topics
            </button>
                    </div>
        )}

        {phase === 'quizzing' && (
          <div className="space-y-4">
            {questions.map((q, i) => {
              const picked = answers[i];
              return (
                <div key={q.id} className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 space-y-3">
                  <p className="font-medium text-sm text-zinc-900 dark:text-white">{i + 1}. {q.question}</p>
                  {q.options && q.options.length > 0 ? (
                    <div className="space-y-1.5">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setAnswers((a) => { const copy = [...a]; copy[i] = opt; return copy; })}
                          className={cn('w-full text-left px-3 py-2 rounded-lg border text-sm transition-all',
                            picked === opt ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200' : 'border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800')}
                        >{opt}</button>
                      ))}
                    </div>
                  ) : (
                    <input value={picked ?? ''} onChange={(e) => setAnswers((a) => { const copy = [...a]; copy[i] = e.target.value; return copy; })}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Type your answer…" />
                  )}
                </div>
              );
            })}
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-zinc-500">{selectedCount}/{questions.length} answered</span>
              <button onClick={submitQuiz} disabled={!canSubmit} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 transition-colors">Submit Quiz</button>
            </div>
          </div>
        )}

        {phase === 'review' && questions.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700 text-center">
              <h2 className="font-bold text-xl text-zinc-900 dark:text-white mb-1">Quiz complete</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">You scored <span className="font-bold">{score}</span> / {questions.length}</p>
              <p className="text-xs text-zinc-500 mt-1">{masteryStatus}</p>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => {
                const ok = isAnswerCorrect(i);
                return (
                  <div key={q.id} className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-start gap-2">
                      {ok ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />}
                      <div className="text-sm text-zinc-800 dark:text-zinc-200">
                        <p className="font-medium">{q.question}</p>
                        {!ok && <p className="mt-1 text-xs">Your answer: <span className="text-rose-600">{answers[i] ?? '—'}</span></p>}
                        <p className="mt-1 text-xs">Correct: <span className="text-emerald-600">{q.answer}</span></p>
                        {q.explanation && <p className="mt-1 italic">{q.explanation}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPhase('instructions')} className="flex-1 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium flex items-center justify-center gap-2">
                <RefreshCw size={16} /> Try again
              </button>
              <button onClick={() => navigate('/app/study/' + subjectId + '/' + topicId)} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-medium">
                Learn again
              </button>
            </div>
            {questions.some((_, i) => !isAnswerCorrect(i)) && (
              <button onClick={retryMistakes} className="w-full py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 font-semibold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/50">
                <XCircle size={15} /> Practice These Again
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
