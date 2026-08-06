import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

interface PolishedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export const PolishedSelect = forwardRef<HTMLSelectElement, PolishedSelectProps>(
  ({ label, error, hint, options, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full appearance-none rounded-2xl border bg-zinc-50/80 dark:bg-zinc-850/50 px-4 py-3 pr-10 text-sm font-semibold text-zinc-900 dark:text-zinc-100',
              'border-zinc-200 dark:border-zinc-800',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400',
              'hover:border-zinc-300 dark:hover:border-zinc-700',
              error && 'border-red-400 dark:border-red-500 focus:ring-red-500/20 focus:border-red-500'
            )}
            {...props}
          >
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none"
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

PolishedSelect.displayName = 'PolishedSelect';
