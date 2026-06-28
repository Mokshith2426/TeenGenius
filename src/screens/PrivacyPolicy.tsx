import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
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
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-450">Active Safeguards</p>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Privacy Policy</h1>
            </div>
          </div>
          <p className="text-zinc-450 dark:text-zinc-500 text-xs font-semibold uppercase tracking-widest">Last Updated: June 11, 2026</p>
        </header>

        {/* Core Document Body */}
        <main className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-10 space-y-8 shadow-sm">
          
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Lock size={18} className="text-blue-550" />
              1. Our Student Privacy Commitment
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              At TeenGenius, we prioritize student safety and privacy above all else. This privacy charter details how we gather, utilize, protect, and isolate your personal information, study documents, and platform logs. We comply fully with COPPA (Children’s Online Privacy Protection Act) and GDPR core protections as an offshore sandboxed educational companion.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Eye size={18} className="text-indigo-550" />
              2. Data We Safely Gather
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 font-medium leading-relaxed">
              <p>We restrict data collection exclusively to variables that improve your experience:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-zinc-800 dark:text-zinc-200">Account Identity:</strong> Display name and email addresses verified safely via Google Sign-In. We never store personal passwords.</li>
                <li><strong className="text-zinc-800 dark:text-zinc-200">Academic Assets:</strong> Practice quizzes, study notes, timetables, flashcards, and plans created by you.</li>
                <li><strong className="text-zinc-800 dark:text-zinc-200">Interaction Telemetry:</strong> Unbiased duration stats, focus minutes completed, and feature popularities aggregated anonymised on Firestore.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-555" />
              3. Data Security and Isolation
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              Your profile documents and doubt queries are hosted inside database collections compiled with strict safety rules. Data entries are strictly bound to your private account and cannot be queried by unauthorized external nodes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-rose-550" />
              4. AI Process and Chat Queries
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              All interactions routed through our AI Tutor and Homework Solver are secured using server-side Gemini endpoints. Chat conversations are not sent to third-party public networks for marketing indexing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
              5. Profile Deletion and Rights
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              Under our absolute lifecycle guarantee, students have the total right to clear study schedules or request system deletion from the platform. Contact teengenius@council.aistudio.com for quick assistance.
            </p>
          </section>

        </main>
      </div>
    </div>
  );
}
