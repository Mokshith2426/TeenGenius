import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, ChevronDown } from 'lucide-react';

function AcademicProfileCard({
  user,
  isGuest,
  triggerGuestPrompt,
}: {
  user: any;
  isGuest: boolean;
  triggerGuestPrompt: (action: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [profile, setProfile] = useState({
    board: '',
    class: '',
    stream: '',
    studyHoursPerDay: '4',
    preferredSubjects: [] as string[],
    weakSubjects: [] as string[],
    strongSubjects: [] as string[],
    examGoal: '85',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('TEEN_GENIUS_USER_PROFILE');
      if (stored) setProfile(prev => ({ ...prev, ...JSON.parse(stored) }));
    } catch (e) { /* ignore */ }
  }, []);

  const handleSave = async () => {
    if (isGuest) { triggerGuestPrompt('Save academic profile'); return; }
    if (!user) return;
    setIsSaving(true);
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await setDoc(doc(db, 'users', user.uid), profile as any, { merge: true });
      localStorage.setItem('TEEN_GENIUS_USER_PROFILE', JSON.stringify(profile));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Profile save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const boards = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'Other'];
  const classes = ['6', '7', '8', '9', '10', '11', '12', 'Other'];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2rem] overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 sm:p-6 flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
            <GraduationCap size={20} />
          </div>
          <div className="text-left">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              Academic Profile
            </h2>
            <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
              {profile.board && profile.class
                ? `${profile.board} · Class ${profile.class}`
                : 'Set your board, class, and preferences to auto-fill forms'}
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-zinc-400 group-hover:text-zinc-600"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Board</label>
                  <select
                    value={profile.board}
                    onChange={e => setProfile(p => ({ ...p, board: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select board</option>
                    {boards.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Class</label>
                  <select
                    value={profile.class}
                    onChange={e => setProfile(p => ({ ...p, class: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stream</label>
                  <input
                    type="text"
                    value={profile.stream}
                    onChange={e => setProfile(p => ({ ...p, stream: e.target.value }))}
                    placeholder="e.g. Science, Commerce"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Study Hours / Day</label>
                  <select
                    value={profile.studyHoursPerDay}
                    onChange={e => setProfile(p => ({ ...p, studyHoursPerDay: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {['1','2','3','4','5','6','7','8'].map(h => <option key={h} value={h}>{h} hours</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Exam Goal (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={profile.examGoal}
                    onChange={e => setProfile(p => ({ ...p, examGoal: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Preferred Subjects</label>
                  <input
                    type="text"
                    value={profile.preferredSubjects.join(', ')}
                    onChange={e => setProfile(p => ({ ...p, preferredSubjects: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))}
                    placeholder="e.g. Physics, Maths, CS"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {saved && (
                  <span className="text-[10px] font-black text-emerald-600 animate-fadeIn">Saved ✓</span>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/10 active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AcademicProfileCard;
