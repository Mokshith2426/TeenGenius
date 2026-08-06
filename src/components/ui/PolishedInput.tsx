import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface PolishedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const PolishedInput = forwardRef<HTMLInputElement, PolishedInputProps>(
  ({ label, error, hint, icon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-2xl border bg-zinc-50/80 dark:bg-zinc-850/50 px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100',
              'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
              'border-zinc-200 dark:border-zinc-800',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400',
              'hover:border-zinc-300 dark:hover:border-zinc-700',
              error && 'border-red-400 dark:border-red-500 focus:ring-red-500/20 focus:border-red-500',
              icon && 'pl-11',
              props.type === 'date' && '[color-scheme:light_dark]'
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-fadeIn">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">{hint}</p>
        )}
      </div>
    );
  }
);

PolishedInput.displayName = 'PolishedInput';
