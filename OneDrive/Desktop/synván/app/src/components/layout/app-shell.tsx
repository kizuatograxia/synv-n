'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Header } from './header';
import { OrganizerSidebar, AdminSidebar } from './sidebar';
import { Footer } from './footer';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { DefaultErrorFallback } from '@/components/ui/error-boundary';
import { X } from 'lucide-react';

export interface AppShellProps {
  children: React.ReactNode;
  showFooter?: boolean;
  showSidebar?: boolean;
  sidebarRole?: 'ORGANIZER' | 'ADMIN';
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  showFooter = true,
  showSidebar = false,
  sidebarRole,
}) => {
  const { data: session } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const effectiveSidebarRole = sidebarRole || session?.user?.role;
  const shouldShowSidebar = showSidebar && (effectiveSidebarRole === 'ORGANIZER' || effectiveSidebarRole === 'ADMIN');

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(prev => !prev);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        closeMobileSidebar();
      }
    };

    if (mobileSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen, closeMobileSidebar]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileSidebar();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileSidebarOpen, closeMobileSidebar]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        if (window.innerWidth >= 768) {
          setSidebarCollapsed(prev => !prev);
        } else {
          toggleMobileSidebar();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [toggleMobileSidebar]);

  useEffect(() => {
    if (mobileSidebarOpen && sidebarRef.current) {
      const focusableElements = sidebarRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (firstElement) {
        previousFocusRef.current = document.activeElement as HTMLElement;
        firstElement.focus();
      }

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTab);
      return () => {
        document.removeEventListener('keydown', handleTab);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [mobileSidebarOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-xl focus:font-medium"
      >
        Pular para o conteúdo principal
      </a>

      {/* Header */}
      <Header
        onMobileSidebarToggle={shouldShowSidebar ? toggleMobileSidebar : undefined}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex relative">
        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && shouldShowSidebar && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            aria-hidden="true"
            onClick={closeMobileSidebar}
          />
        )}

        {/* Sidebar (conditional) */}
        {shouldShowSidebar && (
          <div
            ref={sidebarRef}
            className={`
              fixed md:sticky top-16 h-[calc(100vh-4rem)] z-50 md:z-0
              transform transition-transform duration-300 ease-in-out
              ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
            role="complementary"
            aria-label={effectiveSidebarRole === 'ORGANIZER' ? 'Sidebar do Organizador' : 'Sidebar do Administrador'}
          >
            {/* Close button for mobile sidebar */}
            <button
              onClick={closeMobileSidebar}
              className="md:hidden absolute -right-12 top-6 bg-neutral-900 text-white p-2 rounded-xl hover:bg-neutral-800 transition-colors"
              aria-label="Fechar sidebar"
            >
              <X className="w-5 h-5" />
            </button>

            {effectiveSidebarRole === 'ORGANIZER' ? (
              <OrganizerSidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            ) : (
              <AdminSidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            )}

            <div
              role="status"
              aria-live="polite"
              className="sr-only"
            >
              {mobileSidebarOpen ? 'Sidebar aberta' : 'Sidebar fechada'}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 w-full transition-all duration-300"
          aria-label="Conteudo principal"
        >
          <ErrorBoundary
            fallback={
              <DefaultErrorFallback
                error={new Error('Erro ao carregar a página')}
                reset={() => window.location.reload()}
              />
            }
          >
            <div className="p-6 md:p-10">
              {children}
            </div>
          </ErrorBoundary>
        </main>
      </div>

      {/* Footer (conditional) */}
      {showFooter && (
        <Footer />
      )}
    </div>
  );
};

// Convenience wrapper for organizer pages
export const OrganizerAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppShell showSidebar sidebarRole="ORGANIZER">
    {children}
  </AppShell>
);

// Convenience wrapper for admin pages
export const AdminAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppShell showSidebar sidebarRole="ADMIN">
    {children}
  </AppShell>
);

// Convenience wrapper for authenticated pages without sidebar
export const AuthenticatedAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppShell showSidebar={false}>
    {children}
  </AppShell>
);
