import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Clock, CheckCircle2, ArrowRight, Loader2, XCircle, Play } from 'lucide-react';
import { safeFetch } from '../../lib/api';
import { addMistakeToBook } from './MistakeBook';

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface MockTest {
  questions: Question[];
  subject: string;
  duration: number;
}

export default function MockTests() {
  const [subject, setSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState('10');
  const [duration, setDuration] = useState('30');
  const [isLoading, setIsLoading] = useState(false);
  const [test, setTest] = useState<MockTest | null>(null);
  const [error, setError] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);

  useEffect(() => {
    if (testStarted && !testSubmitted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [testStarted, testSubmitted, timeLeft]);

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setTest(null);

    try {
      const prompt = `Generate exactly ${numQuestions} multiple choice questions for a mock test on ${subject}. 
      
      Make it a comprehensive test covering various topics within ${subject}.
      Ensure questions are of mixed difficulty (easy, medium, hard).
      
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
        throw new Error('Failed to create mock test');
      }

      const data = await response.json();
      setTest({
        questions: data.questions,
        subject,
        duration: parseInt(duration) * 60
      });
      setSelectedAnswers(new Array(data.questions.length).fill(-1));
    } catch (err: any) {
      setError(err.message || 'Failed to create mock test. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTest = () => {
    if (!test) return;
    setTimeLeft(test.duration);
    setTestStarted(true);
    setCurrentQuestion(0);
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (testSubmitted) return;
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleSubmitTest = () => {
    setTestSubmitted(true);
  };

  const calculateScore = () => {
    if (!test || !testSubmitted) return 0;
    let correct = 0;
    test.questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correctAnswerIndex) {
        correct++;
      } else if (selectedAnswers[index] !== -1) {
        // Save incorrect answers to mistake book
        const userAnswerText = q.options[selectedAnswers[index]];
        const correctAnswerText = q.options[q.correctAnswerIndex];

        addMistakeToBook({
          question: q.question,
          userAnswer: userAnswerText,
          correctAnswer: correctAnswerText,
          explanation: q.explanation,
          subject: test.subject,
          topic: 'Mock Test'
        });
      }
    });
    return correct;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTest = () => {
    setTest(null);
    setSelectedAnswers([]);
    setCurrentQuestion(0);
    setTimeLeft(0);
    setTestStarted(false);
    setTestSubmitted(false);
    setSubject('');
  };

  // Test Creation Form
  if (!test) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
          <ArrowRight size={12} />
          <span className="text-zinc-900 dark:text-white">Mock Tests</span>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-purple-50 dark:bg-purple-950/30 rounded-full border border-purple-200/50 dark:border-purple-850">
            <FileText size={13} className="text-purple-600 dark:text-purple-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400">
              CBT-Style Interface
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
            Mock <span className="bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Tests</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
            CBT-style interface with timer, question palette, auto-save, and detailed evaluation
          </p>
        </div>

        {/* Test Creation Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <form onSubmit={handleCreateTest} className="space-y-5">
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
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Number of Questions
                </label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="5">5 Questions</option>
                  <option value="10">10 Questions</option>
                  <option value="15">15 Questions</option>
                  <option value="20">20 Questions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Duration (minutes)
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
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
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating Test...
                </>
              ) : (
                <>
                  <FileText size={18} />
                  Create Mock Test
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Test Ready to Start
  if (test && !testStarted) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
          <ArrowRight size={12} />
          <span className="text-zinc-900 dark:text-white">Mock Tests</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full">
              <FileText size={40} className="text-purple-600 dark:text-purple-400" />
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">
                {test.subject} Mock Test
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {test.questions.length} Questions • {duration} Minutes
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Questions</p>
                <p className="text-2xl font-black text-zinc-900 dark:text-white">{test.questions.length}</p>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Duration</p>
                <p className="text-2xl font-black text-zinc-900 dark:text-white">{duration} min</p>
              </div>
            </div>

            <button
              onClick={handleStartTest}
              className="w-full max-w-md mx-auto py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Start Test
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Test in Progress
  if (test && testStarted && !testSubmitted) {
    const question = test.questions[currentQuestion];
    const answered = selectedAnswers[currentQuestion] !== -1;

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header with Timer */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              {test.subject} Mock Test
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Question {currentQuestion + 1} of {test.questions.length}
            </p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
            timeLeft < 60 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-zinc-50 dark:bg-zinc-800/50'
          }`}>
            <Clock size={16} className={timeLeft < 60 ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'} />
            <span className={`text-sm font-black ${
              timeLeft < 60 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'
            }`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Question */}
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <div className="flex items-start gap-3 mb-6">
            <span className="flex-shrink-0 w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center text-sm font-black text-purple-700 dark:text-purple-400">
              {currentQuestion + 1}
            </span>
            <p className="text-base font-medium text-zinc-900 dark:text-white leading-relaxed">
              {question.question}
            </p>
          </div>

          <div className="space-y-3 ml-13">
            {question.options.map((option, oIndex) => (
              <button
                key={oIndex}
                onClick={() => handleAnswerSelect(oIndex)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  selectedAnswers[currentQuestion] === oIndex
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-purple-300'
                }`}
              >
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {String.fromCharCode(65 + oIndex)}. {option}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-wider rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {currentQuestion < test.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestion(prev => Math.min(test.questions.length - 1, prev + 1))}
              className="flex-1 py-3 bg-purple-600 text-white font-black uppercase tracking-wider rounded-xl hover:bg-purple-700 transition-all"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmitTest}
              disabled={!answered}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Test
            </button>
          )}
        </div>
      </div>
    );
  }

  // Test Results
  if (test && testSubmitted) {
    const score = calculateScore();
    const percentage = Math.round((score / test.questions.length) * 100);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
          <ArrowRight size={12} />
          <span className="text-zinc-900 dark:text-white">Mock Tests</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 ${
              percentage >= 70 ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-orange-50 dark:bg-orange-950/20'
            }`}>
              <span className={`text-4xl font-black ${
                percentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {percentage}%
              </span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">
              Test Complete!
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You scored {score} out of {test.questions.length}
            </p>
          </div>

          <div className="space-y-4">
            {test.questions.map((q, qIndex) => {
              const isCorrect = selectedAnswers[qIndex] === q.correctAnswerIndex;
              return (
                <motion.div
                  key={qIndex}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: qIndex * 0.05 }}
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

          <button
            onClick={resetTest}
            className="w-full mt-6 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-wider rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
          >
            Create New Test
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
}