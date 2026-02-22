'use client';

import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  caption?: string;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function Table<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'Nenhum dado disponível',
  caption,
  onSort,
  onRowClick,
}: TableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: string) => {
    let newDirection: SortDirection = 'asc';

    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        newDirection = 'desc';
      } else if (sortDirection === 'desc') {
        newDirection = null;
      }
    }

    setSortColumn(newDirection ? column : null);
    setSortDirection(newDirection);

    if (onSort && newDirection) {
      onSort(column, newDirection);
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-3.5 h-3.5 text-primary-600" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-3.5 h-3.5 text-primary-600" />;
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />;
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600">{emptyMessage}</p>
      </div>
    );
  }

  const handleRowKeyDown = (row: T, e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  const getAriaSort = (column: string): 'ascending' | 'descending' | 'none' | undefined => {
    if (sortColumn !== column) return undefined;
    if (sortDirection === 'asc') return 'ascending';
    if (sortDirection === 'desc') return 'descending';
    return 'none';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200/60">
      <table className="min-w-full divide-y divide-neutral-100">
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead className="bg-neutral-50/80">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-6 py-3.5 text-left text-[11px] font-semibold text-neutral-600 uppercase tracking-wider',
                  column.sortable && 'cursor-pointer hover:bg-neutral-100/80 transition-colors'
                )}
                onClick={() => column.sortable && handleSort(column.key)}
                aria-sort={getAriaSort(column.key)}
                aria-label={column.sortable ? `Ordenar por ${column.label}` : column.label}
                scope="col"
              >
                <div className="flex items-center gap-2">
                  {column.label}
                  {column.sortable && getSortIcon(column.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-neutral-100">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                'transition-colors',
                onRowClick && 'cursor-pointer hover:bg-primary-50/30'
              )}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(e) => handleRowKeyDown(row, e)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-6 py-4 whitespace-nowrap text-sm text-neutral-700"
                >
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
