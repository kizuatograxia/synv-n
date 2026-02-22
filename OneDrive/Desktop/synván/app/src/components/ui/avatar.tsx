'use client';

import React from 'react';
import { cn } from '@/lib/cn';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  ring?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const statusColors = {
  online: 'bg-success-500',
  offline: 'bg-neutral-400',
  away: 'bg-warning-600',
  busy: 'bg-error-500',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  name = '',
  size = 'md',
  status,
  ring = false,
  className,
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarContent = src ? (
    <img
      src={src}
      alt={alt || name}
      className={cn(sizeStyles[size], 'rounded-xl object-cover')}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : (
    <div
      className={cn(
        sizeStyles[size],
        'rounded-xl gradient-primary text-white flex items-center justify-center font-semibold'
      )}
    >
      {getInitials(name)}
    </div>
  );

  return (
    <div className={cn(
      'relative inline-block',
      ring && 'ring-2 ring-primary-200 ring-offset-2 rounded-xl',
      className
    )}>
      {avatarContent}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white',
            statusColors[size === 'sm' ? 'offline' : status]
          )}
          title={status}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};
