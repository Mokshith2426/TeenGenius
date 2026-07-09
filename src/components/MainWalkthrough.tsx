import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Bot, GraduationCap, Brain, Calendar, Target,
  BookOpen, ChevronRight, ChevronLeft, X, Check, ArrowRight, AppWindow
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { trackEvent } from '../lib/analytics';

interface MainWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MainWalkthrough({ isOpen, onClose }: MainWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  // Reset step when modal opens & register event trigger
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      trackEvent('onboarding_start');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const steps = [
    {
      title: "Welcome to TeenGenius",
      badge: "Getting Started",
      tagline: "Your AI-powered study companion",
      description: "TeenGenius is designed to help students learn faster, revise smarter, and perform exceptionally in school and exams. Organize your notes, practice quizzes, and complete assignments seamlessly.",
      icon: Sparkles,
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      gradient: "from-blue-650 via-indigo-600 to-cyan-500"
    },
    {
      title: "AI Study Assistant",
      badge: "Instant Doubts Solver",
      tagline: "Explain concepts, solve doubts instantly",
      description: "Stuck on a tricky math equation or science concept? Our advanced tutor is operational 24/7. Ask academic questions, snap photos of homework, and get custom interactive step-by-step guidance.",
      icon: Bot,
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      gradient: "from-emerald-500 via-teal-600 to-blue-500"
    },
    {
      title: "Complete Student Study Tools",
      badge: "Study Headquarters",
      tagline: "Explore Notes, Quizzes, Flashcards & Timetables",
      description: "Everything you need to conquer your curriculum is at your fingertips. Instantly compile notes into summaries, generate revision notes, practice with smart AI quizzes, study flashcards, and track your learning milestones dynamically.",
      icon: GraduationCap,
      iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      gradient: "from-purple-500 via-pink-600 to-indigo-505"
    },
    {
      title: "Smarter Personalized Learning",
      badge: "Adaptive Analytics",
      tagline: "Personalized exam preparation",
      description: "Your dashboard evaluates your progress dynamically to optimize schedules and calendars around your weak spots. Set your daily studying targets, maintain active streaks, and watch your school performance soar.",
      icon: Target,
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      gradient: "from-rose-500 via-orange-650 to-amber-500"
    },
    {
      title: "Ready to Rocket?",
      badge: "Interactive Launchpad",
      tagline: "Get started with interactive suggestions",
      description: "Select one of the interactive student prompts below to immediately initiate a learning session with our Gemini AI Companion, or complete the walkthrough to head straight to your dashboard.",
      icon: BookOpen,
      iconBg: "bg-indigo-505/10 text-indigo-600 dark:text-indigo-400",
      gradient: "from-indigo-600 via-blue-600 to-cyan-500"
    }
  ];

  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('TEENGENIUS_MAIN_WALKTHROUGH_COMPLETED_v2', 'true');
    trackEvent('onboarding_complete');
    onClose();
  };

  const handlePromptClick = (prompt: string) => {
    localStorage.setItem('TEENGENIUS_MAIN_WALKTHROUGH_COMPLETED_v2', 'true');
    trackEvent('onboarding_complete');
    trackEvent('use_study_tool', { toolName: prompt });
    onClose();
    navigate('/app/ai-assistant', { state: { initialPrompt: prompt } });
  };

  const starterPrompts = [
    "Explain Newton's Laws",
    "Quiz me on Class 10 Mathematics",
    "Create a study plan for Science",
    "Summarize this chapter",
    "Help me prepare for tomorrow's test",
    "Generate revision notes"
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-x-hidden md:p-6">
        {/* Deep Translucent Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          exit={{ opacity: 0 }}
          onClick={handleComplete}
          className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md"
        />

        {/* Modal Sheet container */}
        <motion.div
          initial={{ scale: 0.95, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 30, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2rem] sm:rounded-[2.8rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Top colored aesthetic progress bar header */}
          <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 relative">
            <motion.div 
              className={cn("absolute left-0 top-0 bottom-0 bg-gradient-to-r", currentStepData.gradient)}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Close & Skip header panel */}
          <div className="p-6 pb-2 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className={cn("text-[9px] font-black uppercase tracking-[0.25em] text-white px-3.5 py-1 rounded-full bg-gradient-to-r shadow-xs", currentStepData.gradient)}>
                {currentStepData.badge}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={handleComplete}
              className="text-xs font-black uppercase tracking-wider text-zinc-450 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-350 transition-colors px-3 py-1 bg-zinc-55 dark:bg-zinc-850 hover:bg-zinc-100 rounded-lg"
            >
              Skip
            </button>
          </div>

          {/* Core walkthrough presentation block */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 md:space-y-8 scrollbar-hide">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Visual Icon Badge */}
                <div className="flex items-center gap-5 sm:gap-6">
                  <div className={cn("w-16 h-16 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center shadow-inner", currentStepData.iconBg)}>
                    <StepIcon size={32} strokeWidth={1.8} />
                  </div>
                  <div className="space-y-1">
                    <h2 className={cn("text-2xl sm:text-3xl font-black uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r", currentStepData.gradient)}>
                      {currentStepData.title}
                    </h2>
                    <p className="text-xs sm:text-sm font-extrabold text-zinc-650 dark:text-zinc-300 italic">
                      &ldquo;{currentStepData.tagline}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Body Details description text */}
                <p className="text-sm text-zinc-560 dark:text-zinc-400 font-semibold leading-relaxed">
                  {currentStepData.description}
                </p>

                {/* Simulated visual state representation or helper cards */}
                {currentStep === 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800 text-center space-y-1">
                      <span className="text-xl">👩‍🎓</span>
                      <p className="text-[10px] font-black text-zinc-800 dark:text-white uppercase">Learn Faster</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800 text-center space-y-1">
                      <span className="text-xl">⚡</span>
                      <p className="text-[10px] font-black text-zinc-800 dark:text-white uppercase">Revise Smarter</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800 text-center space-y-1">
                      <span className="text-xl">🏆</span>
                      <p className="text-[10px] font-black text-zinc-800 dark:text-white uppercase">Ace Exams</p>
                    </div>
                  </div>
                )}

                {currentStep === 1 && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex items-start gap-3.5 shadow-inner">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0 text-emerald-650 dark:text-emerald-400">
                      <Bot size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200">Interactive Doubt Clearing</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-450 mt-1 font-semibold leading-relaxed">
                        Never worry about confusing textbooks. Our tutor can explain topics instantly as if they are tailored to your unique age category with standard diagrams or quizzes.
                      </p>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-purple-500/10 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
                        <GraduationCap size={15} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300">Homework Solver</span>
                    </div>
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <Brain size={15} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300">Revision Quizzes</span>
                    </div>
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-emerald-505/10 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                        <Calendar size={15} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300">Timetable Maker</span>
                    </div>
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-rose-500/10 text-rose-600 rounded-lg flex items-center justify-center shrink-0">
                        <Target size={15} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-zinc-700 dark:text-zinc-300">Focus Zones</span>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-2.5rem border-l-4 border-l-rose-500 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Student Growth Status</p>
                      <p className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200">Earn Badges & Build Learning Streaks</p>
                    </div>
                    <span className="text-xs bg-rose-500 text-white font-black uppercase px-3.5 py-1.5 rounded-full select-none shadow-sm animate-pulse">
                      🎖️ Activate Streak
                    </span>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center mb-1">
                      Choose a study option below to launch immediately
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto">
                      {starterPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handlePromptClick(prompt)}
                          className="text-left py-3 px-4 rounded-xl border border-zinc-150 hover:border-blue-500 dark:border-zinc-800 bg-zinc-50 hover:bg-blue-50/10 dark:bg-zinc-950/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 group flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 transition-colors leading-relaxed">
                            {prompt}
                          </span>
                          <ArrowRight size={12} className="text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0 ml-1.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Footer Navigation Button Row */}
          <div className="p-6 md:p-8 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-4 mt-auto">
            {/* Back button */}
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={cn(
                "py-3 px-5 border rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all outline-none",
                currentStep === 0 
                  ? "border-zinc-150 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700 bg-transparent pointer-events-none select-none" 
                  : "border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 text-zinc-650 dark:text-zinc-300 dark:hover:bg-zinc-850 cursor-pointer active:scale-95"
              )}
            >
              <ChevronLeft size={14} /> Back
            </button>

            {/* Step indicators */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={cn(
                    "h-1.5 rounded-full transition-all cursor-pointer",
                    idx === currentStep ? "w-8 bg-zinc-900 dark:bg-white" : "w-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300"
                  )}
                  title={`Go to step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Next / Finish action button */}
            <button
              onClick={handleNext}
              className={cn(
                "py-3 px-6 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm",
                currentStep === steps.length - 1
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/10"
                  : "bg-zinc-950 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-zinc-200 dark:shadow-none"
              )}
            >
              {currentStep === steps.length - 1 ? (
                <>Finish Tour <Check size={14} /></>
              ) : (
                <>Next Step <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
