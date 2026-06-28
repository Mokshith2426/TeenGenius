import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { 
  Home, MessageSquare, Users, Sparkles, User, LogOut, Calendar, FileText, 
  UserPlus, Target, Brain, Map, GraduationCap, Settings, Sun, Moon, 
  HeartHandshake, LayoutGrid, X, Search, Menu, ShieldAlert, ArrowRight, Check,
  BookOpen, Compass, Headphones, Play, Pause, SkipForward, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { cn } from '../lib/utils';
import Logo from './Logo';
import SettingsModal from './SettingsModal';
import CommandPalette from './CommandPalette';
import MainWalkthrough from './MainWalkthrough';

const primaryTabs = [
  { icon: Home, label: 'Home', path: '/app' },
  { icon: BookOpen, label: 'Learn', path: '/app/learn' },
  { icon: Users, label: 'Classrooms', path: '/app/community' },
  { icon: Target, label: 'Focus', path: '/app/focus' },
];

const getActiveTab = (pathname: string) => {
  if (pathname === '/app') return 'Home';
  if (
    pathname.startsWith('/app/learn') ||
    pathname.startsWith('/app/ai-assistant') ||
    pathname.startsWith('/app/homework-solver') ||
    pathname.startsWith('/app/notes') ||
    pathname.startsWith('/app/timetable')
  ) return 'Learn';
  if (
    pathname.startsWith('/app/community') ||
    pathname.startsWith('/app/chats') ||
    pathname.startsWith('/app/study-groups')
  ) return 'Classrooms';
  if (pathname.startsWith('/app/focus')) return 'Focus';
  return 'Home';
};

const navItems = [
  { icon: Home, label: 'Dashboard', path: '/app' },
  { icon: Sparkles, label: 'AI Tutor', path: '/app/ai-assistant', badge: 'AI' },
  { icon: GraduationCap, label: 'Homework Solver', path: '/app/homework-solver' },
  { icon: FileText, label: 'Notes Lab', path: '/app/notes' },
  { icon: Calendar, label: 'Timetable Maker', path: '/app/timetable' },
  { icon: Target, label: 'Focus Zone', path: '/app/focus' },
  { icon: MessageSquare, label: 'Secure Chat', path: '/app/chats' },
  { icon: Users, label: 'Classrooms', path: '/app/community?tab=classrooms' },
  { icon: UserPlus, label: 'Study Buddies', path: '/app/community?tab=buddies' },
  { icon: HeartHandshake, label: 'Feedback', path: '/app/feedback' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, isGuest, userRole, showGuestPrompt, setShowGuestPrompt, guestPromptAction } = useAuth();
  const { currentTrack, isPlaying, status, togglePlay, nextTrack } = useMusic();

  const dynamicNavSections = [
    {
      title: '🏠 Home',
      items: [
        { icon: Home, label: 'Dashboard', path: '/app' },
      ]
    },
    {
      title: '📚 Educational Tools',
      items: [
        { icon: Sparkles, label: 'AI Tutor', path: '/app/ai-assistant', badge: 'AI' },
        { icon: GraduationCap, label: 'Homework Solver', path: '/app/homework-solver' },
        { icon: FileText, label: 'Notes Lab', path: '/app/notes' },
        { icon: Calendar, label: 'Timetable Maker', path: '/app/timetable' },
        { icon: Target, label: 'Focus Zone', path: '/app/focus' },
      ]
    },
    {
      title: '👥 Collaboration',
      items: [
        { icon: MessageSquare, label: 'Secure Chat', path: '/app/chats' },
        { icon: Users, label: 'Classrooms', path: '/app/community?tab=classrooms' },
        ...(userRole === 'student' ? [
          { icon: UserPlus, label: 'Study Buddies', path: '/app/community?tab=buddies' }
        ] : [])
      ]
    },
    {
      title: '💬 Feedback',
      items: [
        { icon: HeartHandshake, label: 'Send Feedback', path: '/app/feedback' },
      ]
    }
  ];

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('teengenius_sidebar_collapsed') === 'true';
  });

  // Adaptive Resize effect
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768 && width < 1024) {
        setIsSidebarCollapsed(true);
      } else if (width >= 1024) {
        const saved = localStorage.getItem('teengenius_sidebar_collapsed') === 'true';
        setIsSidebarCollapsed(saved);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Trigger main walkthrough if first time login
  useEffect(() => {
    const isCompleted = localStorage.getItem('TEENGENIUS_MAIN_WALKTHROUGH_COMPLETED_v2') === 'true';
    if (!isCompleted && user) {
      setIsWalkthroughOpen(true);
    }
  }, [user]);

  // Support global triggers
  useEffect(() => {
    const handleTriggerWalkthrough = () => {
      setIsWalkthroughOpen(true);
    };
    window.addEventListener('trigger-walkthrough', handleTriggerWalkthrough);
    return () => window.removeEventListener('trigger-walkthrough', handleTriggerWalkthrough);
  }, []);

  // Framer Motion spring-dampened scroll tracking
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 32,
    restDelta: 0.001
  });

  useEffect(() => {
    // Monitor root class changes to synchronize state
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatusToast, setShowStatusToast] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatusToast(true);
      // Automatically fade out the "Connected" toast after 4s
      const timer = setTimeout(() => {
        setShowStatusToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowStatusToast(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  // Listen globally for Command + K or Ctrl + K
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  // Monitor dynamic focus events to keep bottom bars clean during virtual keyboard states on mobile
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        setIsInputFocused(true);
      }
    };
    const handleFocusOut = () => {
      setIsInputFocused(false);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Monitor PWA installation status
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User installed TeenGenius secure PWA workspace.');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Listen back clicks
  useEffect(() => {
    const Cap = (window as any).Capacitor;
    if (Cap && Cap.Plugins && Cap.Plugins.App) {
      const { App } = Cap.Plugins;
      const backListener = App.addListener('backButton', () => {
        if (isMoreOpen) {
          setIsMoreOpen(false);
        } else if (location.pathname === '/app') {
          App.minimizeApp();
        } else {
          navigate(-1);
        }
      });
      return () => {
        backListener.then((h: any) => h.remove());
      };
    }
  }, [location.pathname, navigate, isMoreOpen]);

  useEffect(() => {
    setIsMoreOpen(false);
    setIsHeaderDropdownOpen(false);
  }, [location.pathname]);

  const handleLogoTap = () => {
    // Logo tap handles standard feedback. No credentials exposure.
  };

  const isFullHeightScreen = 
    location.pathname.includes('/chats/') || 
    location.pathname === '/app/ai-assistant';

  const isExcludedFromBottomNav = 
    (location.pathname.startsWith('/app/chats/') && location.pathname !== '/app/chats');

  const showBottomNav = !isInputFocused && !isExcludedFromBottomNav;

  return (
    <div className={cn(
      "w-full bg-zinc-50 dark:bg-zinc-950 flex relative font-sans text-zinc-900 dark:text-zinc-100 antialiased",
      isFullHeightScreen 
        ? "h-screen overflow-hidden" 
        : "min-h-screen"
    )}>
      {/* Scroll-Linked Glow Progress Indicator */}
      {!isFullHeightScreen && (
        <motion.div 
          className="fixed top-0 left-0 right-0 h-[3.5px] bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 origin-left z-[999] pointer-events-none shadow-[0_2px_8px_rgba(59,130,246,0.4)]"
          style={{ scaleX }}
        />
      )}
      
      {/* ========================================================= */}
      {/* 2. SIDE NAVIGATION FOR DESKTOP & TABLETS                  */}
      {/* ========================================================= */}
      <aside className={cn(
        "hidden md:flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200/65 dark:border-zinc-800 shrink-0 transition-all duration-300 z-20 shadow-sm relative",
        isSidebarCollapsed ? "w-20" : "w-64 xl:w-72",
        isFullHeightScreen 
          ? "h-full relative" 
          : "fixed top-0 left-0 bottom-0"
      )}>
        {/* Floating Sidebar Toggle Button */}
        <button
          id="sidebar-toggle-btn"
          onClick={() => {
            const nextState = !isSidebarCollapsed;
            setIsSidebarCollapsed(nextState);
            localStorage.setItem('teengenius_sidebar_collapsed', String(nextState));
          }}
          className="absolute -right-3.5 top-[26px] w-7 h-7 bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full flex items-center justify-center cursor-pointer shadow-sm z-50 transition-all active:scale-90"
          title={isSidebarCollapsed ? "Expand Sidebar Workspace" : "Collapse Sidebar Workspace"}
        >
          {isSidebarCollapsed ? <ChevronRight size={13} strokeWidth={2.4} /> : <ChevronLeft size={13} strokeWidth={2.4} />}
        </button>
        
        {/* Top Logo Zone */}
        <div className={cn(
          "h-20 flex items-center border-b border-zinc-100 dark:border-zinc-800 shrink-0",
          isSidebarCollapsed ? "justify-center" : "justify-start px-6"
        )}>
          <Logo size="sm" iconOnly={isSidebarCollapsed} />
        </div>

        {/* Navigation List - Scrollable with Hidden Scrollbars */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-6 scrollbar-hide">
          
          {/* Global Search Shortcut Quick Button */}
          <div className="px-1.5 mb-2">
            <button 
              id="desktop-search-palette-trigger"
              onClick={() => setIsPaletteOpen(true)}
              className={cn(
                "w-full flex items-center bg-zinc-50 dark:bg-zinc-805 hover:bg-zinc-100/70 dark:hover:bg-zinc-800 border border-zinc-200/40 dark:border-zinc-800 rounded-2xl text-xs font-bold text-zinc-500 dark:text-zinc-400 cursor-pointer shadow-xs transition-all hover:scale-[1.01] active:translate-y-0.5 group relative",
                isSidebarCollapsed ? "justify-center p-2.5" : "justify-between px-3.5 py-2.5"
              )}
              title="Global Search Workspace"
            >
              <div className="flex items-center gap-2">
                <Search size={14} className="text-zinc-400 dark:text-zinc-500 shrink-0" strokeWidth={2.4} />
                {!isSidebarCollapsed && <span className="text-zinc-500 dark:text-zinc-450">Search Platform</span>}
              </div>
              {!isSidebarCollapsed && (
                <kbd className="text-[8.5px] font-black uppercase tracking-wider bg-zinc-200/60 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-404 border border-zinc-200 dark:border-zinc-650 leading-none">⌘K</kbd>
              )}
              
              {/* Tooltip for collapsed size */}
              {isSidebarCollapsed && (
                <span className="absolute left-20 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-xl z-50 translate-x-3 group-hover:translate-x-0 whitespace-nowrap">
                  Search (⌘K)
                </span>
              )}
            </button>
          </div>

          {/* Grouped sections */}
          <div className="space-y-6">
            {dynamicNavSections.map((section) => (
              <div key={section.title} className="space-y-2">
                {/* Section header only shows when expanded */}
                {!isSidebarCollapsed ? (
                  <div className="px-3 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 italic">
                      {section.title}
                    </span>
                  </div>
                ) : (
                  <div className="h-px bg-zinc-100 dark:bg-zinc-805 mx-2 my-2" />
                )}

                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path));
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center rounded-xl text-xs font-bold transition-all relative group cursor-pointer",
                          isSidebarCollapsed ? "justify-center p-3" : "gap-3.5 px-3 py-2.5",
                          isActive 
                            ? "bg-blue-600/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold" 
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/50 dark:hover:bg-zinc-800/45"
                        )}
                        title={isSidebarCollapsed ? item.label : undefined}
                      >
                        <item.icon size={17} strokeWidth={isActive ? 2.5 : 2.0} className={cn("shrink-0 transition-transform group-hover:scale-110", isActive && "text-blue-600 dark:text-blue-400")} />
                        {!isSidebarCollapsed && (
                          <div className="flex items-center justify-between w-full min-w-0">
                            <span className="leading-none truncate">{item.label}</span>
                            {item.badge && (
                              <span className={cn(
                                "text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full leading-none shrink-0 scale-90 origin-right transition-transform group-hover:scale-95",
                                item.badge === 'AI' ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400" :
                                item.badge === 'Solver' ? "bg-blue-100 text-blue-600 dark:bg-blue-950/65 dark:text-blue-400" :
                                "bg-rose-150 text-rose-700 dark:bg-rose-950/65 dark:text-rose-400"
                              )}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Active link indicator bar */}
                        {isActive && (
                          <motion.div 
                            layoutId="activeSideIndicator"
                            className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-md"
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                          />
                        )}

                        {/* Collapsed Hover Tooltip */}
                        {isSidebarCollapsed && (
                          <span className="absolute left-20 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-xl z-50 translate-x-3 group-hover:translate-x-0 whitespace-nowrap">
                            {item.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Footer Controls & Status Widget */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
          
          {/* User Display Badge widget */}
          <div className={cn("flex items-center mb-4 px-2", isSidebarCollapsed ? "justify-center" : "gap-3")}>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-md shrink-0 transition-all",
              isGuest 
                ? "bg-gradient-to-tr from-amber-500 to-indigo-500 text-white shadow-amber-500/15" 
                : "bg-blue-600 text-white shadow-blue-500/20"
            )}>
              {isGuest ? 'G' : (user?.displayName?.[0] || 'T')}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1 animate-fadeIn">
                <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                  {user?.displayName || 'Active Student'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                    isGuest ? "bg-amber-500" : "bg-emerald-500"
                  )} />
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider select-none",
                    isGuest ? "text-amber-650 dark:text-amber-550" : "text-emerald-600 dark:text-emerald-450"
                  )}>
                    {isGuest ? "Guest Access" : "Online"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Shortcuts Utility Bar */}
          <div className={cn("grid gap-1", isSidebarCollapsed ? "grid-cols-1" : "grid-cols-3")}>
            <button 
              onClick={toggleDarkMode}
              className="flex justify-center items-center py-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200/40 dark:border-zinc-700/50 cursor-pointer transition-all hover:scale-105 active:scale-95"
              title="Toggle theme mode"
            >
              {isDarkMode ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} />}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex justify-center items-center py-2.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200/40 dark:border-zinc-700/50 cursor-pointer transition-all hover:scale-105 active:scale-95"
              title="Settings"
            >
              <Settings size={14} />
            </button>
            <button 
              onClick={logout}
              className="flex justify-center items-center py-2.5 text-zinc-400 hover:text-red-500 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200/40 dark:border-zinc-700/50 cursor-pointer transition-all hover:scale-105 active:scale-95"
              title="Sign Out Session"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 3. MAIN CONTENT VIEWPORT CANVAS                           */}
      {/* ========================================================= */}
      <main className={cn(
        "flex-1 min-w-0 flex flex-col relative z-10 bg-zinc-50 dark:bg-zinc-950 transition-all duration-300",
        isFullHeightScreen 
          ? "h-full overflow-hidden" 
          : isSidebarCollapsed
            ? "md:pl-20"
            : "md:pl-20 lg:pl-64 xl:pl-72"
      )}>
        {/* Mobile-Only Header bar (< 768px viewports) */}
        {!isFullHeightScreen && (
          <header className="flex md:hidden h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200/65 dark:border-zinc-800 items-center justify-between px-5 sticky top-0 z-40 shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800/55 rounded-xl border border-zinc-200/40 dark:border-zinc-700/30 transition-all cursor-pointer active:scale-95 touch-manipulation"
                title="Toggle Menu Portal"
              >
                <Menu size={18} strokeWidth={2.4} />
              </button>
              <h1 className="text-sm font-black uppercase tracking-wider text-zinc-850 dark:text-zinc-200">
                {navItems.find(item => location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path)))?.label || 'TeenGenius'}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => setIsPaletteOpen(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-450 dark:hover:text-white transition-all cursor-pointer animate-pulse"
                title="Search Workspace"
              >
                <Search size={18} strokeWidth={2.2} />
              </button>
            </div>
          </header>
        )}

        {/* Dynamic Offline notice banner */}
        {!isOnline && (
          <div className="bg-red-600 dark:bg-red-950/90 border-b border-red-700/50 px-6 py-2 flex items-center justify-center gap-2 text-white dark:text-red-200 text-xs shrink-0 select-none z-30 font-black uppercase tracking-widest text-[9px] shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>You are currently offline. Running on locally cached student records.</span>
          </div>
        )}

        {/* Dynamic install PWA notifier banner */}
        {showInstallBanner && (
          <div className="bg-blue-600/10 border-b border-blue-500/20 px-6 py-3 flex items-center justify-between gap-3 text-xs shrink-0 select-none animate-fadeIn z-30">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-blue-500 animate-pulse" />
              <p className="font-extrabold uppercase tracking-wider text-[9px] text-zinc-800 dark:text-zinc-200">
                Install TeenGenius for quick & easy study access
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={triggerPwaInstall}
                className="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-black text-[9px] uppercase tracking-widest cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                Install App
              </button>
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="p-1 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic guest mode conversion banner */}
        {isGuest && (
          <div className="bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border-b border-amber-500/20 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0 select-none animate-fadeIn z-30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Sparkles size={14} className="text-amber-500 animate-pulse" />
              </div>
              <div className="text-left">
                <p className="font-extrabold uppercase tracking-wider text-[10px] text-zinc-900 dark:text-white">
                  You are exploring as a Guest student!
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5 leading-relaxed">
                  Join private circles, message study groups, ask homework doubts, and get personalized study plans by creating an account.
                </p>
              </div>
            </div>
            <button 
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="py-2.5 px-5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-750 text-white rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer shadow-md hover:scale-[1.03] active:scale-95 transition-all shrink-0"
            >
              Sign In with Google
            </button>
          </div>
        )}

        {/* Connection Status Banners */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-500/10 dark:bg-amber-500/5 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold px-6 py-2.5 flex items-center justify-center gap-2.5 shrink-0 z-50 select-none"
              id="offline-alert-banner"
            >
              <ShieldAlert size={14} className="shrink-0 animate-pulse text-amber-500" />
              <span>You're offline. Some features may be limited. Secure local caching active.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showStatusToast && isOnline && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-500/10 dark:bg-emerald-500/5 border-b border-emerald-500/20 text-emerald-650 dark:text-emerald-400 text-xs font-bold px-6 py-2.5 flex items-center justify-center gap-2.5 shrink-0 z-50 select-none"
              id="online-success-banner"
            >
              <Check size={14} className="shrink-0 text-emerald-500" />
              <span>Connected to active school networks! Restoring real-time sync.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Viewport Content Container */}
        <div className={cn(
          "flex-1 relative flex flex-col",
          isFullHeightScreen ? "min-h-0 overflow-hidden" : ""
        )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={cn(
                "flex-1 relative flex flex-col",
                isFullHeightScreen ? "min-h-0 overflow-hidden" : ""
              )}
            >
              {isFullHeightScreen ? (
                <Outlet />
              ) : (
                <div id="main-scroll-container" className="flex-1 flex flex-col pb-24 md:pb-12">
                  
                  {/* Central inner limits grid to keep dashboards looking majestic even on mega displays */}
                  <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 lg:p-12">
                    <Outlet />
                  </div>
                  
                  {/* Premium Workspace Center Footer */}
                  <footer className="p-6 md:p-8 border-t border-zinc-200/50 dark:border-zinc-900 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-md mt-auto">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                      <div className="flex items-center gap-3">
                        <Logo size="sm" className="opacity-75" />
                        <span className="hidden md:inline h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Authorized Student Workspace</p>
                      </div>
                      <div className="text-center md:text-right">
                        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-zinc-450 dark:text-zinc-550 mb-0.5">A safe space for students</p>
                        <p className="text-[7.5px] font-black text-zinc-400 dark:text-zinc-650 uppercase tracking-widest leading-none">
                          TeenGenius App • Built for learning together
                        </p>
                      </div>
                    </div>
                  </footer>

                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ========================================================= */}
        {/* 4. MODERN LABELED MOBILE BOTTOM NAVIGATION BAR           */}
        {/* ========================================================= */}
        {showBottomNav && (
          <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md h-16 border-t border-zinc-200/80 dark:border-zinc-805 justify-around items-center z-45 px-2 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] select-none">
            {primaryTabs.map((item) => {
              const isActive = getActiveTab(location.pathname) === item.label && !isMoreOpen;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full py-1 text-center select-none active:scale-95 transition-all outline-none relative",
                    isActive 
                      ? "text-blue-600 dark:text-blue-400 font-extrabold" 
                      : "text-zinc-450 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeBottomTabIndicator"
                      className="absolute inset-x-2.5 top-2.5 bottom-2.5 bg-blue-600/10 dark:bg-blue-400/10 rounded-2xl -z-10"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon size={18} className={cn("mb-1 transition-transform", isActive ? "scale-105" : "scale-100")} strokeWidth={isActive ? 2.6 : 2.0} />
                  <span className="text-[9.5px] uppercase tracking-wide font-black leading-none">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* ========================================================= */}
        {/* 5. MOBILE APP DRAWER MENU BOTTOM SHEET                    */}
        {/* ========================================================= */}
        <AnimatePresence>
          {isMoreOpen && (
            <>
              {/* Bottom Sheet Backdrop with Glassmorphism */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.65 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 md:hidden"
                onClick={() => setIsMoreOpen(false)}
              />
              
              {/* Slide Drawer Node menu items */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 rounded-t-[2.5rem] p-5 pb-24 z-50 border-t border-zinc-150 dark:border-zinc-800 shadow-[0_-15px_30px_rgba(0,0,0,0.30)] max-h-[85%] overflow-y-auto md:hidden"
              >
                {/* Visual swipe anchor */}
                <div className="w-14 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-5 cursor-pointer" onClick={() => setIsMoreOpen(false)} />
                
                <div className="flex items-center justify-between mb-5 px-1">
                  <div>
                    <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-450 dark:text-zinc-555 italic leading-none">Modules Portal</h3>
                    <h4 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase mt-1 leading-none">Ecosystem Space</h4>
                  </div>
                  <button 
                    onClick={() => setIsMoreOpen(false)}
                    className="p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 text-zinc-500 hover:bg-zinc-100 rounded-full transition-all cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* 14 High density beautiful launcher options on grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path));
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMoreOpen(false)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all cursor-pointer aspect-square gap-1.5",
                          isActive
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10 scale-[1.02]"
                            : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-850/50 text-zinc-550 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                        )}
                      >
                        <item.icon size={19} className={cn("transition-transform", isActive && "scale-105")} />
                        <span className="text-[8px] font-black uppercase tracking-wider line-clamp-1 leading-none">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Grid footnote actions inside action sheet */}
                <div className="grid grid-cols-2 gap-2 mt-5 border-t border-zinc-150 dark:border-zinc-900 pt-5">
                  <button
                    onClick={() => {
                      setIsMoreOpen(false);
                      setTimeout(() => setIsSettingsOpen(true), 150);
                    }}
                    className="flex justify-center items-center gap-1.5 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 rounded-xl text-[9px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-404 cursor-pointer"
                  >
                    <Settings size={12} />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreOpen(false);
                      logout();
                    }}
                    className="flex justify-center items-center gap-1.5 py-3 bg-red-50/50 dark:bg-red-955/10 border border-red-100 dark:border-red-900/10 rounded-xl text-[9px] font-black uppercase tracking-wider text-red-500 cursor-pointer"
                  >
                    <LogOut size={12} />
                    Exit Session
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </main>

      {/* Reusable Guest Prompt Modal */}
      <AnimatePresence>
        {showGuestPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuestPrompt(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            
            {/* Content Container */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 p-8 text-center overflow-hidden z-10"
            >
              {/* Top ambient color ring decoration */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 to-indigo-600" />
              
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6 animate-bounce">
                <Sparkles size={26} className="text-amber-500" />
              </div>
              
              <h3 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">
                Unlock Full Access 🚀
              </h3>
              
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-640 dark:text-amber-450 mb-4 bg-amber-50 dark:bg-amber-955/25 px-3 py-1 rounded-full w-fit mx-auto">
                Restricted Action: {guestPromptAction || "Advanced Feature"}
              </p>
              
              <p className="text-sm text-zinc-550 dark:text-zinc-400 font-semibold leading-relaxed mb-8">
                Create a free account to save your progress and participate in the TeenGenius community.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    setShowGuestPrompt(false);
                    await logout();
                    navigate('/login');
                  }}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-98 transition-all shadow-md group flex items-center justify-center gap-2 cursor-pointer"
                >
                  Sign In with Google
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button
                  onClick={() => setShowGuestPrompt(false)}
                  className="w-full py-3.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-98 transition-all cursor-pointer"
                >
                  Continue Exploring
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Universal Floating Background Music Indicator */}
      <AnimatePresence>
        {isPlaying && location.pathname !== '/app/focus' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 30 }}
            whileHover={{ scale: 1.05 }}
            className="fixed bottom-24 right-5 md:right-8 z-[80] bg-zinc-950 text-white rounded-full pl-5 pr-4 py-3 flex items-center gap-3.5 shadow-2xl border border-zinc-800 shadow-zinc-950/20 md:max-w-xs cursor-pointer select-none"
            onClick={() => navigate('/app/focus')}
          >
            <div className="relative flex items-center justify-center shrink-0">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-60 animate-ping" />
              <Headphones size={15} className="text-blue-400 relative z-10" />
            </div>

            <div className="text-left min-w-0 pr-1">
              <p className="text-[8px] font-black tracking-widest text-zinc-400 uppercase leading-none mb-1">Studying</p>
              <h5 className="font-extrabold text-[10px] tracking-tight leading-none truncate max-w-[110px] md:max-w-[130px]" title={currentTrack?.title}>
                {currentTrack?.title}
              </h5>
            </div>

            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => { e.stopPropagation(); }}>
              <button
                onClick={togglePlay}
                className="w-7 h-7 rounded-full bg-zinc-850 hover:bg-zinc-800 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Pause Study Music"
              >
                {status === 'loading' ? (
                  <div className="w-3 h-3 border border-t-transparent border-zinc-200 animate-spin rounded-full" />
                ) : (
                  <Pause size={11} fill="currentColor" />
                )}
              </button>
              <button
                onClick={nextTrack}
                className="w-7 h-7 rounded-full bg-zinc-850 hover:bg-zinc-800 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Next Study Track"
              >
                <SkipForward size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Modals remain registered cleanly at top root wrapper */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <MainWalkthrough isOpen={isWalkthroughOpen} onClose={() => setIsWalkthroughOpen(false)} />
      <CommandPalette 
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        toggleDarkMode={toggleDarkMode}
        isDarkMode={isDarkMode}
        openSettings={() => setIsSettingsOpen(true)}
        logout={logout}
        navItems={navItems}
      />
    </div>
  );
}
