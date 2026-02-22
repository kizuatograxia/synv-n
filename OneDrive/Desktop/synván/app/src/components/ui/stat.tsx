'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface StatProps {
  label: string;
  value: string | number;
  trend?: {
    direction: TrendDirection;
    value: string;
  };
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: {
    label: 'text-xs',
    value: 'text-2xl',
  },
  md: {
    label: 'text-sm',
    value: 'text-3xl',
  },
  lg: {
    label: 'text-base',
    value: 'text-4xl',
  },
};

const trendIcons = {
  up: <TrendingUp className="w-3.5 h-3.5" />,
  down: <TrendingDown className="w-3.5 h-3.5" />,
  neutral: <Minus className="w-3.5 h-3.5" />,
};

const trendColors = {
  up: 'text-success-700 bg-success-50',
  down: 'text-error-700 bg-error-50',
  neutral: 'text-neutral-600 bg-neutral-100',
};

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  trend,
  icon,
  size = 'md',
  className,
}) => {
  return (
    <div className={cn('bg-white rounded-2xl border border-neutral-200/60 shadow-card p-6', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn(sizeStyles[size].label, 'font-medium text-neutral-600')}>
            {label}
          </p>
          <p className={cn(sizeStyles[size].value, 'font-display font-bold text-neutral-900 mt-2')}>
            {value}
          </p>
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3">
          <span
            className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium', trendColors[trend.direction])}
          >
            {trendIcons[trend.direction]}
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
};
