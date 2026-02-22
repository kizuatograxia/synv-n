import React from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  success: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  error: 'bg-error-50 text-error-700 border-error-100',
  info: 'bg-primary-50 text-primary-700 border-primary-100',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200/60',
};

const dotColors = {
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  info: 'bg-primary-500',
  neutral: 'bg-neutral-400',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export const Badge = ({ children, variant = 'neutral', size = 'md', dot = false, className }: BadgeProps) => {
  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-lg border gap-1.5',
      variantStyles[variant],
      sizeStyles[size],
      className
    )}>
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />
      )}
      {children}
    </span>
  );
};
