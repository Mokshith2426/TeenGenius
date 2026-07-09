import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MusicProvider } from './context/MusicContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';
import RouteLoading from './components/RouteLoading';
import { startSessionTracker } from './lib/analytics';

// Lazy load screen components for elite bundle optimizations and page transition speed
const Home = lazy(() => import('./screens/Home'));
const ChatList = lazy(() => import('./screens/ChatList'));
const ChatRoom = lazy(() => import('./screens/ChatRoom'));
const StudyGroups = lazy(() => import('./screens/StudyGroups'));
const StudyGroupDetail = lazy(() => import('./screens/StudyGroupDetail'));
const AIAssistant = lazy(() => import('./screens/AIAssistant'));
const Profile = lazy(() => import('./screens/Profile'));
const TimetableMaker = lazy(() => import('./screens/TimetableMaker'));
const NotesGenerator = lazy(() => import('./screens/NotesGenerator'));
const Friends = lazy(() => import('./screens/Friends'));
const FocusRoom = lazy(() => import('./screens/FocusRoom'));
const MemoryPalace = lazy(() => import('./screens/MemoryPalace'));
const ExploreHub = lazy(() => import('./screens/ExploreHub'));
const Login = lazy(() => import('./screens/Login'));
const Landing = lazy(() => import('./screens/Landing'));
const HomeworkSolver = lazy(() => import('./screens/HomeworkSolver'));
const Feedback = lazy(() => import('./screens/Feedback'));
const PrivacyPolicy = lazy(() => import('./screens/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./screens/TermsOfService'));

// Brand-new hub routers
const LearnHub = lazy(() => import('./screens/LearnHub'));
const CommunityHub = lazy(() => import('./screens/CommunityHub'));
const PlannerHub = lazy(() => import('./screens/PlannerHub'));
const WhiteboardScreen = lazy(() => import('./screens/WhiteboardScreen'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function LandingPageWrapper() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/app', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <SplashScreen />;
  return <Landing />;
}

function DeploymentVersionChecker() {
  const [latestVersion, setLatestVersion] = React.useState<string | null>(null);
  const [isNewVersionAvailable, setIsNewVersionAvailable] = React.useState(false);

  // 1. Check version state helper
  const checkVersion = React.useCallback(async (initial = false) => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.version) {
        if (initial) {
          setLatestVersion(data.version);
        } else if (latestVersion && data.version !== latestVersion) {
          setIsNewVersionAvailable(true);
        }
      }
    } catch (err) {
      console.warn('[Version check bypassed for offline compatibility]:', err);
    }
  }, [latestVersion]);

  // 2. Poll version API regularly & listen for visible changes
  React.useEffect(() => {
    // Fetch initial server version
    checkVersion(true);

    // Dynamic visibility change event to trigger rapid check-ups when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5-minute background polling interval
    const interval = setInterval(() => {
      checkVersion(false);
    }, 5 * 60 * 1000);

    // Look for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Service worker loaded in background and is waiting
                setIsNewVersionAvailable(true);
              }
            });
          }
        });
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [checkVersion]);

  const handleReload = () => {
    // Tell waiting service worker to skip waiting to apply the changes instantly
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }
    
    // Clear browser cookies and caches of index.html by forcing a hard programmatic reload
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (!isNewVersionAvailable) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
              TeenGenius Updated!
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
              A newer version of TeenGenius has been deployed with performance gains. Please reload to activate.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
          <button
            onClick={() => setIsNewVersionAvailable(false)}
            className="rounded px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
          >
            Later
          </button>
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm active:scale-95 transition"
          >
            Reload Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [showLaunch, setShowLaunch] = React.useState(true);

  React.useEffect(() => {
    // Initialise theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      }
    }

    // Initialize Session Analytics Tracking safely
    const stopSessionTracker = startSessionTracker();

    const timer = setTimeout(() => setShowLaunch(false), 2500);
    return () => {
      clearTimeout(timer);
      stopSessionTracker();
    };
  }, []);

  if (showLaunch) return <SplashScreen />;

  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <MusicProvider>
            <DeploymentVersionChecker />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<LandingPageWrapper />} />
                <Route path="/login" element={<Login />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/app" element={<PrivateRoute><Layout /></PrivateRoute>}>
                  <Route index element={<Home />} />
                  <Route path="chats" element={<ChatList />} />
                  <Route path="chats/:chatId" element={<ChatRoom />} />
                  <Route path="study-groups" element={<StudyGroups />} />
                  <Route path="study-groups/:groupId" element={<StudyGroupDetail />} />
                  <Route path="ai-assistant" element={<AIAssistant />} />
                  <Route path="homework-solver" element={<HomeworkSolver />} />
                  <Route path="timetable" element={<TimetableMaker />} />
                  <Route path="notes" element={<NotesGenerator />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="learn" element={<LearnHub />} />
                  <Route path="explore" element={<Navigate to="/app/learn" replace />} />
                  <Route path="tools" element={<Navigate to="/app/learn" replace />} />
                  <Route path="community" element={<CommunityHub />} />
                  <Route path="planner" element={<PlannerHub />} />
                  <Route path="whiteboard" element={<WhiteboardScreen />} />
                  <Route path="friends" element={<Navigate to="/app/profile?tab=friends" replace />} />
                  <Route path="focus" element={<FocusRoom />} />
                  <Route path="memory-lab" element={<MemoryPalace />} />
                  <Route path="roadmap" element={<Navigate to="/app/learn" replace />} />
                  <Route path="feedback" element={<Feedback />} />
                  <Route path="safety" element={<Navigate to="/app" replace />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </MusicProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}
