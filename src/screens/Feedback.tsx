import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { HeartHandshake, Star, Send, Mail, CheckCircle2, Loader2, MessageSquare, AlertTriangle, Lightbulb, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { safeFetch } from '../lib/api';

type FeedbackType = 'bug' | 'feature' | 'general' | 'praise';

export default function Feedback() {
  const { user } = useAuth();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const typeConfig = {
    bug: {
      label: 'Bug Report',
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-600 dark:bg-red-950/25 border-red-100 dark:border-red-900/30'
    },
    feature: {
      label: 'Feature Request',
      icon: Lightbulb,
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/25 border-amber-100 dark:border-amber-900/30'
    },
    general: {
      label: 'General Inquiry',
      icon: MessageSquare,
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/25 border-blue-100 dark:border-blue-900/30'
    },
    praise: {
      label: 'Appreciation',
      icon: Trophy,
      color: 'bg-green-50 text-green-600 dark:bg-green-950/25 border-green-100 dark:border-green-900/30'
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg('Please describe your feedback details.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    const feedbackData = {
      userId: user?.uid || 'anonymous',
      name: user?.displayName || 'Anonymous',
      email: user?.email || 'N/A',
      feedbackType,
      rating,
      message: message.trim(),
      timestamp: serverTimestamp()
    };

    try {
      // 1. Save directly to secure firebase feedbacks collection
      await addDoc(collection(db, 'feedbacks'), feedbackData);

      // 2. Notify the Express server
      await safeFetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedbackType,
          rating,
          message: message.trim(),
          name: user?.displayName || 'Anonymous Student',
          email: user?.email || 'mokshith1512@gmail.com'
        })
      });

      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Feedback Submit Error:', err);
      // Fallback: If Firebase failed or something, we still let them proceed to mailto
      setErrorMsg('Failed to sync to database, but you can still launch Gmail directly below!');
    } finally {
      setIsLoading(false);
    }
  };

  const getMailtoLink = () => {
    const subject = encodeURIComponent(`[TeenGenius Applet] Feedback: ${typeConfig[feedbackType].label}`);
    const body = encodeURIComponent(
      `Hi Mokshith,\n\nI am sending this feedback from ${user?.displayName || 'Student'} (${user?.email || 'No email'}).\n\n--- Feedback Details ---\nType: ${typeConfig[feedbackType].label}\nRating: ${rating} / 5 stars\nMessage: ${message}\n\nSubmitted on: ${new Date().toLocaleString()}\n\nBest regards,\n${user?.displayName || 'Student'}`
    );
    return `mailto:mokshith1512@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-3xl mx-auto space-y-8 md:space-y-12 pb-24">
      <header className="space-y-3 md:space-y-4 text-center">
        <div className="w-16 h-16 bg-zinc-900 dark:bg-zinc-850 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl relative">
          <HeartHandshake size={32} className="text-blue-500 animate-pulse" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase">
            Feedback & <span className="text-blue-600">Support</span>
          </h1>
          <p className="text-zinc-550 dark:text-zinc-400 font-medium text-xs md:text-sm italic mt-1 leading-relaxed">
            Co-designing the Ultimate Workspace. Submissions routed directly to developer at <b className="text-zinc-650 dark:text-zinc-250 italic">mokshith1512@gmail.com</b>
          </p>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <motion.div
            key="feedback-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-805/50 rounded-3xl md:rounded-[3rem] p-5 sm:p-8 md:p-12 shadow-xl shadow-zinc-200/40 dark:shadow-none"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {errorMsg && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-105 dark:border-red-900/35 rounded-2xl text-xs font-bold leading-normal">
                  {errorMsg}
                </div>
              )}

              {/* Feedback Type Tabs */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 ml-1">
                  How can we optimize?
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(Object.keys(typeConfig) as FeedbackType[]).map((type) => {
                    const cfg = typeConfig[type];
                    const isSelected = feedbackType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFeedbackType(type)}
                        className={cn(
                          "p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all",
                          isSelected
                            ? "border-blue-500 bg-blue-50/40 dark:bg-blue-955/20 text-blue-600 ring-2 ring-blue-500/10"
                            : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/10 text-zinc-400"
                        )}
                      >
                        <cfg.icon size={20} className={cn(isSelected && "scale-110", "transition-transform")} />
                        <span className="text-[10px] font-black uppercase tracking-wider">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slider / Stars */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 ml-1">
                  Rate your Experience ({rating}/5 Stars)
                </label>
                <div className="flex gap-2 items-center justify-center md:justify-start px-2 py-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100/50 dark:border-zinc-800/20">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = hoverRating !== null ? star <= hoverRating : star <= rating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 focus:outline-none cursor-pointer transition-transform duration-100 hover:scale-125"
                      >
                        <Star
                          size={32}
                          className={cn(
                            "transition-all duration-150",
                            isFilled
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-200 dark:text-zinc-700 hover:text-amber-250"
                          )}
                        />
                      </button>
                    );
                  })}
                  <span className="text-xs font-mono font-black uppercase text-zinc-400 ml-4 hidden md:inline tracking-widest">
                    {rating === 5 ? 'Masterclass!' : rating === 4 ? 'Great flow' : rating === 3 ? 'Usable' : rating === 2 ? 'Needs tweaking' : 'Needs urgent rebuild'}
                  </span>
                </div>
              </div>

              {/* Message Details */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 ml-1">
                  Constructive Analysis & Notes
                </label>
                <textarea
                  placeholder="Analyze defects, layout suggestions, or specific feature criteria you'd like to implement..."
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl p-6 text-sm font-medium leading-relaxed italic border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all placeholder-zinc-400"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-5 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-50 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-zinc-150 dark:shadow-none"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin text-zinc-400" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  {isLoading ? 'Transmitting Module...' : 'Transmit Feedback'}
                </button>
                <a
                  href={getMailtoLink()}
                  className="flex-1 py-5 border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                >
                  <Mail size={16} />
                  Or Launch Gmail Direct
                </a>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="feedback-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[3rem] p-12 text-center shadow-xl space-y-8"
          >
            <div className="inline-flex p-5 bg-green-50 dark:bg-green-950/20 text-green-600 rounded-[2rem] border border-green-105 dark:border-green-900/40 relative">
              <CheckCircle2 size={54} className="animate-bounce" />
            </div>
            
            <div className="space-y-3 max-w-lg mx-auto">
              <h2 className="text-2xl font-black uppercase text-zinc-900 dark:text-white tracking-tight">
                Feedback Received!
              </h2>
              <p className="text-sm text-zinc-500 font-medium italic">
                Thank you! Your feedback has been saved safely. Your suggestions help us make TeenGenius better.
              </p>
            </div>

            <div className="p-6 bg-zinc-50 dark:bg-zinc-850/40 border border-zinc-100 dark:border-zinc-800 rounded-3xl max-w-md mx-auto space-y-4">
              <p className="text-xs text-zinc-500 font-bold leading-normal italic">
                Would you like to also send this directly via email to mokshith1512@gmail.com?
              </p>
              <a
                href={getMailtoLink()}
                className="w-full inline-flex py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl justify-center items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Mail size={16} />
                Send Email
              </a>
            </div>

            <button
              onClick={() => {
                setMessage('');
                setRating(5);
                setIsSubmitted(false);
              }}
              className="px-8 py-3 bg-zinc-105 hover:bg-zinc-100 text-zinc-600 dark:text-zinc-300 font-bold text-xs uppercase tracking-widest rounded-xl border border-zinc-200/50 dark:border-zinc-700 cursor-pointer"
            >
              Analyze Another Category
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
