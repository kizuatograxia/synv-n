'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { Input, Textarea, Select } from './input';

export type FormFieldProps = {
  name: string;
  label?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'datetime-local' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  options?: Array<{ value: string; label: string }>;
  validateOnChange?: boolean;
  schema?: z.ZodSchema<any>;
  onChange?: (value: string) => void;
  error?: string;
  helperText?: string;
  className?: string;
  value?: string;
};

export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  autoComplete,
  options,
  validateOnChange = false,
  schema,
  onChange,
  error: externalError,
  helperText,
  className,
  value,
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [touched, setTouched] = useState(false);

  const error = externalError || internalError;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const newValue = e.target.value;

    if (schema && (validateOnChange || touched)) {
      try {
        schema.parse(newValue);
        setInternalError('');
      } catch (err) {
        if (err instanceof z.ZodError) {
          const firstError = err.issues[0];
          setInternalError(firstError?.message || 'Valor inválido');
        }
      }
    }

    onChange?.(newValue);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const commonProps = {
    name,
    label,
    error,
    helperText,
    required,
    fullWidth: true,
    className,
    onChange: handleChange,
    onBlur: handleBlur,
    value,
  };

  if (type === 'textarea') {
    return <Textarea placeholder={placeholder} {...commonProps} />;
  }

  if (type === 'select' && options) {
    return <Select options={options} {...commonProps} />;
  }

  return (
    <Input
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      {...commonProps}
    />
  );
};
