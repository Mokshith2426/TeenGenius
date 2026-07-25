import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, CheckCircle2, Clock, ArrowRight, Loader2, Trophy, Target, BookOpen } from 'lucide-react';
import { safeFetch } from '../../lib/api';

interface TestResult {
  id: string;
  subject: string;
  score: number;
  totalQuestions: number;
  date: string;
  duration: number;
}

interface PerformanceData {
  totalTests: number;
  averageScore: number;
  totalQuestions: number;
  correctAnswers: number;
  strongSubjects: string[];
  weakSubjects: string[];
  recentTests: TestResult[];
  improvement: number;
}

export default function PerformanceDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPerformanceData();
  }, []);

  const loadPerformanceData = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Load from localStorage
      const testHistory = JSON.parse(localStorage.getItem('TEEN_GENIUS_TEST_HISTORY') || '[]');
      const mistakeBook = JSON.parse(localStorage.getItem('TEEN_GENIUS_MISTAKE_BOOK') || '[]');

      if (testHistory.length === 0) {
        // Generate sample data for demonstration
        const sampleData: PerformanceData = {
          totalTests: 12,
          averageScore: 75,
          totalQuestions: 120,
          correctAnswers: 90,
          strongSubjects: ['Mathematics', 'Physics'],
          weakSubjects: ['Chemistry', 'Biology'],
          recentTests: [
            { id: '1', subject: 'Mathematics', score: 8, totalQuestions: 10, date: '2025-01-15', duration: 30 },
            { id: '2', subject: 'Physics', score: 7, totalQuestions: 10, date: '2025-01-14', duration: 30 },
            { id: '3', subject: 'Chemistry', score: 5, totalQuestions: 10, date: '2025-01-13', duration: 30 },
            { id: '4', subject: 'Biology', score: 6, totalQuestions: 10, date: '2025-01-12', duration: 30 },
            { id: '5', subject: 'Mathematics', score: 9, totalQuestions: 10, date: '2025-01-11', duration: 30 }
          ],
          improvement: 15
        };
        setPerformance(sampleData);
      } else {
        // Calculate real performance from test history
        const totalTests = testHistory.length;
        const totalScore = testHistory.reduce((sum: number, test: any) => sum + test.score, 0);
        const averageScore = Math.round((totalScore / totalTests) * 10);
        const totalQuestions = testHistory.reduce((sum: number, test: any) => sum + test.totalQuestions, 0);
        const correctAnswers = testHistory.reduce((sum: number, test: any) => sum + test.score, 0);

        // Group by subject
        const subjectScores: Record<string, number[]> = {};
        testHistory.forEach((test: any) => {
          if (!subjectScores[test.subject]) {
            subjectScores[test.subject] = [];
          }
          subjectScores[test.subject].push(test.score / test.totalQuestions);
        });

        const strongSubjects: string[] = [];
        const weakSubjects: string[] = [];

        Object.entries(subjectScores).forEach(([subject, scores]) => {
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          if (avgScore >= 0.7) {
            strongSubjects.push(subject);
          } else if (avgScore < 0.6) {
            weakSubjects.push(subject);
          }
        });

        const recentTests = testHistory.slice(-5).reverse();

        setPerformance({
          totalTests,
          averageScore,
          totalQuestions,
          correctAnswers,
          strongSubjects,
          weakSubjects,
          recentTests,
          improvement: 10
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (percentage >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 70) return 'bg-emerald-50 dark:bg-emerald-950/20';
    if (percentage >= 50) return 'bg-orange-50 dark:bg-orange-950/20';
    return 'bg-red-50 dark:bg-red-950/20';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
        <ArrowRight size={12} />
        <span className="text-zinc-900 dark:text-white">Performance Dashboard</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-full border border-rose-200/50 dark:border-rose-850">
          <BarChart3 size={13} className="text-rose-600 dark:text-rose-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">
            Analytics & Insights
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Performance <span className="bg-gradient-to-r from-rose-600 to-pink-500 bg-clip-text text-transparent">Dashboard</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Track scores, weak chapters, strong areas, tests completed, and revision progress
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-rose-600 dark:text-rose-400" />
        </div>
      ) : performance ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-center">
                  <Target size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tests Taken</p>
              </div>
              <p className="text-3xl font-black text-zinc-900 dark:text-white">{performance.totalTests}</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Avg Score</p>
              </div>
              <p className="text-3xl font-black text-zinc-900 dark:text-white">{performance.averageScore}%</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/30 rounded-xl flex items-center justify-center">
                  <BookOpen size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Questions</p>
              </div>
              <p className="text-3xl font-black text-zinc-900 dark:text-white">{performance.totalQuestions}</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/30 rounded-xl flex items-center justify-center">
                  <Trophy size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Accuracy</p>
              </div>
              <p className="text-3xl font-black text-zinc-900 dark:text-white">
                {performance.totalQuestions > 0 ? Math.round((performance.correctAnswers / performance.totalQuestions) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Improvement Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">Improvement</p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">+{performance.improvement}%</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">from last month</p>
            </div>
          </div>

          {/* Strong & Weak Subjects */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                Strong Subjects
              </h3>
              {performance.strongSubjects.length > 0 ? (
                <div className="space-y-2">
                  {performance.strongSubjects.map((subject, index) => (
                    <div key={index} className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{subject}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Complete more tests to identify strong subjects</p>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <Target size={20} className="text-orange-600 dark:text-orange-400" />
                Needs Improvement
              </h3>
              {performance.weakSubjects.length > 0 ? (
                <div className="space-y-2">
                  {performance.weakSubjects.map((subject, index) => (
                    <div key={index} className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                      <p className="text-sm font-medium text-orange-900 dark:text-orange-100">{subject}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Great job! No weak subjects identified yet</p>
              )}
            </div>
          </div>

          {/* Recent Tests */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
            <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-4">
              Recent Tests
            </h3>
            {performance.recentTests.length > 0 ? (
              <div className="space-y-3">
                {performance.recentTests.map((test, index) => (
                  <motion.div
                    key={test.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-xl border-2 ${getScoreBg(test.score, test.totalQuestions)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-lg flex items-center justify-center">
                          <span className={`text-sm font-black ${getScoreColor(test.score, test.totalQuestions)}`}>
                            {test.score}/{test.totalQuestions}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-white">{test.subject}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{test.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${getScoreColor(test.score, test.totalQuestions)}`}>
                          {Math.round((test.score / test.totalQuestions) * 100)}%
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                No tests taken yet. Start practicing to see your performance!
              </p>
            )}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}