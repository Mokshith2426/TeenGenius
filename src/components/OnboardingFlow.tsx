import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronRight, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SUBJECT_CATALOG, GOAL_OPTIONS, HELP_FOCUS_OPTIONS,
  saveStudentProfile, setOnboardingComplete, isOnboardingComplete, StudentSubject,
} from '../lib/study';
import { cn } from '../lib/utils';

/**
 * Lightweight first-run onboarding: subjects → goal → what they need.
 * Saves into the student study profile (guest-safe, local-only for guests).
 */
export default function OnboardingFlow() {
  const { user, isGuest } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const [dismissed, setDismissed] = useState(() => isOnboardingComplete());
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState('regular');
  const [focus, setFocus] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (done || dismissed) return null;

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const finish = async (skipped = false) => {
    setSaving(true);
    try {
      if (!skipped) {
        const chosen: StudentSubject[] = subjects.map((id) => {
          const d = SUBJECT_CATALOG.find((s) => s.id === id);
          return { id, name: d?.name ?? id, color: d?.color ?? 'blue', icon: d?.icon };
        });
        await saveStudentProfile(uid, { subjects: chosen, goal, helpFocus: focus, onboardingComplete: true });
      }
    } catch { /* local-first — never block onboarding on a sync error */ }
    setOnboardingComplete();
    setDone(true);
    // Hand off to the app tour only when setup wasn't skipped and it hasn't run yet.
    if (!skipped && localStorage.getItem('TEENGENIUS_MAIN_WALKTHROUGH_COMPLETED_v2') !== 'true') {
      setTimeout(() => window.dispatchEvent(new CustomEvent('trigger-walkthrough')), 350);
    }
  };

  const ctaCls = 'w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer';

  return (
    <AnimatePresence>
      <motion.div key="ob" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[80] bg-zinc-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-6">
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-zinc-200 dark:bg-zinc-700')} />
              ))}
            </div>
            <button onClick={() => finish(true)} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer flex items-center gap-1">
              <X size={12} /> Skip
            </button>
          </div>

          <div className="p-5 max-h-[68vh] overflow-y-auto">
            {step === 0 && (
              <div className="space-y-3 py-2 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Sparkles size={22} />
                </div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Hey, I'm TeenGenius 👋</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                  Your personal study companion. I'll help you learn topics, practice what you're weak at, and always know what to do next. Three quick questions and we're in.
                </p>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-3">
                <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">What are you studying?</h2>
                <div className="grid grid-cols-2 gap-2">
                  {SUBJECT_CATALOG.map((s) => {
                    const on = subjects.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => setSubjects((a) => toggle(a, s.id))}
                        className={cn('rounded-2xl px-3 py-2.5 text-left text-xs font-bold border transition-colors cursor-pointer flex items-center justify-between gap-1.5',
                          on ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' : 'border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-zinc-200 dark:hover:border-zinc-700')}>
                        <span className="truncate">{s.name}</span>
                        {on && <Check size={13} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-2.5">
                <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">What are you preparing for?</h2>
                {GOAL_OPTIONS.map((g) => (
                  <button key={g.value} onClick={() => setGoal(g.value)}
                    className={cn('w-full rounded-2xl px-4 py-3 text-left border transition-colors cursor-pointer',
                      goal === g.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700')}>
                    <p className={cn('text-sm font-bold', goal === g.value ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200')}>{g.label}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{g.desc}</p>
                  </button>
                ))}
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">What do you want help with?</h2>
                <div className="flex flex-wrap gap-2">
                  {HELP_FOCUS_OPTIONS.map((h) => {
                    const on = focus.includes(h.value);
                    return (
                      <button key={h.value} onClick={() => setFocus((a) => toggle(a, h.value))}
                        className={cn('px-3.5 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer',
                          on ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' : 'border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-zinc-200 dark:hover:border-zinc-700')}>
                        {h.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-400 font-medium">You can change this anytime in your profile.</p>
              </div>
            )}
          </div>
          <div className="px-5 pb-5 pt-1">
            {step === 0 && <button onClick={() => setStep(1)} className={ctaCls}>Let's go <ChevronRight size={14} /></button>}
            {step === 1 && <button disabled={subjects.length === 0} onClick={() => setStep(2)} className={ctaCls}>Continue{subjects.length > 0 ? ` (${subjects.length})` : ''}</button>}
            {step === 2 && <button onClick={() => setStep(3)} className={ctaCls}>Continue <ChevronRight size={14} /></button>}
            {step === 3 && (
              <button onClick={() => finish(false)} disabled={saving} className={ctaCls}>
                <Check size={14} /> {saving ? 'Setting up…' : "You're all set"}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
