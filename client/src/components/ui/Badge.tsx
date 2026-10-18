import React from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-slate-800 text-slate-300 border-slate-700/60',
  success: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
  warning: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
  danger: 'bg-red-950/60 text-red-400 border-red-800/40',
  info: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/40',
  purple: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium tracking-wide uppercase ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
