import { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, Target, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { safeFetch } from '../../lib/api';

interface StudyDay {
  day: string;
  tasks: string[];
  hours: string;
  focus: string;
}

interface StudyPlan {
  overview: string;
  schedule: StudyDay[];
  milestones: string[];
  tips: string[];
}

export default function StudyPlanner() {
  const [formData, setFormData] = useState({
    board: '',
    class: '',
    subject: '',
    examDate: '',
    dailyHours: '4',
    targetScore: '85'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setStudyPlan(null);

    try {
      const response = await safeFetch('/api/ai/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects: [formData.subject],
          hoursPerDay: parseInt(formData.dailyHours),
          preferences: `Target score: ${formData.targetScore}%`,
          durationCategory: 'weekly',
          durationValue: '1_week',
          studentClass: formData.class,
          board: formData.board,
          stream: '',
          weakSubjects: '',
          strongSubjects: '',
          examDates: formData.examDate,
          goals: `Achieve ${formData.targetScore}% in ${formData.subject}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate study plan');
      }

      const data = await response.json();
      
      // Parse the timetable response into our format
      const schedule: StudyDay[] = [];
      const milestones: string[] = [];
      const tips: string[] = [];

      if (data.Monday) {
        schedule.push({ day: 'Monday', tasks: data.Monday, hours: formData.dailyHours, focus: 'Core Concepts' });
      }
      if (data.Tuesday) {
        schedule.push({ day: 'Tuesday', tasks: data.Tuesday, hours: formData.dailyHours, focus: 'Practice Problems' });
      }
      if (data.Wednesday) {
        schedule.push({ day: 'Wednesday', tasks: data.Wednesday, hours: formData.dailyHours, focus: 'Revision' });
      }
      if (data.Thursday) {
        schedule.push({ day: 'Thursday', tasks: data.Thursday, hours: formData.dailyHours, focus: 'Mock Tests' });
      }
      if (data.Friday) {
        schedule.push({ day: 'Friday', tasks: data.Friday, hours: formData.dailyHours, focus: 'Weak Areas' });
      }
      if (data.Saturday) {
        schedule.push({ day: 'Saturday', tasks: data.Saturday, hours: formData.dailyHours, focus: 'Full Revision' });
      }
      if (data.Sunday) {
        schedule.push({ day: 'Sunday', tasks: data.Sunday, hours: formData.dailyHours, focus: 'Assessment' });
      }

      milestones.push('Complete all daily tasks for Week 1');
      milestones.push('Achieve 70% score in practice tests');
      milestones.push('Master all weak areas identified');
      milestones.push(`Reach target score of ${formData.targetScore}% by ${formData.examDate}`);

      tips.push('Study in focused 25-minute sessions with 5-minute breaks');
      tips.push('Review notes daily for better retention');
      tips.push('Practice previous year questions regularly');
      tips.push('Get adequate sleep before the exam');

      setStudyPlan({
        overview: `Personalized study plan for ${formData.subject} (${formData.board} - Class ${formData.class}). Exam date: ${formData.examDate}. Daily study: ${formData.dailyHours} hours. Target: ${formData.targetScore}%`,
        schedule,
        milestones,
        tips
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate study plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
        <ArrowRight size={12} />
        <span className="text-zinc-900 dark:text-white">Study Planner</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-50 dark:bg-blue-950/30 rounded-full border border-blue-200/50 dark:border-blue-850">
          <Calendar size={13} className="text-blue-600 dark:text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
            AI-Powered Planning
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Study <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Planner</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Generate AI-powered revision schedules with daily tasks, milestones, and exam countdown
        </p>
      </div>

      {/* Input Form */}
      {!studyPlan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  value={formData.targetScore}
                  onChange={(e) => setFormData({ ...formData, targetScore: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Target size={18} />
                  Generate Study Plan
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}

      {/* Study Plan Results */}
      {studyPlan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Overview */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-4">
              Study Plan Overview
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {studyPlan.overview}
            </p>
          </div>

          {/* Daily Schedule */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-6">
              Weekly Schedule
            </h2>
            <div className="space-y-4">
              {studyPlan.schedule.map((day, index) => (
                <motion.div
                  key={day.day}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl flex items-center justify-center border border-blue-500/15">
                      <span className="text-xs font-black text-blue-700 dark:text-blue-400 text-center leading-tight">
                        {day.day.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
                        {day.day}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                        Focus: {day.focus} • {day.hours} hours
                      </p>
                      <ul className="space-y-1">
                        {day.tasks.map((task, taskIndex) => (
                          <li key={taskIndex} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-4">
              Milestones
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {studyPlan.milestones.map((milestone, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <Target size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{milestone}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-4">
              Study Tips
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {studyPlan.tips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={() => setStudyPlan(null)}
            className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-wider rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
          >
            Create New Plan
          </button>
        </motion.div>
      )}
    </div>
  );
}