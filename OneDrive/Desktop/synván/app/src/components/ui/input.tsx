import React, { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputLabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
}

export const InputLabel = ({ children, htmlFor, required }: InputLabelProps) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700 mb-1.5">
    {children}
    {required && <span className="text-error-500 ml-1">*</span>}
  </label>
);

export interface InputHelperTextProps {
  children: React.ReactNode;
  error?: boolean;
}

export const InputHelperText = ({ children, error = false }: InputHelperTextProps) => (
  <p className={cn('mt-1.5 text-sm', error ? 'text-error-600' : 'text-neutral-600')}>
    {children}
  </p>
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, fullWidth = false, className, id, required, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && <InputLabel htmlFor={inputId} required={required}>{label}</InputLabel>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'block rounded-xl border bg-neutral-50/50 shadow-sm sm:text-sm px-4 py-2.5 transition-all duration-200',
            'focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:bg-white focus:outline-none',
            'placeholder:text-neutral-500',
            error
              ? 'border-error-300 bg-error-50/30 focus:border-error-400 focus:ring-error-100'
              : 'border-neutral-200',
            fullWidth && 'w-full',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error || helperText ? `${inputId}-description` : undefined}
          {...props}
        />
        {(error || helperText) && (
          <InputHelperText error={!!error}>
            {error || helperText}
          </InputHelperText>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, fullWidth = false, className, id, required, rows = 3, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && <InputLabel htmlFor={inputId} required={required}>{label}</InputLabel>}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            'block rounded-xl border bg-neutral-50/50 shadow-sm sm:text-sm px-4 py-2.5 transition-all duration-200',
            'focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:bg-white focus:outline-none',
            'placeholder:text-neutral-500',
            error
              ? 'border-error-300 bg-error-50/30 focus:border-error-400 focus:ring-error-100'
              : 'border-neutral-200',
            fullWidth && 'w-full',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error || helperText ? `${inputId}-description` : undefined}
          {...props}
        />
        {(error || helperText) && (
          <InputHelperText error={!!error}>
            {error || helperText}
          </InputHelperText>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, fullWidth = false, className, id, required, options, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && <InputLabel htmlFor={inputId} required={required}>{label}</InputLabel>}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'block rounded-xl border bg-neutral-50/50 shadow-sm sm:text-sm px-4 py-2.5 transition-all duration-200',
            'focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:bg-white focus:outline-none',
            error
              ? 'border-error-300 bg-error-50/30 focus:border-error-400 focus:ring-error-100'
              : 'border-neutral-200',
            fullWidth && 'w-full',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error || helperText ? `${inputId}-description` : undefined}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {(error || helperText) && (
          <InputHelperText error={!!error}>
            {error || helperText}
          </InputHelperText>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
