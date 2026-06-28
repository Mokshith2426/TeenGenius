import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, ShieldAlert, CheckCircle, Send, Sparkles } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function Safety() {
  const { user, isSandbox } = useAuth();
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    itemType: 'Chat Message',
    reportedName: '',
    reason: 'Inappropriate language',
    comments: '',
  });

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reportedName.trim()) return;

    setIsSubmitting(true);
    try {
      if (isSandbox) {
        const reports = JSON.parse(localStorage.getItem('SANDBOX_REPORTS') || '[]');
        reports.push({
          id: 'sb_report_' + Date.now(),
          reporterId: user.uid,
          reporterName: user.displayName || 'Sandbox Student',
          itemType: form.itemType,
          reportedName: form.reportedName,
          reason: form.reason,
          comments: form.comments,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('SANDBOX_REPORTS', JSON.stringify(reports));
      } else if (user) {
        await addDoc(collection(db, 'reports'), {
          reporterId: user.uid,
          reporterName: user.displayName || 'Student',
          itemType: form.itemType,
          reportedName: form.reportedName,
          reason: form.reason,
          comments: form.comments,
          timestamp: serverTimestamp()
        });
      }
      setSuccess(true);
      setForm({
        itemType: 'Chat Message',
        reportedName: '',
        reason: 'Inappropriate language',
        comments: '',
      });
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reports');
    } finally {
      setIsSubmitting(false);
    }
  };

  const guidelines = [
    {
      title: "Be Kind & Supportive",
      desc: "Every student here is learning. Encourage your classmates, speak politely, and avoid mean comments. Bullying is strictly prohibited.",
      color: "border-blue-200 dark:border-blue-900 bg-blue-50/10 text-blue-600 dark:text-blue-400"
    },
    {
      title: "Keep it Academic",
      desc: "TeenGenius is your homework and study workspace. Avoid distracting topics, gaming talk, or off-topic links in study rooms.",
      color: "border-indigo-200 dark:border-indigo-900 bg-indigo-50/10 text-indigo-600 dark:text-indigo-400"
    },
    {
      title: "Protect Your Privacy",
      desc: "Never post your phone number, home address, social media passwords, or real-life school location in chat rooms.",
      color: "border-amber-200 dark:border-amber-900 bg-amber-50/10 text-amber-600 dark:text-amber-400"
    },
    {
      title: "Cite Your Sources",
      desc: "Do not copy homework directly from online without understanding it. Use the Homework Helper to learn step-by-step.",
      color: "border-emerald-200 dark:border-emerald-900 bg-emerald-50/10 text-emerald-600 dark:text-emerald-400"
    }
  ];

  return (
    <div className="space-y-10 max-w-5xl mx-auto p-4 md:p-6 pb-20">
      
      {/* Safety Banner Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 md:p-12 shadow-xl shadow-blue-500/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/10 rounded-full blur-xl -ml-8 -mb-8" />
        
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest leading-none">
            <Shield size={14} className="text-blue-300 animate-pulse" />
            TeenGenius Safety Hub
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase leading-tight">
            Your Safe Study <br />Headquarters
          </h1>
          <p className="text-xs md:text-sm text-blue-100 font-medium leading-relaxed">
            TeenGenius is built specifically for students in classes 6 to 12. We maintain a secure, friendly, and supportive workspace where everyone can study, ask questions, and grow together safely.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Safety Policy & Guidelines */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Moderation Controls Dashboard */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-150/80 dark:border-zinc-800/80 rounded-[2rem] p-6 md:p-8 shadow-xs">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                <ShieldCheckIcon />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Moderation Safeguards</h2>
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">Smart filters & protective shields</p>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-5 border border-zinc-200/50 dark:border-zinc-850/50 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">AI Profanity Shield</h3>
                  <p className="text-xs text-zinc-500 font-semibold leading-relaxed max-w-md">
                    Automatically filter hurtful words and inappropriate links from chat rooms and shared notes.
                  </p>
                </div>
                <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs flex items-center gap-1.5 self-start">
                  <Shield size={13} className="shrink-0" />
                  Active & Enforced
                </div>
              </div>

              <div className="border-t border-zinc-200/40 dark:border-zinc-800/60 pt-4 flex gap-3">
                <Sparkles size={16} className="text-blue-500 shrink-0" />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold italic">
                  Active Guard: Our background systems monitor shared Study Circles for cyberbullying and harmful content 24/7.
                </p>
              </div>
            </div>
          </section>

          {/* Guidelines Section */}
          <section className="space-y-5">
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">Community Guidelines</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guidelines.map((guide, idx) => (
                <div 
                  key={idx}
                  className={`border-[1.5px] rounded-[2rem] p-6 space-y-3 shadow-xs ${guide.color}`}
                >
                  <h3 className="text-md font-black uppercase tracking-tight">{guide.title}</h3>
                  <p className="text-xs text-zinc-650 dark:text-zinc-350 font-medium leading-relaxed italic">
                    {guide.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Right column: Incident Report Form */}
        <div className="lg:col-span-1">
          <section className="bg-white dark:bg-zinc-900 border border-zinc-150/80 dark:border-zinc-800/80 rounded-[2.2rem] p-6 md:p-8 shadow-xs sticky top-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Report Content</h2>
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">Keep our community safe</p>
              </div>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Content Type</label>
                <select
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                  value={form.itemType}
                  onChange={(e) => setForm(prev => ({ ...prev, itemType: e.target.value }))}
                >
                  <option>Chat Message</option>
                  <option>Study Circle Name</option>
                  <option>Homework Helper Solution</option>
                  <option>Shared Note</option>
                  <option>Student Profile</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Where did it happen?</label>
                <input
                  type="text"
                  placeholder="e.g. Chat room name or specific student's name"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white placeholder:font-normal placeholder:italic outline-none focus:ring-1 focus:ring-blue-500"
                  value={form.reportedName}
                  onChange={(e) => setForm(prev => ({ ...prev, reportedName: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Why are you reporting this?</label>
                <select
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                  value={form.reason}
                  onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                >
                  <option>Inappropriate language or cursing</option>
                  <option>Bullying or mean comments</option>
                  <option>Off-topic or spam links</option>
                  <option>Sharing private passwords/number</option>
                  <option>Other / Unsafe behavior</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-450 dark:text-zinc-400 font-bold">Extra Details (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Tell us more about what happened..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white placeholder:font-normal placeholder:italic outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  value={form.comments}
                  onChange={(e) => setForm(prev => ({ ...prev, comments: e.target.value }))}
                />
              </div>

              {success && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                  <CheckCircle size={15} className="shrink-0 mt-0.5" />
                  <span>Reported! Our safety and moderation team will inspect this content and take actions within 24 hours.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-zinc-950 dark:bg-blue-600 hover:bg-zinc-900 dark:hover:bg-blue-500 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest items-center justify-center flex gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={12} />
                    Submit Report
                  </>
                )}
              </button>
            </form>
          </section>
        </div>

      </div>

    </div>
  );
}

function ShieldCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
