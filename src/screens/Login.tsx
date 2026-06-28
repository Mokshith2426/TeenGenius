import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Loader2, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ChevronLeft,
  KeyRound,
  CheckCircle2,
  LockKeyhole,
  LogIn,
  GraduationCap,
  Zap,
  Calendar,
  Users
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function Login() {
  const { 
    signInGoogle, 
    signInGuest, 
    signInLocalSandbox,
    signUpWithEmail, 
    signInWithEmail, 
    resetPassword, 
    user 
  } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [onboardStep, setOnboardStep] = useState<number>(() => {
    const isCompleted = localStorage.getItem('teengenius_onboarded');
    return isCompleted === 'true' ? 3 : 0;
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  // Interactivity
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Focus effect for email redirect
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const promptParam = queryParams.get('prompt');
    if (promptParam) {
      localStorage.setItem('pending_study_prompt', promptParam);
    }
  }, [location.search]);

  // Handle redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Clean error/success on mode transition
  const handleModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await signInGoogle();
      setSuccess("Successfully signed in! Welcome to TeenGenius.");
    } catch (err: any) {
      console.error("Google Auth error:", err);
      setError(err?.message || "Google Authentication failed. Please verify your connection or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Validate Fields
  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError("Email address is required.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return false;
    }

    if (authMode === 'signup') {
      if (!fullName.trim()) {
        setError("Your full name is required.");
        return false;
      }
      if (fullName.trim().length < 2) {
        setError("Please enter your genuine full name.");
        return false;
      }
      if (!password) {
        setError("Password is required.");
        return false;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return false;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify.");
        return false;
      }
    }

    if (authMode === 'signin') {
      if (!password) {
        setError("Password is required.");
        return false;
      }
    }

    return true;
  };

  // Email & Password Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);
    setSuccess(null);

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (authMode === 'signup') {
        await signUpWithEmail(email.trim(), password, fullName.trim());
        setSuccess("Success! Your TeenGenius account has been created.");
      } else if (authMode === 'signin') {
        await signInWithEmail(email.trim(), password);
        setSuccess("Signed in successfully! Redirecting...");
      } else if (authMode === 'forgot') {
        await resetPassword(email.trim());
        setSuccess("Password reset instructions have been dispatched to your email address.");
      }
    } catch (err: any) {
      console.error("Auth action error:", err);
      const errCode = err?.code || "";
      let userFriendlyMessage = err?.message || "An authentication error occurred. Please try again.";
      
      switch (errCode) {
        case 'auth/invalid-email':
          userFriendlyMessage = "The email address is formatted incorrectly.";
          break;
        case 'auth/user-disabled':
          userFriendlyMessage = "This user account has been disabled.";
          break;
        case 'auth/user-not-found':
          userFriendlyMessage = "No TeenGenius account corresponds to this email address. Please sign up!";
          break;
        case 'auth/wrong-password':
          userFriendlyMessage = "Incorrect password. Please verify and try again.";
          break;
        case 'auth/email-already-in-use':
          userFriendlyMessage = "An account already exists with this email address. Try signing in!";
          break;
        case 'auth/weak-password':
          userFriendlyMessage = "This password is too weak. Please use at least 6 characters.";
          break;
        case 'auth/invalid-credential':
          userFriendlyMessage = "Incorrect email address or password credentials.";
          break;
        default:
          break;
      }
      setError(userFriendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 relative transition-colors duration-300">
      <h1 className="sr-only">TeenGenius Authentication Gateway</h1>
      
      {/* Dynamic Background Decorative Ambient Blobs */}
      <div className="absolute top-[10%] left-[15%] w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[15%] w-80 h-80 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 my-8">
        
        {/* Main Floating Container */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl shadow-zinc-200/40 dark:shadow-none p-8 sm:p-10 border border-zinc-100 dark:border-zinc-850/80"
        >
          {onboardStep < 3 ? (
            <div className="relative">
              {/* Skip button in the top right, minimal and elegant */}
              <div className="flex justify-between items-center mb-6 select-none">
                <span className="text-[9px] font-black tracking-widest text-[#5c6e80] dark:text-zinc-500 uppercase">
                  Step {onboardStep + 1} of 3
                </span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('teengenius_onboarded', 'true');
                    setOnboardStep(3);
                  }}
                  className="text-[10px] font-black text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800/40 py-1.5 px-3 rounded-full transition-all active:scale-95 cursor-pointer"
                >
                  Skip
                </button>
              </div>

              {/* Onboarding Main Info */}
              <div className="flex flex-col items-center text-center space-y-6 pt-2">
                {/* Onboarding Interactive Visual Icon with elegant concentric style */}
                <div className="w-28 h-28 rounded-3xl bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center border border-zinc-150 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 bg-radial from-transparent to-zinc-100/10 dark:to-zinc-900/10" />
                  {onboardStep === 0 && <Sparkles size={48} className="text-[#1a62ff] animate-pulse" />}
                  {onboardStep === 1 && <Calendar size={48} className="text-purple-500 animate-pulse" />}
                  {onboardStep === 2 && <Users size={48} className="text-emerald-500 animate-pulse" />}
                </div>

                <div className="space-y-3">
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
                    {onboardStep === 0 && "Everything You Need to Learn"}
                    {onboardStep === 1 && "Stay Organized"}
                    {onboardStep === 2 && "Learn Together"}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-semibold leading-relaxed max-w-sm">
                    {onboardStep === 0 && "Homework, AI, Notes and Revision—all in one place."}
                    {onboardStep === 1 && "Assignments, calendars, reminders and real progress tracking."}
                    {onboardStep === 2 && "Classrooms, teacher announcements, Study Buddies and collaborative learning."}
                  </p>
                </div>
              </div>

              {/* Dots Progress Indicator & Continue Button */}
              <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col items-center gap-4">
                {/* Step Dots */}
                <div className="flex gap-2">
                  {[0, 1, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOnboardStep(s)}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        onboardStep === s 
                          ? "w-6 bg-[#1a62ff]" 
                          : "w-2 bg-zinc-200 dark:bg-zinc-800"
                      }`}
                    />
                  ))}
                </div>

                {/* Continue/Get Started Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextStep = onboardStep + 1;
                    if (nextStep >= 3) {
                      localStorage.setItem('teengenius_onboarded', 'true');
                    }
                    setOnboardStep(nextStep);
                  }}
                  className="w-full min-h-[50px] bg-[#141517] hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-750 text-white font-extrabold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] text-xs uppercase tracking-wider shadow-md mt-2 cursor-pointer border border-zinc-900"
                >
                  <span>{onboardStep === 2 ? "Get Started" : "Continue"}</span>
                  <ArrowRight size={14} className="stroke-[3]" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header & Logo with concentric circle style matching Screenshot 1 */}
              <div className="flex flex-col items-center mb-9">
                <div className="flex items-center gap-3.5 select-none hover:scale-[1.01] transition-transform">
                  <div id="login-app-icon" className="w-16 h-16 bg-zinc-950 dark:bg-zinc-100 rounded-[24%] flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden">
                    <div className="w-12 h-12 border-[5px] border-zinc-700 dark:border-zinc-300 rounded-full flex items-center justify-center">
                      <div className="w-7 h-7 border-[4px] border-zinc-550 dark:border-zinc-400 rounded-full flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-zinc-300 dark:bg-zinc-650 rounded-full" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-extrabold italic uppercase tracking-tighter text-3xl text-zinc-900 dark:text-zinc-50 leading-none">
                      TEEN<span className="text-blue-500 dark:text-blue-400">GENIUS</span>
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 dark:text-zinc-500 tracking-[0.25em] uppercase leading-none mt-1.5">
                      COGNITIVE NETWORK
                    </span>
                  </div>
                </div>
                
                <h2 className="text-lg font-black tracking-tight text-zinc-955 dark:text-white uppercase mt-6 text-center select-none">
                  Ready to Begin?
                </h2>
                <p className="text-[10px] sm:text-[11px] font-semibold text-[#5c6e80] dark:text-zinc-400 mt-2 text-center leading-relaxed select-none max-w-[280px]">
                  Sign in with Google or continue as Guest to start learning.
                </p>
              </div>

              <div className="pt-2">
                <AnimatePresence mode="wait">
                  {!showEmailForm ? (
                    // STATE 1: EXACT SCREENSHOT 1 OPTIONS MENU
                    <motion.div
                      key="options-menu"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      {/* Google Authenticate Button matches style: black pill with left icon ->] */}
                      <button
                        id="login-btn-google"
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full min-h-[50px] bg-[#141517] hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-750 text-white font-extrabold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-85 disabled:cursor-not-allowed text-xs uppercase tracking-widest shadow-md border border-zinc-900 cursor-pointer"
                      >
                        <LogIn size={15} className="text-zinc-300 stroke-[3]" />
                        <span>Continue with Google</span>
                      </button>

                      <div className="relative my-6 flex items-center justify-center select-none">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="w-full border-t border-zinc-150 dark:border-zinc-800" />
                        </div>
                        <span className="relative px-4 text-[10px] font-black tracking-widest text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 uppercase">
                          or
                        </span>
                      </div>

                      {/* Mail Sign in toggle option */}
                      <button
                        id="login-btn-email-toggle"
                        type="button"
                        onClick={() => setShowEmailForm(true)}
                        className="w-full min-h-[50px] bg-[#f1f3f5] hover:bg-[#e9ecef] dark:bg-zinc-950/60 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-extrabold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 border border-zinc-200/60 dark:border-zinc-800 transition-all active:scale-[0.98] text-xs uppercase tracking-widest shadow-sm cursor-pointer"
                      >
                        <Mail size={15} className="text-zinc-650 dark:text-zinc-400" />
                        <span>Use Student Email & Password</span>
                      </button>

                      <div className="relative my-6 flex items-center justify-center select-none">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="w-full border-t border-[#f1f3f5] dark:border-zinc-800" />
                        </div>
                        <span className="relative px-4 text-[9px] font-black tracking-widest text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 uppercase">
                          BYPASS POPUPS
                        </span>
                      </div>

                      {/* Bypass items buttons (Matches Screenshot 1 styles) */}
                      <div className="space-y-3 pt-0.5">
                        <button
                          id="login-btn-guest"
                          type="button"
                          onClick={signInGuest}
                          disabled={isLoading}
                          className="w-full min-h-[48px] bg-[#1a62ff] hover:bg-[#004cf8] text-white font-extrabold py-2.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] text-xs uppercase tracking-wider shadow-md cursor-pointer"
                        >
                          <GraduationCap size={16} className="text-white ring-1 ring-white/10" />
                          <span>Continue as Guest</span>
                        </button>

                        <button
                          id="login-btn-sandbox"
                          type="button"
                          onClick={signInLocalSandbox}
                          disabled={isLoading}
                          className="w-full min-h-[48px] bg-[#fffbf0] hover:bg-[#fff7da] dark:bg-amber-950/10 dark:hover:bg-amber-900/15 text-[#a86500] dark:text-amber-450 font-extrabold py-2.5 px-6 rounded-2xl flex items-center justify-center gap-2.5 border-2 border-dashed border-[#ffdf93] dark:border-amber-900/50 transition-all active:scale-[0.98] text-xs uppercase tracking-wider cursor-pointer"
                        >
                          <Zap size={14} className="text-amber-600 dark:text-amber-400 fill-amber-500/80 animate-pulse" />
                          <span>Enable Offline Local Sandbox</span>
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    // STATE 2: IMMERSIVE EMAIL CREDENTIALS INPUT FORM
                    <motion.div
                      key="cred-forms"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmailForm(false);
                          setError(null);
                          setSuccess(null);
                        }}
                        className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 tracking-wider mb-2.5 bg-zinc-100/60 dark:bg-zinc-800 py-1.5 px-3 rounded-lg"
                      >
                        <ChevronLeft size={13} className="stroke-[3]" /> Back to options
                      </button>

                      <div className="space-y-1.5 text-center">
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                          {authMode === 'signin' ? 'Authenticate Student' : authMode === 'signup' ? 'Initiate Node' : 'Recover Credential'}
                        </h3>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
                        {authMode === 'signup' && (
                          <div className="space-y-1.5">
                            <label htmlFor="signup-name" className="text-[9px] font-black uppercase tracking-widest text-[#8a99a6] block leading-none">
                              Display Name
                            </label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                              <input
                                id="signup-name"
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Marie Curie"
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/85 dark:border-zinc-805 hover:border-zinc-300 focus:border-zinc-900 dark:focus:border-zinc-500 rounded-xl py-2.5 px-4 pl-11 text-xs outline-none text-zinc-900 dark:text-white transition-all font-semibold"
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label htmlFor="auth-email" className="text-[9px] font-black uppercase tracking-widest text-[#8a99a6] block leading-none">
                              Student Email
                            </label>
                            {authMode !== 'forgot' && (
                              <button
                                type="button"
                                onClick={() => handleModeChange(authMode === 'signin' ? 'signup' : 'signin')}
                                className="text-[9px] font-black text-blue-500 hover:underline tracking-wider uppercase leading-none"
                              >
                                {authMode === 'signin' ? 'REGISTER' : 'LOGIN'}
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                            <input
                              id="auth-email"
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@school.edu"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/85 dark:border-zinc-800 hover:border-zinc-300 focus:border-zinc-900 dark:focus:border-zinc-500 rounded-xl py-2.5 px-4 pl-11 text-xs outline-none text-zinc-900 dark:text-white transition-all font-semibold"
                            />
                          </div>
                        </div>

                        {authMode !== 'forgot' && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label htmlFor="auth-password" className="text-[9px] font-black uppercase tracking-widest text-[#8a99a6] block leading-none">
                                Network Password
                              </label>
                              {authMode === 'signin' && (
                                <button
                                  type="button"
                                  onClick={() => handleModeChange('forgot')}
                                  className="text-[9px] font-black text-amber-600 dark:text-amber-500 hover:underline tracking-wider uppercase leading-none"
                                >
                                  Forgot?
                                </button>
                              )}
                            </div>
                            <div className="relative">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                              <input
                                id="auth-password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 focus:border-zinc-900 dark:focus:border-zinc-500 rounded-xl py-2.5 px-4 pl-11 pr-11 text-xs outline-none text-zinc-900 dark:text-white transition-all font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-65"
                              >
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </div>
                        )}

                        {authMode === 'signup' && (
                          <div className="space-y-1.5">
                            <label htmlFor="auth-confirm-password" className="text-[9px] font-black uppercase tracking-widest text-[#8a99a6] block leading-none">
                              Confirm Network Password
                            </label>
                            <div className="relative">
                              <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                              <input
                                id="auth-confirm-password"
                                type={showConfirmPassword ? "text" : "password"}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-805 hover:border-zinc-300 focus:border-zinc-900 dark:focus:border-zinc-500 rounded-xl py-2.5 px-4 pl-11 pr-11 text-xs outline-none text-zinc-900 dark:text-white transition-all font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-65"
                              >
                                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full min-h-[44px] bg-zinc-950 dark:bg-zinc-800 hover:bg-zinc-900 dark:hover:bg-zinc-750 text-white font-extrabold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-85 disabled:cursor-not-allowed mt-4 text-[10.5px] uppercase tracking-wider text-center animate-none"
                        >
                          {isLoading ? (
                            <Loader2 className="animate-spin text-white" size={15} />
                          ) : (
                            <>
                              <span>
                                {authMode === 'signin' ? 'Verify Credentials' : authMode === 'signup' ? 'Initiate Node' : 'Transmit Reset Link'}
                              </span>
                              <ArrowRight size={13} className="text-zinc-300 font-extrabold" />
                            </>
                          )}
                        </button>
                      </form>

                      {authMode === 'forgot' && (
                        <p className="text-center text-[10px] text-zinc-500 dark:text-zinc-400">
                          Take me back to{' '}
                          <button
                            type="button"
                            onClick={() => handleModeChange('signin')}
                            className="text-blue-500 font-extrabold hover:underline"
                          >
                            Sign In
                          </button>
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Notifications Box */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-4"
                  >
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-955/25 text-rose-600 dark:text-rose-450 text-[11px] font-semibold rounded-xl border border-rose-100/50 dark:border-rose-950/50 flex gap-2.5 items-start">
                      <span className="text-sm leading-none shrink-0">&#x26A0;</span>
                      <p className="leading-relaxed break-words flex-1">{error}</p>
                    </div>
                  </motion.div>
                )}

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-4"
                  >
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-955/25 text-emerald-600 dark:text-emerald-450 text-[11px] font-semibold rounded-xl border border-emerald-100/40 dark:border-emerald-955/40 flex gap-2.5 items-start">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <p className="leading-relaxed flex-1">{success}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Secure assurance copy */}
              <div className="mt-8 pt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-center gap-6 text-[9.5px] font-black uppercase tracking-widest text-[#8c9ca8] dark:text-zinc-500 select-none">
                <span className="flex items-center gap-1.5"><ShieldCheck size={11} className="text-emerald-500 shrink-0 stroke-[3]" /> Secure Network</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><Sparkles size={11} className="text-blue-500 shrink-0 stroke-[3]" /> Verified Node</span>
              </div>

              <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-550 mt-6 leading-relaxed cursor-default select-none pointer-events-none">
                By signing in, you agree to TeenGenius's terms for students and researchers.
              </p>
            </>
          )}

        </motion.div>
      </div>
    </main>
  );
}
