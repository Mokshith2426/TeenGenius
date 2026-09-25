import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
              <BookOpen size={18} className="text-purple-500" />
              1. Accepting These Terms
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              By using TeenGenius, you agree to these terms, our academic integrity rules, and our safety guidelines. If you are under Class 10 (or under 13–16, depending on where you live), you confirm that a parent, guardian, or teacher has reviewed these terms with you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" />
              2. What the App Is For
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              TeenGenius is here to help you learn, take notes, prepare for tests, and stay focused. Use the study guides and answers it generates responsibly, and check them before you submit them as your own work.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-pink-500" />
              3. Staying Respectful
            </h2>
            <div className="space-y-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
              <p>When you use the Focus Zone or Classrooms with other students, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Never post anything offensive, hurtful, or inappropriate.</li>
                <li>Respect other students' progress and their focus time.</li>
                <li>Follow your own school's rules on classroom and assignment conduct.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
              4. AI Answers Can Be Wrong
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              TeenGenius uses AI to generate study answers. AI is helpful but not perfect, so always double-check answers against your textbook or your teacher's notes before you hand anything in.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
              5. Intellectual Property
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
              The app's design, logo, and features belong to TeenGenius. Anything you write, upload, or create stays yours.
            </p>
          </section>

        </main>
      </div>
    </div>
  );
}
