import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'neutral';
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const variantStyles = {
  success: 'bg-success-50 border-l-success-500 text-success-800',
  error: 'bg-error-50 border-l-error-500 text-error-800',
  warning: 'bg-warning-50 border-l-warning-500 text-warning-800',
  info: 'bg-primary-50 border-l-primary-500 text-primary-800',
  neutral: 'bg-neutral-50 border-l-neutral-400 text-neutral-800',
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  children,
  onClose,
  className,
}) => {
  return (
    <div className={cn(
      'px-4 py-3 rounded-xl border-l-4 flex items-start gap-3',
      variantStyles[variant],
      className
    )} role="alert">
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Fechar alerta"
        >
          <X className="w-[1rem] h-[1rem]" />
        </button>
      )}
    </div>
  );
};
