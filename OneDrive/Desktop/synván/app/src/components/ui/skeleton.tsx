'use client';

import React from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  width,
  height,
}) => {
  const variantStyles = {
    text: 'rounded-lg h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 bg-[length:200%_100%] rounded',
        variantStyles[variant],
        className
      )}
      style={style}
      role="status"
      aria-label="Carregando..."
      aria-live="polite"
    />
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('bg-white rounded-2xl border border-neutral-200/60 shadow-card p-6', className)}>
    <Skeleton variant="rectangular" height={200} className="mb-4" />
    <Skeleton variant="text" width="60%" className="mb-2" />
    <Skeleton variant="text" width="80%" />
  </div>
);

export const SkeletonTableRow: React.FC<{ columnCount?: number }> = ({ columnCount = 5 }) => (
  <tr>
    {Array.from({ length: columnCount }).map((_, index) => (
      <td key={index} className="px-6 py-4">
        <Skeleton variant="text" width="80%" />
      </td>
    ))}
  </tr>
);

export const SkeletonTable: React.FC<{ rowCount?: number; columnCount?: number }> = ({
  rowCount = 5,
  columnCount = 5,
}) => (
  <div className="overflow-x-auto rounded-xl border border-neutral-200/60">
    <table className="min-w-full divide-y divide-neutral-100">
      <thead className="bg-neutral-50/80">
        <tr>
          {Array.from({ length: columnCount }).map((_, index) => (
            <th key={index} className="px-6 py-3.5">
              <Skeleton variant="text" width={100} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-neutral-100">
        {Array.from({ length: rowCount }).map((_, index) => (
          <SkeletonTableRow key={index} columnCount={columnCount} />
        ))}
      </tbody>
    </table>
  </div>
);

export const SkeletonStat: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('bg-white rounded-2xl border border-neutral-200/60 shadow-card p-6', className)}>
    <Skeleton variant="text" width="40%" className="mb-2" />
    <Skeleton variant="text" width="70%" height={32} className="mb-4" />
    <Skeleton variant="text" width="50%" />
  </div>
);

export const SkeletonTextBlock: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        variant="text"
        width={index === lines - 1 ? '70%' : '100%'}
      />
    ))}
  </div>
);
