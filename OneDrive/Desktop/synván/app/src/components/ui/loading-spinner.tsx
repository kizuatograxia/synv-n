'use client';

import React from 'react';
import { cn } from '@/lib/cn';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'neutral';
  className?: string;
}

const sizeStyles = {
  sm: 'w-[1rem] h-[1rem]',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const colorStyles = {
  primary: 'text-primary-500',
  secondary: 'text-secondary-500',
  neutral: 'text-neutral-600',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando"
      className={cn('flex items-center justify-center', className)}
    >
      <svg
        className={cn('animate-spin', sizeStyles[size], colorStyles[color])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Carregando...</span>
    </div>
  );
};

export default LoadingSpinner;
