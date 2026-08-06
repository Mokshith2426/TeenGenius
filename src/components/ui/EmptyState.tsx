import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center p-8 md:p-12', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-5">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300 mb-2">
        {title}
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {action}
        {secondaryAction}
      </div>
    </div>
  );
}
