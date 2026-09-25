import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Lock, Eye, FileText, CheckCircle } from 'lucide-react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 md:p-12 font-sans transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-10">
        
        {/* Back Button and Header */}
        <header className="space-y-4">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back to Home
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Shield size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Your Data</p>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Privacy Policy</h1>
            </div>
          </div>
          <p className="text-zinc-450 dark:text-zinc-500 text-xs font-semibold uppercase tracking-widest">Last Updated: June 11, 2026</p>
        </header>

        {/* Core Document Body */}
        <main className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-10 space-y-8 shadow-sm">
          
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Lock size={18} className="text-blue-500" />
              1. Our Commitment to Students
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              TeenGenius is built for students, so protecting your privacy matters to us. This page explains what we collect, what we do with it, and how we keep it safe. We follow the student-privacy rules set out by COPPA (Children's Online Privacy Protection Act) and GDPR.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Eye size={18} className="text-indigo-500" />
              2. What We Collect
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
              <p>We only collect what the app needs to work for you:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-zinc-800 dark:text-zinc-200">Your Account:</strong> the display name and email address Google verifies when you sign in. We never see or store your password.</li>
                <li><strong className="text-zinc-800 dark:text-zinc-200">Your Study Content:</strong> the quizzes, notes, plans, and chats you create in the app.</li>
                <li><strong className="text-zinc-800 dark:text-zinc-200">Usage Stats:</strong> study duration, focus minutes, and which features get used — counted in aggregate and anonymised. These stats never include the content of your notes or chats.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-500" />
              3. How We Protect Your Data
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              Your profile, notes, and questions are stored in secure databases with strict access rules. Your data is tied to your account only, so other users cannot open or search it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-rose-500" />
              4. AI Chats and Questions
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              AI replies are requested through TeenGenius's own server. Your chats are never sold, and they are never used to build advertising profiles.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
              5. Deleting Your Data
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              You can clear your study plans and notes at any time from inside the app. You can also ask us to delete your account and everything in it — email teengenius@council.aistudio.com and we will help you.
            </p>
          </section>

        </main>
      </div>
    </div>
  );
}
