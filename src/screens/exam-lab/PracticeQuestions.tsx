import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Brain, CheckCircle2, Clock, ArrowRight, Loader2, XCircle } from 'lucide-react';
import { safeFetch } from '../../lib/api';
import { addMistakeToBook } from './MistakeBook';

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface Quiz {
  questions: Question[];
}

export default function PracticeQuestions() {
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionType, setQuestionType] = useState('mcq');
  const [isLoading, setIsLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setQuiz(null);
    setSelectedAnswers([]);
    setShowResults(false);

    try {
      const prompt = `Generate exactly 5 ${difficulty} difficulty ${questionType} questions on ${subject}${chapter ? ` - Chapter: ${chapter}` : ''}. 
      
      For MCQ: Provide 4 options with one correct answer.
      For short answer: Provide brief answer prompts.
      For long answer: Provide detailed question prompts.
      
      OUTPUT FORMAT (JSON):
      {
        "questions": [
          {
            "question": "Question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswerIndex": 0,
            "explanation": "Detailed explanation of why this answer is correct"
          }
        ]
      }`;

      const response = await safeFetch('/api/ai/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: prompt })
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const data = await response.json();
      setQuiz(data);
      setSelectedAnswers(new Array(data.questions.length).fill(-1));
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    if (showResults) return;
    const newAnswers = [...selectedAnswers];
    newAnswers[questionIndex] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleSubmitAnswers = () => {
    setShowResults(true);
  };

  const calculateScore = () => {
    if (!quiz || !showResults) return 0;
    let correct = 0;
    quiz.questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correctAnswerIndex) {
        correct++;
      } else if (selectedAnswers[index] !== -1) {
        // Save incorrect answers to mistake book
        const userAnswerText = questionType === 'mcq' && q.options 
          ? q.options[selectedAnswers[index]] 
          : 'User answered';
        const correctAnswerText = questionType === 'mcq' && q.options
          ? q.options[q.correctAnswerIndex]
          : 'Correct answer';

        addMistakeToBook({
          question: q.question,
          userAnswer: userAnswerText,
          correctAnswer: correctAnswerText,
          explanation: q.explanation,
          subject: subject,
          topic: chapter || 'General'
        });
      }
    });
    return correct;
  };

  const resetQuiz = () => {
    setQuiz(null);
    setSelectedAnswers([]);
    setShowResults(false);
    setSubject('');
    setChapter('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
        <ArrowRight size={12} />
        <span className="text-zinc-900 dark:text-white">Practice Questions</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-full border border-emerald-200/50 dark:border-emerald-850">
          <Brain size={13} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            AI-Generated Questions
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Practice <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Questions</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Generate original AI questions by subject, chapter, difficulty with MCQs, short & long answers
        </p>
      </div>

      {/* Input Form */}
      {!quiz && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Physics"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Chapter (Optional)
                </label>
                <input
                  type="text"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                  placeholder="e.g., Chapter 3: Quadratic Equations"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Question Type
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="short">Short Answer</option>
                  <option value="long">Long Answer</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Brain size={18} />
                  Generate Questions
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}

      {/* Quiz Display */}
      {quiz && !showResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Practice Questions
              </h2>
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                {quiz.questions.length} Questions
              </span>
            </div>

            <div className="space-y-6">
              {quiz.questions.map((q, qIndex) => (
                <motion.div
                  key={qIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: qIndex * 0.1 }}
                  className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-xs font-black text-emerald-700 dark:text-emerald-400">
                      {qIndex + 1}
                    </span>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white leading-relaxed">
                      {q.question}
                    </p>
                  </div>

                  {questionType === 'mcq' && q.options && (
                    <div className="space-y-2 ml-11">
                      {q.options.map((option, oIndex) => (
                        <button
                          key={oIndex}
                          onClick={() => handleAnswerSelect(qIndex, oIndex)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                            selectedAnswers[qIndex] === oIndex
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                              : 'border-zinc-200 dark:border-zinc-700 hover:border-emerald-300'
                          }`}
                        >
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {String.fromCharCode(65 + oIndex)}. {option}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <button
              onClick={handleSubmitAnswers}
              disabled={selectedAnswers.some(a => a === -1)}
              className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Answers
            </button>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {showResults && quiz && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full mb-4">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {calculateScore()}/{quiz.questions.length}
                </span>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">
                Quiz Complete!
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You scored {Math.round((calculateScore() / quiz.questions.length) * 100)}%
              </p>
            </div>

            <div className="space-y-4">
              {quiz.questions.map((q, qIndex) => {
                const isCorrect = selectedAnswers[qIndex] === q.correctAnswerIndex;
                return (
                  <motion.div
                    key={qIndex}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: qIndex * 0.1 }}
                    className={`p-5 rounded-2xl border-2 ${
                      isCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {isCorrect ? (
                        <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white mb-2">
                          {q.question}
                        </p>
                        {questionType === 'mcq' && q.options && (
                          <div className="space-y-1 ml-4">
                            {q.options.map((option, oIndex) => (
                              <div
                                key={oIndex}
                                className={`text-xs ${
                                  oIndex === q.correctAnswerIndex
                                    ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                    : oIndex === selectedAnswers[qIndex] && !isCorrect
                                    ? 'text-red-700 dark:text-red-400 line-through'
                                    : 'text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {String.fromCharCode(65 + oIndex)}. {option}
                                {oIndex === q.correctAnswerIndex && ' ✓'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ml-8 p-3 bg-white dark:bg-zinc-900 rounded-lg">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        <span className="font-bold">Explanation:</span> {q.explanation}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={resetQuiz}
                className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-wider rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              >
                New Quiz
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}