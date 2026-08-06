import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonCardProps {
  className?: string;
  lines?: number;
  showImage?: boolean;
}

export function SkeletonCard({ className, lines = 3, showImage = false }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4', className)}>
      {showImage && (
        <div className="w-full h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
      )}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full',
              i === lines - 1 ? 'w-3/4' : 'w-full'
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={3} />
      ))}
    </div>
  );
}
