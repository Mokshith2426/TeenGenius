import { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, CheckCircle2, Clock, ArrowRight, Loader2, FileText, Zap, BookOpen } from 'lucide-react';
import { safeFetch } from '../../lib/api';

interface RevisionMaterial {
  title: string;
  content: string;
  type: 'formula' | 'concept' | 'tip' | 'summary';
}

interface RevisionPack {
  subject: string;
  materials: RevisionMaterial[];
  flashcards: { question: string; answer: string }[];
}

export default function RevisionPack() {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [revisionPack, setRevisionPack] = useState<RevisionPack | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setRevisionPack(null);

    try {
      const response = await safeFetch('/api/ai/revision-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: subject,
          topic: topic || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate revision pack');
      }

      const data = await response.json();
      setRevisionPack(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate revision pack. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'formula':
        return 'from-blue-500/10 to-cyan-500/10 border-blue-500/15';
      case 'concept':
        return 'from-purple-500/10 to-pink-500/10 border-purple-500/15';
      case 'tip':
        return 'from-amber-500/10 to-orange-500/10 border-amber-500/15';
      case 'summary':
        return 'from-emerald-500/10 to-teal-500/10 border-emerald-500/15';
      default:
        return 'from-zinc-500/10 to-zinc-500/10 border-zinc-500/15';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'formula':
        return <Zap size={20} className="text-blue-600 dark:text-blue-400" />;
      case 'concept':
        return <BookOpen size={20} className="text-purple-600 dark:text-purple-400" />;
      case 'tip':
        return <CheckCircle2 size={20} className="text-amber-600 dark:text-amber-400" />;
      case 'summary':
        return <FileText size={20} className="text-emerald-600 dark:text-emerald-400" />;
      default:
        return <FileText size={20} className="text-zinc-600 dark:text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
        <ArrowRight size={12} />
        <span className="text-zinc-900 dark:text-white">Revision Pack</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 rounded-full border border-indigo-200/50 dark:border-indigo-850">
          <RefreshCw size={13} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
            Smart Revision
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Revision <span className="bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-transparent">Pack</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          AI-generated formula sheets, quick notes, important concepts, and flashcards from mistakes
        </p>
      </div>

      {/* Input Form */}
      {!revisionPack && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Physics"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Topic (Optional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Quadratic Equations, Newton's Laws"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating Revision Pack...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Generate Revision Pack
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}

      {/* Revision Pack Results */}
      {revisionPack && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Materials Grid */}
          <div className="grid grid-cols-1 gap-4">
            {revisionPack.materials.map((material, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-gradient-to-br ${getTypeColor(material.type)} border rounded-2xl p-6`}
              >
                <div className="flex items-start gap-3 mb-3">
                  {getTypeIcon(material.type)}
                  <h3 className="text-base font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                    {material.title}
                  </h3>
                </div>
                <div className="ml-8">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {material.content}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Flashcards */}
          {revisionPack.flashcards && revisionPack.flashcards.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8">
              <h3 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-6">
                Quick Revision Flashcards
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {revisionPack.flashcards.map((flashcard, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                          Question
                        </p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {flashcard.question}
                        </p>
                      </div>
                      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3">
                        <p className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">
                          Answer
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">
                          {flashcard.answer}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Back Button */}
          <button
            onClick={() => {
              setRevisionPack(null);
              setSubject('');
              setTopic('');
            }}
            className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-black uppercase tracking-wider rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
          >
            Generate New Revision Pack
          </button>
        </motion.div>
      )}
    </div>
  );
}