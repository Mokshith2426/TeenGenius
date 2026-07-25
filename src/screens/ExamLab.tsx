import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Calendar,
  FileText,
  Brain,
  BookOpen,
  BarChart3,
  XCircle,
  RefreshCw,
  Play,
  Clock,
  Target,
  Award,
  TrendingUp,
  Video
} from 'lucide-react';

export default function ExamLab() {
  const navigate = useNavigate();

  const examModules = [
    {
      title: "Study Planner",
      desc: "Generate AI-powered revision schedules with daily tasks, milestones, and exam countdown",
      path: "/app/exam-lab/study-planner",
      icon: Calendar,
      color: "from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
      badge: "Planner",
      badgeColor: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300"
    },
    {
      title: "Mock Tests",
      desc: "CBT-style interface with timer, question palette, auto-save, and detailed evaluation",
      path: "/app/exam-lab/mock-tests",
      icon: FileText,
      color: "from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border-purple-500/15",
      badge: "CBT Mode",
      badgeColor: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300"
    },
    {
      title: "Practice Questions",
      desc: "Generate original AI questions by subject, chapter, difficulty with MCQs, short & long answers",
      path: "/app/exam-lab/practice-questions",
      icon: Brain,
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15",
      badge: "Practice",
      badgeColor: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300"
    },
    {
      title: "Previous Year Papers",
      desc: "Organized exam papers by board, class, subject, and year with AI-generated practice sets",
      path: "/app/exam-lab/previous-papers",
      icon: BookOpen,
      color: "from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15",
      badge: "Papers",
      badgeColor: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300"
    },
    {
      title: "Performance Dashboard",
      desc: "Track scores, weak chapters, strong areas, tests completed, and revision progress",
      path: "/app/exam-lab/performance",
      icon: BarChart3,
      color: "from-rose-500/10 to-pink-500/10 text-rose-600 dark:text-rose-400 border-rose-500/15",
      badge: "Analytics",
      badgeColor: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300"
    },
    {
      title: "Mistake Book",
      desc: "Automatically saved incorrect answers with explanations, concepts tested, and revision tips",
      path: "/app/exam-lab/mistakes",
      icon: XCircle,
      color: "from-red-500/10 to-rose-500/10 text-red-600 dark:text-red-400 border-red-500/15",
      badge: "Review",
      badgeColor: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300"
    },
    {
      title: "Revision Pack",
      desc: "AI-generated formula sheets, quick notes, important concepts, and flashcards from mistakes",
      path: "/app/exam-lab/revision-pack",
      icon: RefreshCw,
      color: "from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/15",
      badge: "Revision",
      badgeColor: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300"
    },
    {
      title: "Learn with Videos",
      desc: "Curated educational YouTube videos recommended based on your weak areas and topics",
      path: "/app/exam-lab/videos",
      icon: Video,
      color: "from-fuchsia-500/10 to-pink-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/15",
      badge: "Videos",
      badgeColor: "bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-300"
    }
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto space-y-8 pb-32 animate-fade-in">
      {/* Header Intro */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 rounded-full border border-indigo-200/50 dark:border-indigo-850">
          <Target size={13} className="text-indigo-650 dark:text-indigo-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Exam Preparation Suite</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Exam <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Lab</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-450 font-medium leading-relaxed max-w-xl">
          Prepare smarter for your exams with AI-powered practice tests, smart revision packs, and personalized study planning.
        </p>
      </div>

      {/* Exam Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {examModules.map((module, index) => {
          const Icon = module.icon;
          return (
            <motion.div
              key={index}
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate(module.path)}
              className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6.5 flex flex-col justify-between gap-8 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-800 transition-all shadow-sm hover:shadow-xl relative overflow-hidden group"
            >
              {/* Card top details */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  {/* Styled Icon */}
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${module.color} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon size={20} strokeWidth={2.4} />
                  </div>

                  {/* Pill Badge */}
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${module.badgeColor}`}>
                    {module.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-black uppercase tracking-tight text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                    {module.desc}
                  </p>
                </div>
              </div>

              {/* Action Button Label */}
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 group-hover:translate-x-1.5 transition-transform">
                <span>Launch Module</span>
                <Play size={13} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Decorative Stats Section */}
      <div className="mt-8 p-6.5 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Smart Exam Preparation</h4>
          <p className="text-[11px] text-zinc-450 dark:text-zinc-500 font-semibold leading-relaxed">AI-powered practice tests, adaptive learning, and personalized revision strategies to help you ace your exams.</p>
        </div>
        <button
          onClick={() => navigate('/app')}
          className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 transition-all cursor-pointer whitespace-nowrap"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}