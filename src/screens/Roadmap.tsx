import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map, Zap, CheckCircle2, ChevronRight, Loader2, BookOpen, Star, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { safeFetch } from '../lib/api';

interface Milestone {
  title: string;
  description: string;
  time: string;
  proTip: string;
}

export default function Roadmap() {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<Milestone[]>([]);

  // Synchronize generated Roadmap in localStorage for offline compatibility
  useEffect(() => {
    const cachedRoadmap = localStorage.getItem('STUDENT_LOCAL_ROADMAP_CACHE');
    const cachedTopic = localStorage.getItem('STUDENT_LOCAL_ROADMAP_TOPIC');
    if (cachedRoadmap) {
      try {
        setRoadmap(JSON.parse(cachedRoadmap));
      } catch (e) {
        console.error("Failed loading cached roadmap:", e);
      }
    }
    if (cachedTopic) {
      setTopic(cachedTopic);
    }
  }, []);

  useEffect(() => {
    if (roadmap.length > 0) {
      localStorage.setItem('STUDENT_LOCAL_ROADMAP_CACHE', JSON.stringify(roadmap));
    }
    if (topic.trim()) {
      localStorage.setItem('STUDENT_LOCAL_ROADMAP_TOPIC', topic);
    }
  }, [roadmap, topic]);

  // Smooth scroll to generated roadmap when set
  useEffect(() => {
    if (roadmap.length > 0) {
      setTimeout(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [roadmap]);

  const generateRoadmap = async () => {
    if (!topic.trim()) return;
    if (!navigator.onLine) {
      setError("🔌 Learning Roadmap compilation requires an active internet connection. Please connect to continue mapping new domains!");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const response = await safeFetch('/api/gemini/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data?.error || "We could not create your study roadmap. Please try again.");
      }
      setRoadmap(data.roadmap || []);
    } catch (err: any) {
      console.error("Roadmap Generation Error:", err);
      setError(err?.message || "Failed to create study map.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="w-14 h-14 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl flex items-center justify-center shadow-2xl">
            <Map size={28} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase">
              Mission <span className="text-blue-600">Architect</span>
            </h1>
            <p className="text-zinc-500 font-medium italic">Generate high-precision learning paths for any domain.</p>
          </div>
        </div>
        
        <div className="flex-1 max-w-md w-full">
          <div className="relative group">
            <input 
              type="text"
              placeholder="What do you want to master?"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl px-6 py-5 font-bold text-zinc-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 transition-all outline-none pr-16 shadow-lg shadow-zinc-100 dark:shadow-none"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateRoadmap()}
            />
            <button 
              onClick={generateRoadmap}
              disabled={isGenerating}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 p-3 rounded-2xl hover:scale-105 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} />}
            </button>
          </div>
        </div>
      </header>

      <div className="relative">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 font-bold text-xs rounded-2xl border border-red-100 dark:border-red-900/30 mb-8"
            >
              {error}
            </motion.div>
          )}

          {isGenerating ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-32 flex flex-col items-center gap-6"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-600/20 rounded-full animate-spin border-t-blue-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Map size={20} className="text-blue-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-black uppercase tracking-tighter text-zinc-900 dark:text-white">Mapping Terrain...</p>
                <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mt-2">{topic}</p>
              </div>
            </motion.div>
          ) : roadmap.length > 0 ? (
            <motion.div 
              key="roadmap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              {/* Timeline Line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800 hidden md:block" />

              <div className="grid gap-12">
                {roadmap.map((milestone, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative md:pl-24"
                  >
                    {/* Circle on line */}
                    <div className="absolute left-5 top-8 -translate-x-1/2 w-6 h-6 rounded-full border-4 border-white dark:border-zinc-950 bg-blue-600 z-10 hidden md:block" />
                    
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-zinc-100/50 dark:shadow-none hover:border-blue-500/50 transition-all group overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -translate-y-16 translate-x-16" />
                      
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black py-1 px-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 uppercase tracking-widest">Stage 0{idx + 1}</span>
                            <div className="flex items-center gap-1.5 text-zinc-400">
                              <Clock size={12} />
                              <span className="text-[10px] font-bold uppercase">{milestone.time}</span>
                            </div>
                          </div>
                          <h3 className="text-3xl font-black tracking-tighter uppercase text-zinc-900 dark:text-white leading-none">
                            {milestone.title}
                          </h3>
                          <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed italic">
                            {milestone.description}
                          </p>
                        </div>

                        <div className="md:w-64 bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                          <div className="flex items-center gap-2 mb-3">
                            <Star size={14} className="text-blue-600 fill-blue-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pro Tip</span>
                          </div>
                          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {milestone.proTip}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="pt-12 text-center text-zinc-400 italic text-sm">
                Mission Complete. Master these stages to achieve cognitive dominance.
              </div>
            </motion.div>
          ) : (
            <div className="py-40 text-center space-y-6">
              <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-900 rounded-[2.5rem] flex items-center justify-center mx-auto text-zinc-200 dark:text-zinc-800">
                <BookOpen size={48} strokeWidth={1} />
              </div>
              <div className="max-w-xs mx-auto">
                <h2 className="text-xl font-black text-zinc-300 dark:text-zinc-700 uppercase tracking-tight mb-2">Blank Terrain</h2>
                <p className="text-zinc-400 text-sm italic">Input a topic to let the AI architect your learning trajectory.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
