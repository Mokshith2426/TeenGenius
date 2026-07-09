import React from 'react';
import { Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Logo({ className, iconOnly = false, size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const iconSizes = {
    sm: 12,
    md: 20,
    lg: 32,
    xl: 48
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg md:text-xl',
    lg: 'text-2xl md:text-3xl',
    xl: 'text-3xl md:text-5xl'
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "bg-zinc-900 dark:bg-zinc-100 rounded-[30%] flex items-center justify-center text-white dark:text-zinc-900 shadow-2xl relative overflow-hidden group",
        sizes[size]
      )}>
        {/* Abstract pattern inside logo */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full border-t border-l border-white/40 rotate-45 translate-x-2 translate-y-2" />
        </div>
        
        <Target size={iconSizes[size]} strokeWidth={3} className="relative z-10 transition-transform group-hover:scale-110" />
      </div>
      
      {!iconOnly && (
        <div className="flex flex-col leading-none">
          <span className={cn(
            "font-black tracking-tighter uppercase italic text-zinc-900 dark:text-white",
            textSizes[size]
          )}>
            Teen<span className="text-blue-600">Genius</span>
          </span>
          {size !== 'sm' && (
            <span className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-400 italic">AI Study Partner</span>
          )}
        </div>
      )}
    </div>
  );
}
