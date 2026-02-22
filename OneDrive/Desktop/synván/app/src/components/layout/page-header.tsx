import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '../ui/button';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  className = '',
}) => {
  const hasBreadcrumbs = breadcrumbs.length > 0;

  return (
    <div className={cn('mb-8', className)}>
      {/* Breadcrumbs */}
      {hasBreadcrumbs && (
        <nav
          className="flex items-center space-x-1.5 text-sm mb-5"
          aria-label="Navegação estrutural"
        >
          {breadcrumbs.length > 0 && breadcrumbs[0].label !== 'Home' && (
            <Link
              href="/"
              className="text-neutral-500 hover:text-primary-500 transition-colors p-1"
              aria-label="Página inicial"
            >
              <Home className="w-[1rem] h-[1rem]" />
            </Link>
          )}

          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isHome = crumb.label === 'Home';

            return (
              <React.Fragment key={index}>
                {!isHome && (index > 0 || (breadcrumbs[0].label !== 'Home')) && (
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
                )}

                {isHome ? (
                  <Link
                    href="/"
                    className="text-neutral-500 hover:text-primary-500 transition-colors p-1"
                    aria-label="Página inicial"
                  >
                    <Home className="w-[1rem] h-[1rem]" />
                  </Link>
                ) : (
                  <>
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="px-2 py-1 text-neutral-600 hover:text-primary-600 hover:bg-primary-50/60 rounded-lg transition-all duration-200 font-medium"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className="px-2 py-1 text-neutral-800 font-semibold bg-neutral-100 rounded-lg"
                        aria-current="page"
                      >
                        {crumb.label}
                      </span>
                    )}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Header content */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-neutral-600 text-base max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-shrink-0 items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
