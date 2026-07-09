import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';

interface ErrorScreenProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

export default function ErrorScreen({ error, resetErrorBoundary }: ErrorScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[10000] flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 blur-[100px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        <Logo size="lg" className="justify-center mb-12" />
        
        <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={48} />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-zinc-900 dark:text-white">
            Something <span className="text-red-500">Went Wrong</span>
          </h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] leading-relaxed italic">
            TeenGenius encountered an unexpected issue. Please try refreshing or return to your dashboard.
          </p>
          {error && (
            <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <code className="text-[10px] font-mono text-zinc-400 break-all">{error.message}</code>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-8">
          <button 
            onClick={() => resetErrorBoundary ? resetErrorBoundary() : window.location.reload()}
            className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-6 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl shadow-zinc-200 dark:shadow-none"
          >
            <RefreshCw size={18} />
            Try Again
          </button>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-white dark:bg-zinc-900 text-zinc-500 py-6 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 transition-all"
          >
            <Home size={18} />
            Return to Dashboard
          </button>
        </div>
      </motion.div>

      <div className="absolute bottom-12 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 dark:text-zinc-800">
        Error Code: APP_ERROR
      </div>
    </div>
  );
}
