import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sun, Moon, Bell, Globe, User, Lock, LogOut, 
  HelpCircle, AlertTriangle, Mail, Info, FileText, CheckCircle2,
  Shield, Check, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { SUPPORTED_LANGUAGES, getActiveLanguage, setActiveLanguage } from '../lib/language';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'preferences' | 'account' | 'support' | 'about';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, logout, updateUserInContext } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('preferences');
  
  // States of Preferences
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  React.useEffect(() => {
    // Monitor root class changes to synchronize state
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [contrastSetting, setContrastSetting] = useState('normal');
  const [fontSize, setFontSize] = useState('medium');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(getActiveLanguage());
  
  // States of Account Editing
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [selectedBadge, setSelectedBadge] = useState('novice');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bug Report / Support States
  const [bugTitle, setBugTitle] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [bugSeverity, setBugSeverity] = useState('low');
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);
  const [bugSuccess, setBugSuccess] = useState(false);

  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingProfile(true);
    setProfileSuccess(false);

    const isSandboxObj = user.uid.includes('sandbox') || (user as any).isGuest;
    if (isSandboxObj) {
      try {
        const updatedUser = {
          ...user,
          displayName: displayName
        };
        localStorage.setItem('LOCAL_SANDBOX_USER', JSON.stringify(updatedUser));
        
        const existingStr = localStorage.getItem('SANDBOX_GAMIFICATION_DATA');
        if (existingStr) {
          try {
            const parsed = JSON.parse(existingStr);
            if (!parsed.badges) parsed.badges = [];
            if (!parsed.badges.includes(selectedBadge)) {
              parsed.badges = [selectedBadge];
            }
            localStorage.setItem('SANDBOX_GAMIFICATION_DATA', JSON.stringify(parsed));
          } catch (e) {}
        }
        
        updateUserInContext({ displayName: displayName });
        setIsSavingProfile(false);
        setProfileSuccess(true);
        setTimeout(() => {
          setProfileSuccess(false);
          onClose();
        }, 1000);
      } catch (err) {
        console.error("Local profile update failed:", err);
        setIsSavingProfile(false);
      }
      return;
    }

    try {
      const { auth, db } = await import('../lib/firebase');
      const { updateProfile } = await import('firebase/auth');
      const { doc, setDoc } = await import('firebase/firestore');

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: displayName });
      }
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { 
        displayName: displayName,
        badges: [selectedBadge]
      }, { merge: true });

      updateUserInContext({ displayName: displayName });
      setIsSavingProfile(false);
      setProfileSuccess(true);
      setTimeout(() => {
        setProfileSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Firebase profile update failed:", err);
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassMessage({ type: 'error', text: 'Please fill in all security fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setPassMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsChangingPass(true);
    // Simulate API verification and update
    setTimeout(() => {
      setIsChangingPass(false);
      setPassMessage({ type: 'success', text: 'Password successfully updated!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1200);
  };

  const handleSubmitBug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle || !bugDesc) return;
    setIsSubmittingBug(true);

    setTimeout(() => {
      setIsSubmittingBug(false);
      setBugSuccess(true);
      setBugTitle('');
      setBugDesc('');
      setTimeout(() => setBugSuccess(false), 4000);
    }, 1000);
  };

  const handleSubmitContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage) return;
    setIsSubmittingContact(true);

    setTimeout(() => {
      setIsSubmittingContact(false);
      setContactSuccess(true);
      setContactSubject('');
      setContactMessage('');
      setTimeout(() => setContactSuccess(false), 4000);
    }, 1000);
  };

  const tabs = [
    { id: 'preferences' as TabType, label: 'Preferences', icon: Sun },
    { id: 'account' as TabType, label: 'Account', icon: User },
    { id: 'support' as TabType, label: 'Support & Help', icon: HelpCircle },
    { id: 'about' as TabType, label: 'About App', icon: Info }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="settings-modal" className="fixed inset-0 z-[9995] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black backdrop-blur-sm"
          />

          {/* Modal Box */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-4xl h-[85vh] max-h-[750px] shadow-2xl flex flex-col md:flex-row overflow-hidden"
          >
            {/* Sidebar (Left on Desktop, Top Scrollable on Mobile) */}
            <div className="w-full md:w-64 border-r md:h-full border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 p-6 flex flex-col shrink-0">
              <div className="flex items-center justify-between md:mb-8">
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Settings</h2>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Student Preferences</p>
                </div>
                <button 
                  onClick={onClose}
                  className="md:hidden p-2 text-zinc-400 hover:text-zinc-650 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Options */}
              <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 scrollbar-hide">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap min-w-max md:w-full",
                        isActive 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" 
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <tab.icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              {/* Action Button Footer on Desktop */}
              <div className="mt-auto hidden md:block border-t border-zinc-150 dark:border-zinc-800/80 pt-4">
                <button
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-500/5 hover:text-red-650 transition-all rounded-2xl text-xs font-black uppercase tracking-widest"
                >
                  <LogOut size={15} />
                  Exit Session
                </button>
              </div>
            </div>

            {/* Scrollable View Panel Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-hide flex flex-col justify-between">
              
              <div className="space-y-8">
                {/* 1. PREFERENCES TAB */}
                {activeTab === 'preferences' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Visual & Theme</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Theme Select */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-3xl flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">Active Theme</p>
                            <p className="text-[10px] text-zinc-400 font-semibold italic">Toggle dark mode overlay</p>
                          </div>
                          <button
                            onClick={toggleDarkMode}
                            className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-750 text-zinc-500 rounded-2xl transition-all cursor-pointer shadow-sm hover:scale-105"
                          >
                            {isDarkMode ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} />}
                          </button>
                        </div>

                        {/* Contrast Control */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-3xl space-y-2">
                          <p className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">High Contrast</p>
                          <div className="grid grid-cols-2 gap-2">
                            {['normal', 'high'].map((c) => (
                              <button
                                key={c}
                                onClick={() => setContrastSetting(c)}
                                className={cn(
                                  "py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider border transition-all cursor-pointer",
                                  contrastSetting === c 
                                    ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 text-zinc-500"
                                )}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Font Size setting */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-3xl space-y-2 col-span-1 md:col-span-2">
                          <p className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">App Typography Scaling</p>
                          <div className="grid grid-cols-3 gap-2">
                            {['small', 'medium', 'large'].map((size) => (
                              <button
                                key={size}
                                onClick={() => setFontSize(size)}
                                className={cn(
                                  "py-2 rounded-xl font-black text-[9px] uppercase tracking-wider border transition-all cursor-pointer",
                                  fontSize === size 
                                    ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 text-zinc-500"
                                )}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Communications & Language</h3>
                      
                      <div className="space-y-4">
                        {/* Language Selection Infobox */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex items-start gap-3">
                          <Globe size={18} className="text-blue-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">Automatic Translation</p>
                            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold leading-relaxed">
                              TeenGenius now auto-detects language inputs. Notes and solutions generate in English by default. Original regional scripts (Telugu, Hindi, Sanskrit, French) are preserved only when educational value dictates.
                            </p>
                          </div>
                        </div>

                        {/* Push notifications toggler */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-3xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Bell size={18} className="text-blue-500" />
                            <div>
                              <p className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">Push Alerts</p>
                              <p className="text-[10px] text-zinc-400 font-semibold italic">Study cues and circular updates</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setPushEnabled(!pushEnabled)}
                            className={cn(
                              "w-12 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer",
                              pushEnabled ? "bg-emerald-500" : "bg-zinc-250 dark:bg-zinc-805"
                            )}
                          >
                            <span className={cn(
                              "block w-5 h-5 bg-white rounded-full transition-all shadow-sm",
                              pushEnabled ? "translate-x-6" : "translate-x-0"
                            )} />
                          </button>
                        </div>

                        {/* Email Digest toggler */}
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-3xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Mail size={18} className="text-blue-500" />
                            <div>
                              <p className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-tight">Email Digests</p>
                              <p className="text-[10px] text-zinc-400 font-semibold italic">Weekly dashboard insights report</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setEmailDigest(!emailDigest)}
                            className={cn(
                              "w-12 h-6 rounded-full relative p-0.5 transition-colors cursor-pointer",
                              emailDigest ? "bg-emerald-500" : "bg-zinc-250 dark:bg-zinc-805"
                            )}
                          >
                            <span className={cn(
                              "block w-5 h-5 bg-white rounded-full transition-all shadow-sm",
                              emailDigest ? "translate-x-6" : "translate-x-0"
                            )} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ACCOUNT TAB */}
                {activeTab === 'account' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Profile Credentials</h3>
                      
                      <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Display Avatar Badge</label>
                            <select
                              value={selectedBadge}
                              onChange={(e) => setSelectedBadge(e.target.value)}
                              className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs font-bold outline-none"
                            >
                              <option value="novice">🎓 Novice Scholar</option>
                              <option value="pioneer">⚡ Cognitive Pioneer</option>
                              <option value="polymath">🔬 Quantum Polymath</option>
                              <option value="wizard">🧠 Synaptic Wizard</option>
                            </select>
                          </div>
                      
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Active Name</label>
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder="Name"
                              className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs font-bold text-zinc-900 dark:text-white placeholder:font-normal"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={isSavingProfile}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl shadow transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isSavingProfile ? 'Saving...' : 'Save Profile details'}
                          </button>
                          {profileSuccess && (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1.5">
                              <CheckCircle2 size={13} /> Saved successfully!
                            </span>
                          )}
                        </div>
                      </form>
                    </div>

                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Password Change</h3>
                      
                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Current Security Key</label>
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-900 dark:text-white"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">New Password</label>
                              <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-900 dark:text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Confirm New Password</label>
                              <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-900 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>

                        {passMessage && (
                          <div className={cn(
                            "p-3 rounded-xl text-xs font-bold border",
                            passMessage.type === 'success' 
                              ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                              : "bg-red-500/5 border-red-500/10 text-red-600 dark:text-red-400"
                          )}>
                            {passMessage.text}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isChangingPass}
                          className="bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all disabled:opacity-50"
                        >
                          {isChangingPass ? 'Modifying security...' : 'Change Password'}
                        </button>
                      </form>
                    </div>

                    {/* Exit option for mobile */}
                    <div className="block md:hidden border-t border-zinc-100 dark:border-zinc-800 pt-5">
                      <button
                        onClick={() => {
                          onClose();
                          logout();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-650 transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest"
                      >
                        <LogOut size={14} />
                        Exit Session
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. SUPPORT & HELP TAB */}
                {activeTab === 'support' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">Help Center FAQ & Onboarding</h3>
                      
                      {/* Walkthrough Quick Launcher */}
                      <div className="p-4 mb-4 bg-gradient-to-r from-blue-600/10 to-indigo-650/10 border border-blue-500/25 rounded-2.5xl flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-0.5 text-center sm:text-left">
                          <p className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">Welcome Onboarding Tour</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold leading-relaxed">
                            Relaunch our custom interactive guide to understand study rooms, notes labs, and AI timers.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('trigger-walkthrough'));
                            }, 50);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-md shadow-blue-500/15 shrink-0 cursor-pointer"
                        >
                          Relaunch Walkthrough 🚀
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-2.5xl">
                          <p className="text-xs font-black uppercase text-zinc-800 dark:text-white tracking-wider mb-1">How do Study Circles work?</p>
                          <p className="text-[10px] text-zinc-450 dark:text-zinc-400 leading-relaxed font-semibold">
                            Study Circles coordinate secure node rooms where group students can chat, curate modules, share class roadmap benchmarks, and generate group sandbox quizzes instantly.
                          </p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-2.5xl">
                          <p className="text-xs font-black uppercase text-zinc-800 dark:text-white tracking-wider mb-1">Is my workspace information hidden?</p>
                          <p className="text-[10px] text-zinc-450 dark:text-zinc-400 leading-relaxed font-semibold">
                            Yes. TeenGenius is built around absolute student protection and local client persistence with no diagnostic leaks.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Report Bug form */}
                      <div className="p-5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-[2rem] space-y-3.5">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-white flex items-center gap-1.5">
                          <AlertTriangle size={15} className="text-amber-500" /> Report Bug / Glitch
                        </p>
                        <form onSubmit={handleSubmitBug} className="space-y-2.5">
                          <input
                            type="text"
                            required
                            value={bugTitle}
                            onChange={(e) => setBugTitle(e.target.value)}
                            placeholder="Title of bug"
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-[10px] font-bold"
                          />
                          <textarea
                            required
                            value={bugDesc}
                            onChange={(e) => setBugDesc(e.target.value)}
                            placeholder="Describe how to reproduce..."
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-[10px] min-h-[60px]"
                          />
                          <select
                            value={bugSeverity}
                            onChange={(e) => setBugSeverity(e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-[10px] font-bold"
                          >
                            <option value="low">Low severity</option>
                            <option value="medium">Medium severity</option>
                            <option value="high">Blocking issue</option>
                          </select>
                          
                          {bugSuccess && (
                            <div className="text-[10px] text-emerald-500 font-bold bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 flex items-center gap-1">
                              <CheckCircle2 size={13} /> Thank you! Bug reported successfully.
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isSubmittingBug}
                            className="bg-zinc-900 dark:bg-zinc-800 text-white text-[9px] font-black uppercase tracking-widest py-2 px-4 rounded-xl float-right"
                          >
                            {isSubmittingBug ? 'Reporting...' : 'Submit Bug'}
                          </button>
                        </form>
                      </div>

                      {/* Contact Support form */}
                      <div className="p-5 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-800 rounded-[2rem] space-y-3.5">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-white flex items-center gap-1.5">
                          <Mail size={15} className="text-blue-500" /> Contact Support
                        </p>
                        <form onSubmit={handleSubmitContact} className="space-y-2.5">
                          <input
                            type="text"
                            value={contactSubject}
                            onChange={(e) => setContactSubject(e.target.value)}
                            placeholder="Subject (Optional)"
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-[10px] font-bold"
                          />
                          <textarea
                            required
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                            placeholder="Write your email inquiry here..."
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-[10px] min-h-[90px]"
                          />
                          
                          {contactSuccess && (
                            <div className="text-[10px] text-emerald-500 font-bold bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 flex items-center gap-1">
                              <CheckCircle2 size={13} /> Message sent. We will respond within 24 hours.
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isSubmittingContact}
                            className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest py-2 px-4 rounded-xl float-right"
                          >
                            {isSubmittingContact ? 'Sending...' : 'Contact Us'}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. ABOUT TAB */}
                {activeTab === 'about' && (
                  <div className="space-y-6">
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-150 dark:border-zinc-850 rounded-[2.5rem] flex items-center gap-5">
                      <div className="w-16 h-16 bg-blue-600 text-white rounded-2.5xl flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-500/20">
                        TG
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">TeenGenius Space</h4>
                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Platform Version 2.4.0</p>
                        <p className="text-[8px] text-zinc-450 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Created for Students • Safety Verified</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex border-b border-zinc-100 dark:border-zinc-850 pb-2">
                        <FileText size={16} className="text-zinc-400 mr-2 shrink-0 animate-bounce" />
                        <div>
                          <p className="text-xs font-black uppercase text-zinc-900 dark:text-white">Student Shield Privacy Policy</p>
                          <p className="text-[10px] text-zinc-450 dark:text-zinc-400 leading-relaxed font-semibold mt-1">
                            TeenGenius values your absolute privacy. Student logs, roadmap indexes, chatbot prompts, and study goals generated in active study rooms are stored securely inside private environment database clusters and are never aggregated or indexed.
                          </p>
                        </div>
                      </div>

                      <div className="flex border-b border-zinc-100 dark:border-zinc-850 pb-2">
                        <Shield size={16} className="text-zinc-400 mr-2 shrink-0" />
                        <div>
                          <p className="text-xs font-black uppercase text-zinc-900 dark:text-white">Workspace Terms of Service</p>
                          <p className="text-[10px] text-zinc-450 dark:text-zinc-400 leading-relaxed font-semibold mt-1">
                            By joining TeenGenius peer networks, you agree to collaborative guidelines, honest study aid practices, constructive feedback transmissions, and respectful communication models. Usage of API shortcuts for system scraping is fully restricted.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Back Button */}
              <div className="mt-8 border-t border-zinc-100 dark:border-zinc-800 pt-5 flex justify-end">
                <button
                  onClick={onClose}
                  className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-[10px] font-black uppercase tracking-widest py-3 px-6 rounded-xl transition-all cursor-pointer"
                >
                  Close Settings
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
