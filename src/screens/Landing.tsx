import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  FileText, 
  Clock, 
  Compass, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  Star, 
  Send,
  HelpCircle,
  MessageSquare,
  Users,
  ChevronDown
} from 'lucide-react';
import Logo from '../components/Logo';

export default function Landing() {
  const navigate = useNavigate();
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);

  const scrollToSection = (id: string) => {
    const container = document.getElementById('landing-scroll-container');
    const target = document.getElementById(id);
    if (container && target) {
      const containerTop = container.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      const offset = targetTop - containerTop + container.scrollTop - 80;
      container.scrollTo({
        top: offset,
        behavior: 'smooth'
      });
    }
  };
  
  // Contact Form States
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Feedback Form States
  const [feedbackType, setFeedbackType] = useState('contact');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) return;
    
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setTimeout(() => setSubmitSuccess(false), 5000);
    }, 1200);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    
    setTimeout(() => {
      setFeedbackSuccess(true);
      setFeedbackText('');
      setFeedbackRating(5);
      setTimeout(() => setFeedbackSuccess(false), 5000);
    }, 800);
  };

  const features = [
    {
      icon: MessageSquare,
      title: "Ask Study Questions",
      desc: "Get instant, direct answers on any school subject. Perfect when you are stuck or studying late at night.",
      badge: "24/7 Active Chat",
      color: "from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400"
    },
    {
      icon: BookOpen,
      title: "Homework Help",
      desc: "Step-by-step breakdowns for tricky equations and complex tasks, written so you actually understand them.",
      badge: "Easy Explanations",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400"
    },
    {
      icon: Sparkles,
      title: "Concept Explanations",
      desc: "Paste long textbook paragraphs to turn them into clear, simple revision summaries and dynamic flashcards.",
      badge: "Fast Summarizer",
      color: "from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400"
    },
    {
      icon: Compass,
      title: "Career Exploration",
      desc: "Discover amazing future jobs, find out what core subjects you need, and follow a direct path to reach your goals.",
      badge: "Future Pathways",
      color: "from-cyan-500/10 to-sky-500/10 text-cyan-600 dark:text-cyan-400"
    },
    {
      icon: Zap,
      title: "Skill Learning",
      desc: "Start learning vital real-world skills like basic programming, graphic design, content writing, and personal finance.",
      badge: "Hands-on Skills",
      color: "from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400"
    },
    {
      icon: Clock,
      title: "AI-Powered Guidance",
      desc: "Stay organized with smart test prep plans, personalized focus goals, and helpful study schedules built around you.",
      badge: "Exam Ready",
      color: "from-orange-500/10 to-amber-500/10 text-orange-600 dark:text-amber-400"
    }
  ];

  const examplePrompts = [
    { text: "Explain Photosynthesis with real-world analogies", tag: "Biology" },
    { text: "Help me solve this math problem: 3x + 5 = 20", tag: "Math" },
    { text: "Teach me Python basics for building a simple game", tag: "Coding" },
    { text: "Suggest a creative science project for high school", tag: "Science" },
    { text: "Help me prepare for my upcoming history exams", tag: "Study Prep" }
  ];

  const faqs = [
    {
      q: "What is TeenGenius?",
      a: "TeenGenius is your friendly, secure, AI-powered study buddy built strictly for students. It explains homework, makes clear review summaries, recommends career directions, and helps you learn valuable digital skills."
    },
    {
      q: "Is it easy enough for middle and high schoolers?",
      a: "Yes! The platform is designed specifically for students aged 13–17. We use clear layouts, big clickable buttons, and explain difficult concepts simply without confusing technology jargon."
    },
    {
      q: "Is my personal study data private?",
      a: "Absolutely. All your chats, questions, notes, and study logs are privately stored in your secure account. We don't share user data with outside companies or advertising systems."
    },
    {
      q: "Does TeenGenius cost anything?",
      a: "No! All core study tools, prompt chats, skills, quizzes, and career exploration roadmaps are 100% free with absolutely zero commercial ads or pop-up distractions."
    }
  ];

  const handlePromptClick = (promptText: string) => {
    navigate(`/login?prompt=${encodeURIComponent(promptText)}`);
  };

  return (
    <main id="landing-scroll-container" className="min-h-screen overflow-y-auto bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900 font-sans transition-colors duration-300">
      
      {/* ================= HEADER NAVBAR ================= */}
      <nav id="landing-navbar" className="sticky top-0 z-50 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-900/60 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-xs font-black tracking-widest text-zinc-400 uppercase hidden sm:inline border-l border-zinc-200 dark:border-zinc-800/80 pl-3">STUDENT HUB</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white uppercase tracking-wider transition-colors">What It Is</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white uppercase tracking-wider transition-colors">Features</a>
            <a href="#contact" onClick={(e) => { e.preventDefault(); scrollToSection('contact'); }} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white uppercase tracking-wider transition-colors hidden sm:inline-block">Support</a>
            
            <button 
              id="btn-nav-signin"
              onClick={() => navigate('/login')}
              className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-extrabold text-xs tracking-wider uppercase px-5 py-3 rounded-2xl shadow-lg transition-all active:scale-95"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* ================= HERO SECTION ================= */}
      <section id="hero-section" className="relative pt-16 pb-20 sm:pt-24 sm:pb-32 overflow-hidden">
        {/* Abstract Background Design */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30 dark:opacity-40">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl rounded-full" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-emerald-500/5 blur-2xl rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 max-w-4xl mx-auto"
          >
            {/* Top Micro Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-900/[0.04] dark:bg-white/[0.04] rounded-full border border-zinc-200/50 dark:border-zinc-800/50 w-fit mx-auto">
              <Sparkles size={12} className="text-indigo-500 animate-pulse animate-bounce" />
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-300">Your Friendly AI Study Buddy</span>
            </div>

            {/* Core Hero Header */}
            <h1 id="hero-headline" className="text-4xl sm:text-5xl md:text-6xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-[1.1] max-w-3xl mx-auto">
              Your AI Learning Companion <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent">for School, Skills, and Growth.</span>
            </h1>

            {/* Sub-Headline */}
            <p id="hero-subline" className="text-sm sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto font-medium leading-relaxed">
              Get direct step-by-step explanations, turn long study chapters into quick bullet notes, explore ideal future careers, and solve assignment bugs with an AI helper that actually explains things clearly.
            </p>

            {/* Call To Action Buttons */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none">
              <button
                id="btn-hero-start"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-black text-sm uppercase tracking-wider px-8 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all duration-200 active:scale-95 group"
              >
                Start Learning Now
                <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform" />
              </button>
              
              <a
                href="#features"
                onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}
                className="w-full sm:w-auto bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-250 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 font-extrabold text-sm uppercase tracking-wider px-8 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 text-center cursor-pointer"
              >
                See All Features
              </a>
            </div>

            {/* ================= INTERACTIVE EXAMPLE PROMPTS ================= */}
            <div id="example-prompts-container" className="pt-10 max-w-3xl mx-auto">
              <p className="text-xs font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Try asking anything or click to start:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {examplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePromptClick(prompt.text)}
                    className="bg-white dark:bg-zinc-900 border border-zinc-205 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-95 group text-left cursor-pointer"
                  >
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-extrabold px-1.5 py-0.5 rounded uppercase">{prompt.tag}</span>
                    <span className="truncate max-w-[200px] sm:max-w-xs">"{prompt.text}"</span>
                    <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-indigo-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Simple Trust Metrics */}
            <div className="pt-12 sm:pt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-left max-w-3xl mx-auto border-t border-zinc-200/50 dark:border-zinc-800/30">
              <div className="space-y-1">
                <p className="font-extrabold text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-200">100% Free & No Ads</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">Zero ads, completely free to learn</p>
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Safe and Private</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">Your files & answers are strictly secure</p>
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Student First</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">Clear, understandable answers</p>
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Career & Skills</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">Learn digital skills for your future</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= WHAT IS TEENGENIUS? SECTION ================= */}
      <section id="about" className="py-20 sm:py-24 bg-white dark:bg-zinc-900 border-y border-zinc-200/60 dark:border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-7 space-y-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-3.5 py-1 rounded-full w-fit">What is TeenGenius?</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
                A Friendly Study Partner That Explains Things Simply.
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
                Think of TeenGenius as your highly knowledgeable study helper. Whether you are struggling to understand a complex math equation, want a quick summary of a long history chapter, or want to pick up real-world skills like graphic design or coding, we are here for you.
              </p>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
                We remove complex technology jargon and present explanations with real-world examples, interactive tests, and simple roadmap cards so that learning feels motivating and satisfying.
              </p>
              
              <div className="pt-4">
                <button
                  id="btn-about-join"
                  onClick={() => navigate('/login')}
                  className="bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 group transition-all"
                >
                  Create Your Account
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Right Visual Highlight */}
            <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-zinc-950/40 dark:to-zinc-850/20 p-8 sm:p-10 rounded-3xl border border-zinc-200/50 dark:border-zinc-800 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Why Students Choose Us</h3>
              
              <div className="space-y-4">
                <div className="flex gap-3.5">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0 mt-0.5 text-xs">🔬</div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-zinc-850 dark:text-zinc-200">Real-World Examples</h4>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">Instead of direct formulas, we show how things apply to real-world objects.</p>
                  </div>
                </div>

                <div className="flex gap-3.5">
                  <div className="w-6 h-6 rounded-md bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center shrink-0 mt-0.5 text-xs">📚</div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-zinc-850 dark:text-zinc-200">Interactive Practice</h4>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">Convert any chapter summary directly into custom practice quizzes instantly.</p>
                  </div>
                </div>

                <div className="flex gap-3.5">
                  <div className="w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0 mt-0.5 text-xs">🎯</div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-zinc-850 dark:text-zinc-200">Personal Roadmaps</h4>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">Map your high school choices direct to college fields and modern digital careers.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ================= FEATURES SECTION ================= */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 dark:text-teal-400 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-1 rounded-full">Explore the Platform</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-zinc-900 dark:text-white leading-tight">
              A Complete Kit for Studying Smarter
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
              Every tool is built to save you time, remove study frustration, and help you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div 
                  key={idx} 
                  className="bg-white dark:bg-zinc-900/60 rounded-3xl p-8 border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-800 transition-all group hover:shadow-xl"
                >
                  <div>
                    <div className={`w-12 h-12 bg-gradient-to-r ${feat.color} rounded-2xl mb-6 flex items-center justify-center group-hover:scale-105 transition-transform`}>
                      <Icon size={20} />
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">{feat.title}</h3>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">{feat.badge}</span>
                    </div>
                    
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium mb-6">{feat.desc}</p>
                  </div>
                  
                  <button 
                    id={`btn-feature-${idx}`}
                    onClick={() => navigate('/login')}
                    className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-100 hover:text-indigo-600 flex items-center gap-1.5 transition-colors group-hover:translate-x-1 duration-200 w-fit cursor-pointer"
                  >
                    Open Tool 
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ================= INTERACTIVE Q&A (FAQ) ================= */}
      <section className="py-20 bg-white dark:bg-zinc-900/40 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-3.5 py-1 rounded-full">Help Center</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-zinc-900 dark:text-white">Frequently Asked Answers</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-150 dark:border-zinc-800 overflow-hidden transition-all duration-200"
              >
                <button
                  id={`btn-faq-toggle-${index}`}
                  onClick={() => setActiveFAQ(activeFAQ === index ? null : index)}
                  className="w-full text-left p-6 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <span className="text-zinc-400 text-lg transition-transform duration-200 shrink-0">
                    {activeFAQ === index ? '−' : '+'}
                  </span>
                </button>
                
                <AnimatePresence initial={false}>
                  {activeFAQ === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 pb-6 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SECURE FEEDBACK & CONTACT NODE ================= */}
      <section id="contact" className="py-20 sm:py-24 bg-zinc-50 dark:bg-zinc-950/90 border-t border-zinc-200 dark:border-zinc-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
          
          {/* Left Block */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900/[0.04] dark:bg-white/[0.04] rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-300 font-bold">Contact Hub</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none">
              Need Help? <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">Get in Touch</span>
            </h2>
            
            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 font-semibold leading-relaxed">
              Have questions about TeenGenius, want a new feature, or need help with your student account? Send us a quick note and our support team will get back to you!
            </p>

            <div className="space-y-4 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-905/5 dark:bg-white/5 flex items-center justify-center">
                  <ShieldCheck size={16} className="text-zinc-500 dark:text-zinc-400" />
                </div>
                <div className="text-xs">
                  <p className="font-extrabold text-zinc-800 dark:text-zinc-200">Friendly Support Email</p>
                  <p className="text-zinc-500 dark:text-zinc-400">hello@teengenius.aistudio.com</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Block */}
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200/70 dark:border-zinc-850 shadow-xl p-8 space-y-6">
            <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-2xl">
              <button 
                id="tab-btn-contact"
                onClick={() => setFeedbackType('contact')}
                className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${feedbackType === 'contact' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
              >
                Contact Us
              </button>
              <button 
                id="tab-btn-feedback"
                onClick={() => setFeedbackType('feature')}
                className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${feedbackType === 'feature' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
              >
                Share Feedback
              </button>
            </div>

            {feedbackType === 'contact' ? (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Your Name</label>
                  <input 
                    id="input-contact-name"
                    type="text" 
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Enter name"
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Your Email</label>
                  <input 
                    id="input-contact-email"
                    type="email" 
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="student@school.com"
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Message</label>
                  <textarea 
                    id="input-contact-message"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Tell us how we can help you today..."
                    rows={4}
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>

                <AnimatePresence mode="wait">
                  {submitSuccess ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-semibold"
                    >
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Message sent successfully! We will write back soon.
                    </motion.div>
                  ) : (
                    <button
                      id="btn-contact-submit"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-white font-extrabold text-xs tracking-wider uppercase py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:bg-zinc-400 shadow-md"
                    >
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </button>
                  )}
                </AnimatePresence>
              </form>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Rating</label>
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-50 dark:bg-zinc-950 w-fit rounded-xl border border-zinc-200/50 dark:border-zinc-800">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 focus:outline-none transition-transform active:scale-90"
                      >
                        <Star 
                          size={18} 
                          className={star <= feedbackRating ? "fill-amber-400 text-amber-500" : "text-zinc-300 dark:text-zinc-700"} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Feedback Text</label>
                  <textarea 
                    id="input-feedback-text"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="How is your study experience with TeenGenius? We would love to hear your suggestions!"
                    rows={4}
                    required
                    className="w-full bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-550 transition-colors resize-none"
                  />
                </div>

                <AnimatePresence mode="wait">
                  {feedbackSuccess ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-semibold"
                    >
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Thank you! Your suggestion has been saved.
                    </motion.div>
                  ) : (
                    <button
                      id="btn-feedback-submit"
                      type="submit"
                      className="w-full bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-white font-extrabold text-xs tracking-wider uppercase py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
                    >
                      Submit Feedback
                    </button>
                  )}
                </AnimatePresence>
              </form>
            )}
          </div>

        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer id="landing-footer" className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900 py-12 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <Logo size="sm" />
              <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">TEENGENIUS</span>
            </div>
            <p className="text-[11px] text-zinc-400">© 2026 TeenGenius. Built purely for private, safe school progression.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
            <button onClick={() => navigate('/login')} className="hover:text-zinc-900 dark:hover:text-white transition-colors">Study Desk</button>
            <span className="text-zinc-300 dark:text-zinc-850">|</span>
            <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }} className="hover:text-zinc-900 dark:hover:text-white transition-colors">About Us</a>
            <span className="text-zinc-300 dark:text-zinc-850">|</span>
            <button onClick={() => navigate('/privacy')} className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy Policy</button>
            <span className="text-zinc-300 dark:text-zinc-850">|</span>
            <button onClick={() => navigate('/terms')} className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>

    </main>
  );
}
