import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { XCircle, CheckCircle2, Clock, ArrowRight, Loader2, Trash2, RotateCcw } from 'lucide-react';
import { safeFetch } from '../../lib/api';

interface Mistake {
  id: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  subject: string;
  topic: string;
  date: string;
  reviewed: boolean;
}

// Export the addMistake function for use by other components
export const addMistakeToBook = (mistake: Omit<Mistake, 'id' | 'date' | 'reviewed'>) => {
  const newMistake: Mistake = {
    ...mistake,
    id: Date.now().toString(),
    date: new Date().toISOString().split('T')[0],
    reviewed: false
  };

  const existing = JSON.parse(localStorage.getItem('TEEN_GENIUS_MISTAKE_BOOK') || '[]');
  const updated = [newMistake, ...existing];
  localStorage.setItem('TEEN_GENIUS_MISTAKE_BOOK', JSON.stringify(updated));
  
  // Dispatch event to update UI
  window.dispatchEvent(new CustomEvent('mistakeBookUpdated'));
};

export default function MistakeBook() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [filter, setFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('all');
  const [selectedMistake, setSelectedMistake] = useState<Mistake | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMistakes();
  }, []);

  const loadMistakes = () => {
    try {
      const savedMistakes = JSON.parse(localStorage.getItem('TEEN_GENIUS_MISTAKE_BOOK') || '[]');
      setMistakes(savedMistakes);
    } catch (err: any) {
      setError(err.message || 'Failed to load mistakes');
    }
  };

  const addMistake = (mistake: Omit<Mistake, 'id' | 'date' | 'reviewed'>) => {
    const newMistake: Mistake = {
      ...mistake,
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      reviewed: false
    };

    const updatedMistakes = [newMistake, ...mistakes];
    setMistakes(updatedMistakes);
    localStorage.setItem('TEEN_GENIUS_MISTAKE_BOOK', JSON.stringify(updatedMistakes));
  };

  const markAsReviewed = (id: string) => {
    const updatedMistakes = mistakes.map(m => 
      m.id === id ? { ...m, reviewed: true } : m
    );
    setMistakes(updatedMistakes);
    localStorage.setItem('TEEN_GENIUS_MISTAKE_BOOK', JSON.stringify(updatedMistakes));
  };

  const deleteMistake = (id: string) => {
    const updatedMistakes = mistakes.filter(m => m.id !== id);
    setMistakes(updatedMistakes);
    localStorage.setItem('TEEN_GENIUS_MISTAKE_BOOK', JSON.stringify(updatedMistakes));
    if (selectedMistake?.id === id) {
      setSelectedMistake(null);
    }
  };

  const clearAllMistakes = () => {
    if (window.confirm('Are you sure you want to clear all mistakes? This cannot be undone.')) {
      setMistakes([]);
      localStorage.removeItem('TEEN_GENIUS_MISTAKE_BOOK');
      setSelectedMistake(null);
    }
  };

  const generateRevisionTips = async (mistake: Mistake) => {
    setIsLoading(true);
    setError('');

    try {
      const prompt = `A student made a mistake on this question:
      
      Subject: ${mistake.subject}
      Topic: ${mistake.topic}
      Question: ${mistake.question}
      Student's Answer: ${mistake.userAnswer}
      Correct Answer: ${mistake.correctAnswer}
      
      Provide:
      1. Why the student's answer was wrong
      2. The correct concept/formula to remember
      3. A mnemonic or tip to avoid this mistake in the future
      4. Similar types of questions to practice
      
      Keep it concise and actionable.`;

      const response = await safeFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });

      if (!response.ok) {
        throw new Error('Failed to generate revision tips');
      }

      const data = await response.json();
      return data.text;
    } catch (err: any) {
      setError(err.message || 'Failed to generate tips');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMistakes = mistakes.filter(m => {
    if (filter === 'unreviewed') return !m.reviewed;
    if (filter === 'reviewed') return m.reviewed;
    return true;
  });

  const stats = {
    total: mistakes.length,
    unreviewed: mistakes.filter(m => !m.reviewed).length,
    reviewed: mistakes.filter(m => m.reviewed).length
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
        <ArrowRight size={12} />
        <span className="text-zinc-900 dark:text-white">Mistake Book</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-red-50 dark:bg-red-950/30 rounded-full border border-red-200/50 dark:border-red-850">
          <XCircle size={13} className="text-red-600 dark:text-red-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-400">
            Learn from Mistakes
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Mistake <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Book</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Automatically saved incorrect answers with explanations, concepts tested, and revision tips
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Total</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Unreviewed</p>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{stats.unreviewed}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Reviewed</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.reviewed}</p>
        </div>
      </div>

      {/* Filters */}
      {mistakes.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              filter === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('unreviewed')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              filter === 'unreviewed'
                ? 'bg-orange-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            Unreviewed ({stats.unreviewed})
          </button>
          <button
            onClick={() => setFilter('reviewed')}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              filter === 'reviewed'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            Reviewed ({stats.reviewed})
          </button>
        </div>
      )}

      {/* Mistake List or Detail View */}
      {selectedMistake ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-xs font-black text-red-700 dark:text-red-400">
                    {selectedMistake.subject}
                  </span>
                  <span className="px-3 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {selectedMistake.topic}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedMistake.date}</p>
              </div>
              <button
                onClick={() => setSelectedMistake(null)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                ← Back
              </button>
            </div>

            <div className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Question</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{selectedMistake.question}</p>
            </div>

            <div className="p-5 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800 rounded-2xl">
              <p className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-400 mb-2">Your Answer</p>
              <p className="text-sm font-medium text-red-900 dark:text-red-100">{selectedMistake.userAnswer}</p>
            </div>

            <div className="p-5 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">Correct Answer</p>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{selectedMistake.correctAnswer}</p>
            </div>

            <div className="p-5 bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl">
              <p className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2">Explanation</p>
              <p className="text-sm text-blue-900 dark:text-blue-100">{selectedMistake.explanation}</p>
            </div>

            <div className="flex gap-3">
              {!selectedMistake.reviewed && (
                <button
                  onClick={() => {
                    markAsReviewed(selectedMistake.id);
                    setSelectedMistake({ ...selectedMistake, reviewed: true });
                  }}
                  className="flex-1 py-3 bg-emerald-600 text-white font-black uppercase tracking-wider rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Mark as Reviewed
                </button>
              )}
              <button
                onClick={() => deleteMistake(selectedMistake.id)}
                className="px-6 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-black uppercase tracking-wider rounded-xl hover:bg-red-100 dark:hover:bg-red-950/40 transition-all flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {filteredMistakes.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500/10 to-rose-500/10 rounded-3xl flex items-center justify-center border border-red-500/15 mb-4">
                <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">
                No Mistakes Yet!
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {mistakes.length === 0 
                  ? 'Mistakes from practice tests and quizzes will appear here automatically.'
                  : 'No mistakes match the current filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMistakes.map((mistake, index) => (
                <motion.div
                  key={mistake.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedMistake(mistake)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-red-50 dark:bg-red-950/20 rounded-xl flex items-center justify-center">
                      <XCircle size={20} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-xs font-black text-red-700 dark:text-red-400">
                          {mistake.subject}
                        </span>
                        {mistake.reviewed && (
                          <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded text-xs font-black text-emerald-700 dark:text-emerald-400">
                            Reviewed
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1 line-clamp-2">
                        {mistake.question}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{mistake.topic} • {mistake.date}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {mistakes.length > 0 && (
            <button
              onClick={clearAllMistakes}
              className="w-full py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-black uppercase tracking-wider rounded-xl hover:bg-red-100 dark:hover:bg-red-950/40 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Clear All Mistakes
            </button>
          )}
        </>
      )}
    </div>
  );
}