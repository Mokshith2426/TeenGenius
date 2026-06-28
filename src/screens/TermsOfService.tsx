import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, ArrowLeft, ShieldCheck, Scale, FileText } from 'lucide-react';

export default function TermsOfService() {
  const navigate = useNavigate();

  useEffect(() => {
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
            <div className="p-3 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-2xl">
              <Scale size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded w-fit">Academic Integrity</p>
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Terms of Service</h1>
            </div>
          </div>
          <p className="text-zinc-450 dark:text-zinc-500 text-xs font-semibold uppercase tracking-widest">Last Updated: June 11, 2026</p>
        </header>

        {/* Core Document Body */}
        <main className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-10 space-y-8 shadow-sm">
          
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <BookOpen size={18} className="text-purple-550" />
              1. Acceptance of Terms
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              By accessing, registering for, or using TeenGenius (the "Platform"), you signify your absolute consent to abide fully with these terms, academic integrity requirements, and safety principles. If you are under Class 10 or equivalent (under 13-16 years depending on territory), you certify your parents or respective academic coordinators have reviewed these terms with you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-550" />
              2. Permitted Educational Use
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              TeenGenius is offered strictly to assist, accelerate, and optimize your learning, notes management, test preparation, and focus circles. Students are expected to use the generated study guides, timetable lists, and doubt solutions responsibly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-pink-550" />
              3. Platform Integrity and Code of Conduct
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 font-medium leading-relaxed">
              <p>When studying in our collaborative Focus Rooms or circles, you pledge strictly to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Never share defamatory, offensive, or inappropriate contents.</li>
                <li>Respect the academic progress and focus boundaries of other students.</li>
                <li>Maintain compliance with the integrity and classroom guidelines of your school or institution.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
              4. Disclaimer of AI Outputs
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              TeenGenius utilizes advanced learning models compiled in our Gemini API stack. While highly accurate, study answers, math solutions, and memory palaces should be double-checked against your official textbook guidelines to verify ultimate exactness before exam submissions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
              5. Intellectual Property
            </h2>
            <p className="text-xs sm:text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
              The Platform elements (UI, designs, logos, interactive timers, notes generators) remain the exclusive ownership of TeenGenius Inc. Your personal uploaded text and logs remain your own property.
            </p>
          </section>

        </main>
      </div>
    </div>
  );
}
