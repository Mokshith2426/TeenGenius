import React from 'react';
import { motion } from 'motion/react';
import Logo from './Logo';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[9999] flex flex-col items-center justify-center overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <Logo size="xl" />
        
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="w-48 h-1 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden relative">
            <motion.div 
              className="absolute inset-0 bg-blue-600"
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-zinc-400 italic">Entering workspace...</p>
        </div>
      </motion.div>

      <div className="absolute bottom-12 left-0 right-0 text-center flex flex-col items-center gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 dark:text-white">
          Crafted by <span className="text-blue-600">Mokshith Ramavathu</span>
        </p>
        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-700">
          TeenGenius &copy; 2026
        </p>
      </div>
    </div>
  );
}
