/**
 * Profile — account, study snapshot and app settings.
 *
 * Social surfaces (friends, study buddies, classrooms, achievements) were
 * removed from the MVP, so this screen is now just: who you are, how your
 * study is going, and the app controls that matter.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { updateProfile } from 'firebase/auth';
import {
  Mail, LogOut, Settings, FileText, Check, Loader2, X, Camera, Clock,
  ClipboardCheck, BookOpen, Target, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  useStudentProfile, getAllMastery, getTotalAccuracy, getRecentSession,
} from '../lib/study';
import { loadPlannerTasks, getTopTask } from '../lib/planner';
import SettingsModal from '../components/SettingsModal';
import { cn } from '../lib/utils';

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || 'S').trim();
  return (source[0] || 'S').toUpperCase();
}

function StatTile({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Target;
  value: string;
  label: string;
  tone: 'blue' | 'emerald' | 'amber';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    emerald:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  };
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>
        <Icon size={16} />
      </div>
      <p className="text-lg font-black leading-none text-zinc-900 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

export default function Profile() {
  const { user, logout, isGuest, updateUserInContext } = useAuth();
  const uid = isGuest ? null : (user?.uid ?? null);
  const { profile, loading } = useStudentProfile();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [snap, setSnap] = useState({
    topics: 0,
    accuracy: 0,
    openTasks: 0,
    nextTask: '',
    lastStudied: '',
  });

  useEffect(() => {
    if (loading) return;
    const mastery = getAllMastery(uid);
    const accuracy = getTotalAccuracy(uid);
    const tasks = loadPlannerTasks();
    const top = getTopTask(tasks);
    const recent = getRecentSession(uid);
    setSnap({
      topics: mastery.length,
      accuracy: Math.round(accuracy.accuracy || 0),
      openTasks: tasks.filter((t) => !t.completed).length,
      nextTask: top?.title || '',
      lastStudied: recent ? new Date(recent.createdAt).toLocaleDateString() : '',
    });
  }, [uid, loading, profile]);

  useEffect(() => {
    setNewName(user?.displayName || '');
  }, [user?.displayName]);

  const saveName = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setFormError('Please enter at least 2 characters.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await updateProfile(user!, { displayName: trimmed });
      updateUserInContext({ displayName: trimmed } as any);
      if (!isGuest && user) {
        await setDoc(doc(db, 'users', user.uid), { displayName: trimmed }, { merge: true }).catch(
          () => {},
        );
      }
      setIsEditingName(false);
    } catch (err: any) {
      setFormError(err?.message || 'Could not save your name.');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user || isGuest) return;
    if (file.size > 4 * 1024 * 1024) {
      setFormError('Please choose an image under 4MB.');
      return;
    }
    setIsUploading(true);
    setFormError(null);
    try {
      // Avatars are stored as a data URL on the user profile document so no
      // additional storage bucket or upload endpoint is required.
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read that image.'));
        reader.readAsDataURL(file);
      });
      await setDoc(
        doc(db, 'users', user.uid),
        { photoURL: dataUrl, updatedAt: serverTimestamp() },
        { merge: true },
      );
      await updateProfile(user, { photoURL: dataUrl });
      updateUserInContext({ photoURL: dataUrl } as any);
    } catch (err: any) {
      setFormError(err?.message || 'Could not update your photo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 sm:pt-6">
      {/* ── Account ─────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-4">
          <label className="relative shrink-0 cursor-pointer">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white">
                {initials(user?.displayName, user?.email)}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-white dark:border-zinc-900 dark:bg-white dark:text-zinc-900">
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={isGuest}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
                e.target.value = '';
              }}
            />
          </label>

          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <div className="space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Your name"
                  className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={isSaving}
                    className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setFormError(null);
                    }}
                    aria-label="Cancel"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => !isGuest && setIsEditingName(true)}
                className="text-left"
              >
                <h1 className="truncate text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                  {user?.displayName || 'Student'}
                </h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <Mail size={12} />
                  <span className="truncate">{user?.email || 'Guest session'}</span>
                </p>
                {!isGuest && (
                  <p className="mt-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    Tap to change your name
                  </p>
                )}
              </button>
            )}
          </div>
        </div>

        {isGuest && (
          <Link
            to="/login"
            className="mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-50 text-sm font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <Sparkles size={15} /> Create a free account to sync your work
          </Link>
        )}

        {formError && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            {formError}
          </p>
        )}
      </motion.section>

      {/* ── Study snapshot ───────────────────────────────────────────── */}
      <section className="mt-5">
        <h2 className="mb-2.5 text-sm font-black text-zinc-900 dark:text-white">Your study</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile icon={BookOpen} value={String(snap.topics)} label="Topics practised" tone="blue" />
          <StatTile
            icon={Target}
            value={snap.accuracy ? `${snap.accuracy}%` : '—'}
            label="Quiz accuracy"
            tone="emerald"
          />
          <StatTile icon={ClipboardCheck} value={String(snap.openTasks)} label="Open tasks" tone="amber" />
        </div>
        {(snap.nextTask || snap.lastStudied) && (
          <div className="mt-2.5 space-y-1.5 rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            {snap.nextTask && (
              <p className="text-zinc-600 dark:text-zinc-300">
                <span className="font-bold">Up next:</span> {snap.nextTask}
              </p>
            )}
            {snap.lastStudied && (
              <p className="text-zinc-500 dark:text-zinc-400">
                <Clock size={11} className="mr-1 inline" />
                Last studied {snap.lastStudied}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── App controls ─────────────────────────────────────────────── */}
      <section className="mt-5 space-y-2">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 text-left transition-colors active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Settings size={17} className="shrink-0 text-zinc-400" />
          <span className="flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Settings
          </span>
        </button>

        <Link
          to="/privacy"
          className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 transition-colors active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <FileText size={17} className="shrink-0 text-zinc-400" />
          <span className="flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Privacy policy
          </span>
        </Link>

        <Link
          to="/terms"
          className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 transition-colors active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <FileText size={17} className="shrink-0 text-zinc-400" />
          <span className="flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Terms of use
          </span>
        </Link>

        <button
          type="button"
          onClick={logout}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 text-left transition-colors active:scale-[0.99] dark:border-rose-900/50 dark:bg-zinc-900"
        >
          <LogOut size={17} className="shrink-0 text-rose-500" />
          <span className="flex-1 text-sm font-semibold text-rose-600 dark:text-rose-400">
            Log out
          </span>
        </button>
      </section>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-600">
        TeenGenius can make mistakes. Always check important answers against your textbook.
      </p>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
