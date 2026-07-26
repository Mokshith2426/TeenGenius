import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Target,
  Loader2,
  CheckCircle2,
  BookOpen,
  Brain,
  FileText,
  RefreshCw,
  Video,
  TrendingUp,
  Clock,
  Award,
  Sparkles
} from 'lucide-react';
import { safeFetch } from '../../lib/api';
import { addMistakeToBook } from './MistakeBook';

interface StudyPlanData {
  overview: string;
  schedule: { day: string; tasks: string[]; hours: string; focus: string }[];
  milestones: string[];
  tips: string[];
}

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface RevisionMaterial {
  title: string;
  content: string;
  type: 'formula' | 'concept' | 'tip' | 'summary';
}

interface Video {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  url: string;
  description: string;
}

interface ExamLabData {
  studyPlan: StudyPlanData | null;
  practiceQuestions: { questions: Question[] } | null;
  mockTest: { questions: Question[] } | null;
  revisionPack: { materials: RevisionMaterial[]; flashcards: { question: string; answer: string }[] } | null;
  videos: Video[] | null;
}

export default function UnifiedExamLab() {
  const [formData, setFormData] = useState({
    board: '',
    class: '',
    subject: '',
    examDate: '',
    dailyHours: '4',
    goal: '85'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [data, setData] = useState<ExamLabData>({
    studyPlan: null,
    practiceQuestions: null,
    mockTest: null,
    revisionPack: null,
    videos: null
  });

  const [activeQuiz, setActiveQuiz] = useState<{ type: 'practice' | 'mock'; answers: number[]; submitted: boolean } | null>(null);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setData({
      studyPlan: null,
      practiceQuestions: null,
      mockTest: null,
      revisionPack: null,
      videos: null
    });

    try {
      // Generate study plan
      setLoadingSection('plan');
      const planResponse = await safeFetch('/api/ai/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: [formData.subject],
          hoursPerDay: parseInt(formData.dailyHours),
          preferences: `Target score: ${formData.goal}%`,
          durationCategory: 'weekly',
          durationValue: '1_week',
          studentClass: formData.class,
          board: formData.board,
          stream: '',
          weakSubjects: '',
          strongSubjects: '',
          examDates: formData.examDate,
          goals: `Achieve ${formData.goal}% in ${formData.subject}`
        })
      });

      if (!planResponse.ok) throw new Error('Failed to generate study plan');
      const planData = await planResponse.json();

      const schedule = Object.entries(planData)
        .filter(([key]) => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(key))
        .map(([day, tasks]) => ({
          day,
          tasks: tasks as string[],
          hours: formData.dailyHours,
          focus: day === 'Monday' ? 'Core Concepts' : day === 'Tuesday' ? 'Practice Problems' : day === 'Wednesday' ? 'Revision' : day === 'Thursday' ? 'Mock Tests' : day === 'Friday' ? 'Weak Areas' : day === 'Saturday' ? 'Full Revision' : 'Assessment'
        }));

      setData(prev => ({
        ...prev,
        studyPlan: {
          overview: `Personalized study plan for ${formData.subject} (${formData.board} - Class ${formData.class}). Exam date: ${formData.examDate}. Daily study: ${formData.dailyHours} hours. Target: ${formData.goal}%`,
          schedule,
          milestones: [
            'Complete all daily tasks for Week 1',
            'Achieve 70% score in practice tests',
            'Master all weak areas identified',
            `Reach target score of ${formData.goal}% by ${formData.examDate}`
          ],
          tips: [
            'Study in focused 25-minute sessions with 5-minute breaks',
            'Review notes daily for better retention',
            'Practice previous year questions regularly',
            'Get adequate sleep before the exam'
          ]
        }
      }));

      // Generate practice questions
      setLoadingSection('practice');
      const practiceResponse = await safeFetch('/api/ai/practice-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          chapter: '',
          difficulty: 'medium',
          questionType: 'mcq'
        })
      });

      if (practiceResponse.ok) {
        const practiceData = await practiceResponse.json();
        setData(prev => ({ ...prev, practiceQuestions: practiceData }));
      }

      // Generate revision pack
      setLoadingSection('revision');
      const revisionResponse = await safeFetch('/api/ai/revision-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          topic: ''
        })
      });

      if (revisionResponse.ok) {
        const revisionData = await revisionResponse.json();
        setData(prev => ({ ...prev, revisionPack: revisionData }));
      }

      // Get video recommendations
      setLoadingSection('videos');
      const videosResponse = await safeFetch('/api/ai/learn-with-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formData.subject,
          topic: ''
        })
      });

      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        setData(prev => ({ ...prev, videos: videosData.videos || [] }));
      }

      setLoadingSection(null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate study plan. Please try again.');
      setLoadingSection(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = (type: 'practice' | 'mock') => {
    if (type === 'practice' && data.practiceQuestions) {
      setActiveQuiz({
        type,
        answers: new Array(data.practiceQuestions.questions.length).fill(-1),
        submitted: false
      });
    } else if (type === 'mock') {
      // Generate mock test on demand
      safeFetch('/api/ai/mock-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numQuestions: 10, subject: formData.subject })
      }).then(res => res.json()).then(mockData => {
        setData(prev => ({ ...prev, mockTest: mockData }));
        setActiveQuiz({
          type,
          answers: new Array(mockData.questions.length).fill(-1),
          submitted: false
        });
      });
    }
  };

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    if (!activeQuiz || activeQuiz.submitted) return;
    const newAnswers = [...activeQuiz.answers];
    newAnswers[questionIndex] = optionIndex;
    setActiveQuiz({ ...activeQuiz, answers: newAnswers });
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz) return;
    setActiveQuiz({ ...activeQuiz, submitted: true });

    // Save mistakes
    const questions = activeQuiz.type === 'practice' && data.practiceQuestions
      ? data.practiceQuestions.questions
      : activeQuiz.type === 'mock' && data.mockTest
      ? data.mockTest.questions
      : [];

    questions.forEach((q, index) => {
      if (activeQuiz.answers[index] !== q.correctAnswerIndex && activeQuiz.answers[index] !== -1) {
        addMistakeToBook({
          question: q.question,
          userAnswer: q.options[activeQuiz.answers[index]],
          correctAnswer: q.options[q.correctAnswerIndex],
          explanation: q.explanation,
          subject: formData.subject,
          topic: activeQuiz.type === 'practice' ? 'Practice Questions' : 'Mock Test'
        });
      }
    });
  };

  const calculateScore = () => {
    if (!activeQuiz || !activeQuiz.submitted) return 0;
    const questions = activeQuiz.type === 'practice' && data.practiceQuestions
      ? data.practiceQuestions.questions
      : activeQuiz.type === 'mock' && data.mockTest
      ? data.mockTest.questions
      : [];

    let correct = 0;
    questions.forEach((q, index) => {
      if (activeQuiz.answers[index] === q.correctAnswerIndex) correct++;
    });
    return correct;
  };

  const resetQuiz = () => {
    setActiveQuiz(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-full border border-indigo-200/50 dark:border-indigo-850">
          <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
            AI-Powered Preparation
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Let's prepare for your exam
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Tell me about your exam, and I'll create a complete study plan with practice questions, revision materials, and more.
        </p>
      </div>

      {/* Input Form */}
      {!data.studyPlan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <form onSubmit={handleGeneratePlan} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Board *
                </label>
                <input
                  type="text"
                  required
                  value={formData.board}
                  onChange={(e) => setFormData({ ...formData, board: e.target.value })}
                  placeholder="e.g., CBSE, ICSE, State Board"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Class *
                </label>
                <input
                  type="text"
                  required
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  placeholder="e.g., 10th, 12th"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Mathematics, Physics, Chemistry"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Exam Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.examDate}
                  onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Daily Study Hours
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={formData.dailyHours}
                  onChange={(e) => setFormData({ ...formData, dailyHours: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Target Score (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {loadingSection ? 'Generating...' : 'Preparing Your Study Plan...'}
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Study Plan
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}

      {/* AI Response Sections */}
      <AnimatePresence>
        {data.studyPlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Today's Plan */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center">
                  <Calendar size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                    Today's Study Plan
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Your personalized schedule</p>
                </div>
              </div>

              <div className="space-y-3">
                {data.studyPlan.schedule.slice(0, 3).map((day, index) => (
                  <div key={day.day} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
                          {day.day}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                          Focus: {day.focus} • {day.hours} hours
                        </p>
                        <ul className="space-y-1">
                          {day.tasks.slice(0, 3).map((task, taskIndex) => (
                            <li key={taskIndex} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                              <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chapters to Revise */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                    Chapters to Revise
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Priority topics for your exam</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.studyPlan.schedule.flatMap(day => day.tasks).slice(0, 6).map((task, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <Target size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{task}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Practice Questions */}
            {data.practiceQuestions && !activeQuiz && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center">
                      <Brain size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                        Practice Questions
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.practiceQuestions.questions.length} questions ready</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartQuiz('practice')}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-emerald-700 transition-all"
                  >
                    Start Practice
                  </button>
                </div>
              </div>
            )}

            {/* Active Quiz */}
            {activeQuiz && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                {!activeQuiz.submitted ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                        {activeQuiz.type === 'practice' ? 'Practice Questions' : 'Mini Mock Test'}
                      </h2>
                      <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                        {activeQuiz.answers.filter(a => a !== -1).length} / {activeQuiz.answers.length} answered
                      </span>
                    </div>

                    <div className="space-y-4">
                      {(activeQuiz.type === 'practice' && data.practiceQuestions ? data.practiceQuestions.questions :
                       activeQuiz.type === 'mock' && data.mockTest ? data.mockTest.questions : []).map((q, qIndex) => (
                        <div key={qIndex} className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-start gap-3 mb-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-xs font-black text-emerald-700 dark:text-emerald-400">
                              {qIndex + 1}
                            </span>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white leading-relaxed">
                              {q.question}
                            </p>
                          </div>

                          <div className="space-y-2 ml-11">
                            {q.options.map((option, oIndex) => (
                              <button
                                key={oIndex}
                                onClick={() => handleAnswerSelect(qIndex, oIndex)}
                                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                  activeQuiz.answers[qIndex] === oIndex
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
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSubmitQuiz}
                      disabled={activeQuiz.answers.some(a => a === -1)}
                      className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Answers
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 rounded-full mb-4">
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                          {calculateScore()}/{activeQuiz.answers.length}
                        </span>
                      </div>
                      <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">
                        Quiz Complete!
                      </h2>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        You scored {Math.round((calculateScore() / activeQuiz.answers.length) * 100)}%
                      </p>
                    </div>

                    <button
                      onClick={resetQuiz}
                      className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-wider rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                    >
                      Back to Study Plan
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mini Mock Test */}
            {!activeQuiz && !data.mockTest && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/30 rounded-xl flex items-center justify-center">
                      <FileText size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                        Mini Mock Test
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Test your knowledge</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartQuiz('mock')}
                    className="px-4 py-2 bg-purple-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-purple-700 transition-all"
                  >
                    Start Test
                  </button>
                </div>
              </div>
            )}

            {/* Revision Notes */}
            {data.revisionPack && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center">
                    <RefreshCw size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                      Revision Notes
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Key concepts and formulas</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {data.revisionPack.materials.slice(0, 4).map((material, index) => (
                    <div key={index} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">
                        {material.title}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
                        {material.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                    Your Progress
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Track your preparation</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Topics</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{data.studyPlan.schedule.length * 3}</p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Questions</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{data.practiceQuestions?.questions.length || 0}</p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Days Left</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">
                    {Math.max(1, Math.ceil((new Date(formData.examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                  </p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Goal</p>
                  <p className="text-2xl font-black text-zinc-900 dark:text-white">{formData.goal}%</p>
                </div>
              </div>
            </div>

            {/* Recommended Videos */}
            {data.videos && data.videos.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-fuchsia-50 dark:bg-fuchsia-950/30 rounded-xl flex items-center justify-center">
                    <Video size={20} className="text-fuchsia-600 dark:text-fuchsia-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                      Recommended Videos
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Learn from best resources</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.videos.slice(0, 4).map((video, index) => (
                    <a
                      key={video.id}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-fuchsia-300 dark:hover:border-fuchsia-700 transition-all"
                    >
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1 line-clamp-2 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{video.channel}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* New Plan Button */}
            <button
              onClick={() => {
                setData({
                  studyPlan: null,
                  practiceQuestions: null,
                  mockTest: null,
                  revisionPack: null,
                  videos: null
                });
                setFormData({
                  board: '',
                  class: '',
                  subject: '',
                  examDate: '',
                  dailyHours: '4',
                  goal: '85'
                });
              }}
              className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-wider rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              Create New Plan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}