import { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

export default function PreviousYearPapers() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
        <ArrowRight size={12} />
        <span className="text-zinc-900 dark:text-white">Previous Year Papers</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-amber-50 dark:bg-amber-950/30 rounded-full border border-amber-200/50 dark:border-amber-850">
          <BookOpen size={13} className="text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Exam Archive
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Previous Year <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">Papers</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Organized exam papers by board, class, subject, and year with AI-generated practice sets
        </p>
      </div>

      {/* Coming Soon Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-12"
      >
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-3xl flex items-center justify-center border border-amber-500/15">
            <BookOpen size={32} className="text-amber-600 dark:text-amber-400" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              Feature Under Development
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
              Previous Year Papers module is being expanded with comprehensive exam archives. Soon you'll get:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
                  Organized Archives
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Papers sorted by board, class, subject, and year
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
                  AI Practice Sets
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Generated practice sets from past papers
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
                  Pattern Analysis
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Understand exam patterns and trends
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-1">
                  Solution Guides
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Detailed solutions and explanations
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50 rounded-xl">
              <Clock size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}