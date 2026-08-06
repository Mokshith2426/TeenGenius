import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface PolishedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  glow?: boolean;
}

export function PolishedButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  glow = false,
  className,
  disabled,
  ...props
}: PolishedButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-extrabold uppercase tracking-widest rounded-2xl transition-all duration-200 cursor-pointer select-none';

  const variants = {
    primary: cn(
      'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700',
      'shadow-md shadow-blue-600/10 hover:shadow-lg hover:shadow-blue-600/20',
      glow && 'shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40',
      'disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:shadow-none disabled:cursor-not-allowed'
    ),
    secondary: cn(
      'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 active:bg-zinc-950 dark:active:bg-zinc-200',
      'disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed'
    ),
    ghost: cn(
      'bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700',
      'disabled:text-zinc-300 dark:disabled:text-zinc-600 disabled:cursor-not-allowed'
    ),
    danger: cn(
      'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
      'disabled:bg-red-200 dark:disabled:bg-red-900/30 disabled:text-red-400 dark:disabled:text-red-600 disabled:cursor-not-allowed'
    ),
  };

  const sizes = {
    sm: 'px-3.5 py-2 text-[10px]',
    md: 'px-5 py-3 text-xs',
    lg: 'px-8 py-4 text-sm',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin shrink-0" />}
      {!loading && icon && <span className="shrink-0">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
}
