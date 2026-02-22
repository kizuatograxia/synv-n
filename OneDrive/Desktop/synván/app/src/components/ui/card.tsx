import React from 'react';
import { cn } from '@/lib/cn';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  variant?: 'default' | 'glass';
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = ({ children, className, padding = 'md', hover = false, variant = 'default' }: CardProps) => {
  return (
    <div className={cn(
      'rounded-2xl border transition-all duration-200',
      variant === 'glass'
        ? 'glass border-white/20'
        : 'bg-white border-neutral-200/60 shadow-card',
      hover && 'hover:shadow-card-hover hover:-translate-y-0.5',
      paddingStyles[padding],
      className
    )}>
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader = ({ children, className }: CardHeaderProps) => (
  <div className={cn('mb-4', className)}>
    {children}
  </div>
);

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle = ({ children, className }: CardTitleProps) => (
  <h3 className={cn('text-xl font-display font-semibold text-neutral-900', className)}>
    {children}
  </h3>
);

export interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const CardDescription = ({ children, className }: CardDescriptionProps) => (
  <p className={cn('text-sm text-neutral-600 mt-1', className)}>
    {children}
  </p>
);

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent = ({ children, className }: CardContentProps) => (
  <div className={cn(className)}>
    {children}
  </div>
);

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter = ({ children, className }: CardFooterProps) => (
  <div className={cn('mt-4 pt-4 border-t border-neutral-100', className)}>
    {children}
  </div>
);
