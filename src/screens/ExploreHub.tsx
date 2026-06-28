import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, 
  GraduationCap, 
  FileText, 
  Brain, 
  Calendar, 
  Target, 
  Map, 
  Users, 
  UserPlus, 
  ShieldAlert, 
  HeartHandshake,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function ExploreHub() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState<'tools' | 'discover'>('tools');

  const studyTools = [
    {
      title: "Homework Solver",
      desc: "Instant breakdown of complex algebra, science questions, and history worksheets with step-by-step guidance.",
      path: "/app/homework-solver",
      icon: GraduationCap,
      color: "from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
      badge: "AI Helper"
    },
    {
      title: "Notes",
      desc: "Convert text, articles, or notes into concise structured summaries, highlight keys terms, and study guide lists.",
      path: "/app/notes",
      icon: FileText,
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15",
      badge: "Summarizer"
    },
    {
      title: "Timetable & Planner",
      desc: "Plot classes, exams, homework slots, extra-curriculars and map an organized day with ease.",
      path: "/app/timetable",
      icon: Calendar,
      color: "from-cyan-500/10 to-sky-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/15",
      badge: "Planner"
    },
    {
      title: "Flashcards",
      desc: "Develop custom flashcards and diagnostic tests based on your study topics for high school revision.",
      path: "/app/memory-lab",
      icon: Brain,
      color: "from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border-purple-500/15",
      badge: "Flashcards"
    },
    {
      title: "Roadmap Architect",
      desc: "Build professional educational roadmaps to master modern programming languages, AI, digital arts, or academic careers.",
      path: "/app/roadmap",
      icon: Map,
      color: "from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15",
      badge: "Roadmaps"
    },
    {
      title: "Focus Zone",
      desc: "Enter serene, custom study sessions with focus trackers, timers, achievements, and beautiful high-fidelity soundscapes.",
      path: "/app/focus",
      icon: Target,
      color: "from-rose-500/10 to-orange-500/10 text-rose-600 dark:text-rose-400 border-rose-500/15",
      badge: "Timer"
    },
    {
      title: "Safety Hub",
      desc: "Learn about online safety, data privacy, avoiding cyber scams, cyberbullies, and mental wellbeing advice.",
      path: "/app/safety",
      icon: ShieldAlert,
      color: "from-red-500/10 to-rose-500/10 text-red-600 dark:text-red-400 border-red-500/15",
      badge: "Wellbeing"
    }
  ];

  const exploreRoutes = [
    {
      title: "Study Groups",
      desc: "Join school peer study circles, discuss textbook topics, chat about exams, and share resources.",
      path: "/app/study-groups",
      icon: Users,
      color: "from-fuchsia-500/10 to-purple-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/15",
      badge: "Study Groups"
    },
    {
      title: "Friends",
      desc: "Connect with classmates, share homework reviews, message friends, and build helpful student communities.",
      path: "/app/friends",
      icon: UserPlus,
      color: "from-blue-500/10 to-teal-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
      badge: "Friends"
    },
    {
      title: "Share Feedback",
      desc: "Help support TeenGenius! Share design suggestions, feature checklists, or request student solutions.",
      path: "/app/feedback",
      icon: HeartHandshake,
      color: "from-sky-505/10 to-cyan-505/10 text-sky-600 dark:text-sky-400 border-sky-505/15",
      badge: "Co-creation"
    }
  ];

  const currentList = activeMenu === 'tools' ? studyTools : exploreRoutes;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto space-y-8 pb-32">
      {/* Header Banner */}
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 select-none">
          <LayoutGrid size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-650 dark:text-zinc-350">STUDENT UTILITIES &amp; TOOLS HUB</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
            TeenGenius <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-indigo-650 bg-clip-text text-transparent">Tools</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
            A unified suite of learning aids, focus engines, study groups, planning modules, and productivity assistants.
          </p>
        </div>
      </header>

      {/* Styled Segmented Control (Toggle) */}
      <div className="flex bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 p-1 rounded-2xl w-full sm:w-fit cursor-pointer relative select-none">
        <button
          onClick={() => setActiveMenu('tools')}
          className={cn(
            "flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeMenu === 'tools'
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md shadow-zinc-200/40 dark:shadow-none"
              : "text-zinc-400 dark:text-zinc-550 hover:text-zinc-600 dark:hover:text-zinc-400"
          )}
        >
          <BookOpen size={15} />
          <span>Study Tools</span>
        </button>
        <button
          onClick={() => setActiveMenu('discover')}
          className={cn(
            "flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeMenu === 'discover'
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md shadow-zinc-200/40 dark:shadow-none"
              : "text-zinc-400 dark:text-zinc-550 hover:text-zinc-600 dark:hover:text-zinc-400"
          )}
        >
          <Users size={15} />
          <span>Ecosystem & Circles</span>
        </button>
      </div>

      {/* Unified Cards Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMenu}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {currentList.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                onClick={() => navigate(item.path)}
                className="bg-white dark:bg-zinc-900/60 border border-zinc-150 dark:border-zinc-800 hover:border-blue-500/40 dark:hover:border-blue-500/30 rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6 cursor-pointer transition-all hover:shadow-[0_12px_24px_rgba(0,0,0,0.02)] active:scale-[0.985] group select-none relative overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    {/* Styled Icon Container */}
                    <div className={cn(
                      "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0",
                      item.color
                    )}>
                      <Icon size={20} strokeWidth={2.4} />
                    </div>

                    {/* Badge Pill */}
                    <span className="text-[9px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-805 px-3 py-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 border border-zinc-200/20 dark:border-zinc-800">
                      {item.badge}
                    </span>
                  </div>

                  {/* Descriptions */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-zinc-450 dark:text-zinc-500 font-medium">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* Inline Action Indicator */}
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 pt-2 group-hover:translate-x-1 transition-transform">
                  <span className="text-[10px] tracking-widest uppercase">Launch Hub</span>
                  <ArrowRight size={12} className="text-zinc-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
