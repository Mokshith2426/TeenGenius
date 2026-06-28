import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Key, EyeOff, Lock, ChevronRight, ChevronLeft, X, Sparkles, Check, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export interface OnboardingStep {
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  accentClass: string;
  badgeText: string;
}

interface OnboardingTooltipProps {
  onClose: () => void;
  onComplete?: () => void;
}

export default function OnboardingTooltip({ onClose, onComplete }: OnboardingTooltipProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [inputText, setInputText] = useState('My Homework Note');
  const [isEncryptedDemo, setIsEncryptedDemo] = useState(false);
  const [demoKey, setDemoKey] = useState('key_session_rsa_2048_genius_temp');

  const steps: OnboardingStep[] = [
    {
      title: "Private Security Keys",
      subtitle: "Saved only on your browser",
      description: "TeenGenius creates a private key right in your browser memory. This key stays safely on your device and is never uploaded. Your private chats remain 100% yours.",
      icon: Key,
      accentClass: "from-blue-600 to-indigo-600 text-white shadow-blue-500/20",
      badgeText: "Local Keys"
    },
    {
      title: "100% Private Chats",
      subtitle: "Safe, Locked Messages",
      description: "Every homework question, study note, and chat message is locked on your device before it gets sent. Even our database only sees scrambled text. Nobody else can read your school chats except you and your friends.",
      icon: Lock,
      accentClass: "from-emerald-500 to-teal-600 text-white shadow-emerald-500/20",
      badgeText: "Super Safe"
    },
    {
      title: "No Ads or Spying",
      subtitle: "We Never Track You",
      description: "We never sell your study data or show you boring ads. TeenGenius is built just for learning—no trackers, no annoying popups, and no profiling.",
      icon: EyeOff,
      accentClass: "from-purple-500 to-pink-600 text-white shadow-purple-500/20",
      badgeText: "No Trackers"
    },
    {
      title: "Safe Study Groups",
      subtitle: "Only verified school peers",
      description: "You choose who joins your study groups. Your chat rooms are link-protected so random internet bots or spammers can never enter.",
      icon: Shield,
      accentClass: "from-orange-500 to-amber-600 text-white shadow-orange-500/20",
      badgeText: "Verified Only"
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      if (onComplete) onComplete();
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];
  const StepIcon = step.icon;

  // Simple visual cypher simulation for educational value
  const mockEncrypt = (str: string) => {
    let hash = "";
    for (let i = 0; i < str.length; i++) {
      hash += String.fromCharCode(str.charCodeAt(i) + 13 + (i % 3));
    }
    return btoa(hash).substring(0, 24) + "== [AES-256-TAGGED]";
  };

  return (
    <div className="bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-900/90 dark:to-zinc-950/90 border border-zinc-200/80 dark:border-zinc-800 p-6 md:p-8 rounded-[2.5rem] relative shadow-2xl overflow-hidden mt-2 mb-6">
      
      {/* Decorative Blur Accent */}
      <div className="absolute top-0 right-0 w-56 h-56 bg-blue-500/5 dark:bg-blue-500/10 rounded-full filter blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full filter blur-2xl -ml-16 -mb-16 pointer-events-none" />

      {/* Header Container */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-blue-600 text-white font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <Sparkles size={10} className="animate-spin" /> Quick Start Tour
          </span>
          <span className="text-zinc-400 dark:text-zinc-500 font-bold text-xs uppercase tracking-widest">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          id="btn-close-onboarding-tooltip"
          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl bg-white dark:bg-zinc-805 border border-zinc-200/60 dark:border-zinc-800 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Skip Walkthrough"
        >
          <X size={14} />
        </button>
      </div>

      {/* Main Feature Walkthrough Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        
        {/* Left Column - Content details */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-3.5 rounded-2xl bg-gradient-to-br shadow-lg", step.accentClass)}>
              <StepIcon size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full">
                {step.badgeText}
              </span>
              <h3 className="text-xl font-black uppercase text-zinc-900 dark:text-white tracking-tight mt-1">
                {step.title}
              </h3>
            </div>
          </div>

          <h4 className="font-extrabold text-sm text-zinc-700 dark:text-zinc-300 italic tracking-wide">
            &ldquo;{step.subtitle}&rdquo;
          </h4>

          <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed font-semibold">
            {step.description}
          </p>

          {/* Dots Indicator */}
          <div className="flex items-center gap-2 pt-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all cursor-pointer",
                  idx === currentStep ? "w-8 bg-blue-600" : "w-1.5 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400"
                )}
                id={`btn-onboarding-dot-${idx}`}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>        {/* Right Column - Cryptographic Interactive Sandbox Widget */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900/60 p-5 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/80 shadow-inner space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Key size={11} className="text-zinc-400" /> Interactive Privacy Simulator
            </h4>
            <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
              Super Safe
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                Step 1: Write text (e.g., homework draft)
              </label>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                maxLength={40}
                className="w-full text-xs font-bold bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 rounded-xl border border-zinc-250 dark:border-zinc-800 focus:outline-none focus:border-blue-500"
                placeholder="Type anything to test our locking feature..."
                id="input-onboarding-sandbox-text"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">
                Step 2: Safe Privacy Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEncryptedDemo(false)}
                  className={cn(
                    "flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer",
                    !isEncryptedDemo 
                      ? "bg-zinc-150 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 text-zinc-900 dark:text-white"
                      : "bg-transparent border-zinc-200/60 dark:border-zinc-850 text-zinc-400 hover:text-zinc-600"
                  )}
                  id="btn-sandbox-demo-plaintext"
                >
                  Normal Text
                </button>
                <button
                  type="button"
                  onClick={() => setIsEncryptedDemo(true)}
                  className={cn(
                    "flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1",
                    isEncryptedDemo 
                      ? "bg-blue-600 border-blue-500 text-white shadow-sm"
                      : "bg-transparent border-zinc-200/60 dark:border-zinc-850 text-zinc-400 hover:text-blue-500"
                  )}
                  id="btn-sandbox-demo-encrypted"
                >
                  <Lock size={9} /> Private Mode
                </button>
              </div>
            </div>

            <div className="space-y-1 bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-2xl border border-zinc-200/40 dark:border-zinc-850 relative overflow-hidden group">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">
                Step 3: What gets saved (super safe)
              </label>
              
              <div className="font-mono text-[10px] break-all leading-tight text-zinc-700 dark:text-zinc-300 select-all font-semibold">
                {isEncryptedDemo ? (
                  <motion.span 
                    key="cipher" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="text-emerald-600 dark:text-emerald-400 font-extrabold"
                  >
                    {mockEncrypt(inputText)}
                  </motion.span>
                ) : (
                  <span className="text-zinc-900 dark:text-white">{inputText || "(empty text)"}</span>
                )}
              </div>

              {/* Mini visual keys block */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-200/30 dark:border-zinc-900 text-[8px] font-mono text-zinc-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Key size={8} /> My Key
                </span>
                <span className="truncate max-w-[120px] text-zinc-500 font-bold">{demoKey}</span>
                <button
                  type="button"
                  onClick={() => setDemoKey('key_session_rsa_' + Math.random().toString(36).substring(2, 10))}
                  className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Generate new safe key"
                  id="btn-sandbox-regenerate-key"
                >
                  <RefreshCw size={8} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button Controls */}
      <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/80 relative z-10">
        <button
          type="button"
          onClick={prevStep}
          disabled={currentStep === 0}
          className={cn(
            "px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer",
            currentStep === 0 ? "text-zinc-300 dark:text-zinc-700" : "text-zinc-650 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-850"
          )}
          id="btn-onboarding-prev"
        >
          <ChevronLeft size={12} /> Back
        </button>

        <button
          type="button"
          onClick={nextStep}
          className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md shadow-zinc-200 dark:shadow-none"
          id="btn-onboarding-next"
        >
          {currentStep === steps.length - 1 ? (
            <>Finish Walkthrough <Check size={12} /></>
          ) : (
            <>Next Principle <ChevronRight size={12} /></>
          )}
        </button>
      </div>
    </div>
  );
}
