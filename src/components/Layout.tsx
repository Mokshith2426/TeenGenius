/**
 * Layout — the app shell.
 *
 * Mobile-first: a 5-destination bottom bar (Home | Learn | Create | Practice |
 * Plan) plus a compact header with the AI Tutor and Profile actions.
 * Desktop: a slim sidebar listing the same destinations plus the AI Tutor.
 *
 * There is deliberately NO overflow menu of every feature ever shipped — the
 * navigation is the product's main statement of what TeenGenius is.
 */
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, BookOpen, Sparkles, Calendar, ClipboardCheck, FileText, User,
  Sun, Moon, Settings, LogOut, ArrowRight, WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Logo from './Logo';
import SettingsModal from './SettingsModal';

/** Bottom bar + sidebar share this list, so they can never drift apart. */
const DESTINATIONS = [
  { icon: Home, label: 'Home', path: '/app', tab: 'Home' },
  { icon: BookOpen, label: 'Learn', path: '/app/learn', tab: 'Learn' },
  { icon: FileText, label: 'Create', path: '/app/notes', tab: 'Create' },
  { icon: ClipboardCheck, label: 'Practice', path: '/app/practice', tab: 'Practice' },
  { icon: Calendar, label: 'Plan', path: '/app/planner', tab: 'Plan' },
] as const;

const AI_DESTINATION = {
  icon: Sparkles,
  label: 'AI Tutor',
  path: '/app/ai-assistant',
  tab: 'AI',
} as const;

const getActiveTab = (pathname: string): string | null => {
  if (pathname === '/app' || pathname === '/app/') return 'Home';
  if (pathname.startsWith('/app/learn') || pathname.startsWith('/app/study')) return 'Learn';
  if (pathname.startsWith('/app/notes') || pathname.startsWith('/app/create-notes')) return 'Create';
  if (pathname.startsWith('/app/practice')) return 'Practice';
  if (pathname.startsWith('/app/planner') || pathname.startsWith('/app/exam')) return 'Plan';
  if (pathname.startsWith('/app/ai-assistant')) return 'AI';
  if (pathname.startsWith('/app/profile')) return 'Profile';
  return null;
};

const ROUTE_TITLES: Array<[string, string]> = [
  ['/app/notes', 'Create Notes'],
  ['/app/create-notes', 'Create Notes'],
  ['/app/ai-assistant', 'AI Tutor'],
  ['/app/practice', 'Practice'],
  ['/app/planner', 'Plan'],
  ['/app/exam', 'Exam Prep'],
  ['/app/profile', 'Profile'],
  ['/app/learn', 'Learn'],
  ['/app/study', 'Learn'],
];

const getRouteTitle = (pathname: string) => {
  if (pathname === '/app' || pathname === '/app/') return 'Home';
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname.startsWith(prefix)) return title;
  }
  return 'TeenGenius';
};

export default function Layout() {
  const location = useLocation();
  const { logout, user, isGuest, showGuestPrompt, setShowGuestPrompt } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () => document.documentElement.classList.contains('dark'),
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const toggleDarkMode = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDarkMode(next);
  };

  const activeTab = getActiveTab(location.pathname);
  const title = getRouteTitle(location.pathname);
  // The AI Tutor manages its own full-height composer, so it opts out of the
  // bottom-nav padding.
  const isChatScreen = location.pathname.startsWith('/app/ai-assistant');
  const displayName = user?.displayName || 'Student';
  const avatarLetter = (displayName.trim()[0] || 'T').toUpperCase();

  return (
    <div className="flex min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:flex xl:w-64">
        <div className="px-5 py-5">
          <Link to="/app" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-base font-black tracking-tight text-zinc-900 dark:text-white">
              TeenGenius
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {DESTINATIONS.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900',
                )}
              >
                <item.icon size={18} strokeWidth={2.2} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}

          <div className="!my-3 h-px bg-zinc-200 dark:bg-zinc-800" />

          <Link
            to={AI_DESTINATION.path}
            aria-current={activeTab === 'AI' ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors',
              activeTab === 'AI'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900',
            )}
          >
            <AI_DESTINATION.icon size={18} strokeWidth={2.2} className="shrink-0" />
            {AI_DESTINATION.label}
          </Link>
        </nav>

        <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          <Link
            to="/app/profile"
            className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                isGuest ? 'bg-amber-500' : 'bg-blue-600',
              )}
            >
              {avatarLetter}
            </div>
            <span className="min-w-0 flex-1 truncate">{displayName}</span>
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open settings"
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              className="flex min-h-[40px] flex-1 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-950/40"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
          <h1 className="min-w-0 flex-1 truncate text-base font-black tracking-tight text-zinc-900 dark:text-white">
            {title}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              to={AI_DESTINATION.path}
              aria-label="AI Tutor"
              aria-current={activeTab === 'AI' ? 'page' : undefined}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                activeTab === 'AI'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
              <AI_DESTINATION.icon size={19} />
            </Link>
            <Link
              to="/app/profile"
              aria-label="Profile"
              className="flex h-11 w-11 items-center justify-center"
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white',
                  isGuest ? 'bg-amber-500' : 'bg-blue-600',
                )}
              >
                {avatarLetter}
              </div>
            </Link>
          </div>
        </header>

        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <WifiOff size={13} /> You are offline. Saved notes still work; AI features need a
            connection.
          </div>
        )}

        <main
          className={cn(
            'mx-auto w-full min-w-0 flex-1',
            isChatScreen ? 'pb-0' : 'pb-24 md:pb-10',
          )}
        >
          <Outlet />
        </main>

        {/* ── Mobile bottom navigation ───────────────────────────────── */}
        {!isChatScreen && (
          <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
          >
            {DESTINATIONS.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors',
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-zinc-500 dark:text-zinc-500',
                  )}
                >
                  <item.icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={cn('transition-transform', isActive && 'scale-105')}
                  />
                  <span className="text-[10px] font-bold leading-none">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Guest upgrade prompt */}
      <AnimatePresence>
        {showGuestPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuestPrompt(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              className="relative w-full max-w-sm rounded-3xl border border-zinc-100 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40">
                <Sparkles size={22} className="text-amber-500" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                Save your progress
              </h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Create a free account to keep your notes, practice history and study plan in
                sync across devices.
              </p>
              <div className="mt-5 space-y-2">
                <Link
                  to="/login"
                  onClick={() => setShowGuestPrompt(false)}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-sm font-bold text-white transition-transform active:scale-[0.99] dark:bg-white dark:text-zinc-900"
                >
                  Sign in or create account <ArrowRight size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowGuestPrompt(false)}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-2xl text-sm font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Keep studying as guest
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
