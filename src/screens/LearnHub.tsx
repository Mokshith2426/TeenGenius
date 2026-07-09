import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { GraduationCap, FileText, Sparkles, BookOpen, ArrowRight, Calendar, Target } from 'lucide-react';

export default function LearnHub() {
  const navigate = useNavigate();

  const studyTools = [
    {
      title: "AI Tutor",
      desc: "Instant friendly explanations for any subject. Ask academic questions, draft study outlines, or practice language revisions in real-time.",
      path: "/app/ai-assistant",
      icon: Sparkles,
      color: "from-purple-550/15 via-indigo-500/10 to-indigo-500/5 text-purple-650 dark:text-purple-400 border-purple-500/15 shadow-purple-500/5",
      badge: "AI Help",
      badgeColor: "bg-purple-50 dark:bg-purple-950/40 text-purple-650 dark:text-purple-300"
    },
    {
      title: "Homework Solver",
      desc: "Step-by-step breakdown of mathematics, science formulae, and chemistry assignments. Pick a subject and get clear guidelines.",
      path: "/app/homework-solver",
      icon: GraduationCap,
      color: "from-blue-550/15 via-blue-500/10 to-indigo-500/5 text-blue-650 dark:text-blue-400 border-blue-500/15 shadow-blue-500/5",
      badge: "Solver Suite",
      badgeColor: "bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-300"
    },
    {
      title: "Notes Lab",
      desc: "Transform heavy documents, lecture slides, screenshots, and long textbook chapters into well-structured outlines, memory facts, and dynamic key takeaways.",
      path: "/app/notes",
      icon: FileText,
      color: "from-emerald-550/15 via-emerald-500/10 to-teal-500/5 text-emerald-650 dark:text-emerald-400 border-emerald-500/15 shadow-emerald-500/5",
      badge: "Notes",
      badgeColor: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-300"
    },
    {
      title: "Timetable Maker",
      desc: "Create healthy weekly planners, schedule classes, visualize dynamic exam blocks, and synchronize your daily student calendars.",
      path: "/app/timetable",
      icon: Calendar,
      color: "from-amber-550/15 via-amber-500/10 to-orange-500/5 text-amber-650 dark:text-amber-400 border-amber-500/15 shadow-amber-500/5",
      badge: "Planner",
      badgeColor: "bg-amber-50 dark:bg-amber-950/40 text-amber-650 dark:text-amber-300"
    },
    {
      title: "Focus Zone",
      desc: "Count focus intervals, launch timed Pomodoro cycles, play cozy lo-fi audio, and record your private concentration logs.",
      path: "/app/focus",
      icon: Target,
      color: "from-rose-550/15 via-rose-500/10 to-pink-500/5 text-rose-650 dark:text-rose-450 border-rose-500/15 shadow-rose-500/5",
      badge: "Deep Focus",
      badgeColor: "bg-rose-50 dark:bg-rose-955/40 text-rose-650 dark:text-rose-400"
    }
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto space-y-8 pb-32 animate-fade-in">
      {/* Header Intro */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 rounded-full border border-indigo-200/50 dark:border-indigo-850">
          <BookOpen size={13} className="text-indigo-650 dark:text-indigo-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Primary Learning Hub</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Active <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Learning Suite</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-450 font-medium leading-relaxed max-w-xl">
          Deploy deep-intelligence AI solvers to finish homework, structure chapter summaries, and revise concepts dynamically.
        </p>
      </div>

      {/* Primary Study Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {studyTools.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <motion.div
              key={index}
              whileHover={{ y: -6, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate(tool.path)}
              className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6.5 flex flex-col justify-between gap-8 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-800 transition-all shadow-sm hover:shadow-xl relative overflow-hidden group"
            >
              {/* Card top details */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  {/* Styled Icon */}
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tool.color} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon size={20} strokeWidth={2.4} />
                  </div>
                  
                  {/* Pill Badge */}
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${tool.badgeColor}`}>
                    {tool.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-black uppercase tracking-tight text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                    {tool.desc}
                  </p>
                </div>
              </div>

              {/* Action Button Label */}
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 group-hover:translate-x-1.5 transition-transform">
                <span>Access Tool</span>
                <ArrowRight size={13} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Decorative Wisdom Section */}
      <div className="mt-8 p-6.5 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-850 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">Continuous Growth Trackers Active</h4>
          <p className="text-[11px] text-zinc-450 dark:text-zinc-500 font-semibold leading-relaxed">Every focus session and answered question logs Growth Credits towards daily milestones.</p>
        </div>
        <button 
          onClick={() => navigate('/app')}
          className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 transition-all cursor-pointer whitespace-nowrap"
        >
          View Dashboard Progress
        </button>
      </div>
    </div>
  );
}
