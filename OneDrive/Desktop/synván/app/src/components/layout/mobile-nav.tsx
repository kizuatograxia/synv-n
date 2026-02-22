'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { X, User, LogOut, LayoutDashboard, Calendar, Menu } from 'lucide-react';

export interface MobileNavProps {
  navLinks?: {
    href: string;
    label: string;
    icon?: React.ReactNode;
  }[];
  isOpen?: boolean;
  onClose?: () => void;
  showRoleBasedLinks?: boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  navLinks = [],
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showRoleBasedLinks = true,
}) => {
  const typedNavLinks: Array<{ href: string; label: string; icon?: React.ReactNode }> = navLinks;
  const { data: session } = useSession();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const onClose = controlledOnClose !== undefined ? controlledOnClose : () => setInternalIsOpen(false);

  const closeNav = useCallback(() => {
    onClose();
  }, [onClose]);

  const defaultNavLinks: Array<{ href: string; label: string; icon?: React.ReactNode }> = [
    { href: '/events', label: 'Eventos' },
  ];

  const roleBasedNavLinks = session?.user?.role ? [
    ...(session.user.role === 'ORGANIZER' || session.user.role === 'ADMIN' ? [
      {
        href: '/organizer/dashboard',
        label: 'Organizador',
        icon: <LayoutDashboard className="w-5 h-5" aria-hidden="true" />,
      },
    ] : []),
    ...(session.user.role === 'ADMIN' ? [
      {
        href: '/admin/dashboard',
        label: 'Admin',
        icon: <LayoutDashboard className="w-5 h-5" aria-hidden="true" />,
      },
    ] : []),
  ] : [];

  const allLinks: Array<{ href: string; label: string; icon?: React.ReactNode }> = [
    ...defaultNavLinks,
    ...(showRoleBasedLinks ? roleBasedNavLinks : []),
    ...typedNavLinks,
  ];

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/login' });
    closeNav();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && navRef.current && !navRef.current.contains(event.target as Node)) {
        closeNav();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeNav]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNav();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeNav]);

  useEffect(() => {
    if (isOpen && navRef.current) {
      const focusableElements = navRef.current.querySelectorAll(
        'a[href], button:not([disabled])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      previousFocusRef.current = document.activeElement as HTMLElement;
      firstElement?.focus();

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
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden"
          aria-hidden="true"
          onClick={closeNav}
        />
      )}

      {/* Slide-out navigation */}
      <div
        ref={navRef}
        className={`
          fixed top-0 right-0 h-full w-80 max-w-[85vw] glass shadow-elevated z-50
          transform transition-transform duration-300 ease-in-out md:hidden
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegacao"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200/60">
          <h2 className="text-lg font-display font-bold text-neutral-900">Menu</h2>
          <button
            onClick={closeNav}
            className="p-2.5 rounded-xl text-neutral-600 hover:text-neutral-700 hover:bg-neutral-100/80 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto p-4" aria-label="Navegacao móvel">
          <div className="space-y-1">
            {allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-neutral-700 hover:text-primary-600 hover:bg-primary-50/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={closeNav}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>

          {session && (
            <>
              <hr className="my-4 border-neutral-100" aria-hidden="true" />
              <div className="space-y-1">
                <p className="px-4 text-xs font-semibold text-neutral-500 uppercase tracking-widest">
                  Minha Conta
                </p>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-neutral-700 hover:text-primary-600 hover:bg-primary-50/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={closeNav}
                >
                  <User className="w-5 h-5" aria-hidden="true" />
                  Perfil
                </Link>
                <Link
                  href="/orders"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-neutral-700 hover:text-primary-600 hover:bg-primary-50/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={closeNav}
                >
                  <Calendar className="w-5 h-5" aria-hidden="true" />
                  Meus Pedidos
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-neutral-700 hover:text-primary-600 hover:bg-primary-50/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={closeNav}
                >
                  <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
                  Dashboard
                </Link>
              </div>
            </>
          )}
        </nav>

        {/* Footer with login/logout */}
        <div className="p-4 border-t border-neutral-200/60">
          {session ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-base font-medium text-error-600 hover:bg-error-50 transition-colors focus:outline-none focus:ring-2 focus:ring-error-500"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              Sair
            </button>
          ) : (
            <div className="space-y-2">
              <Link
                href="/auth/login"
                className="block w-full px-4 py-3.5 rounded-xl text-base font-medium text-center text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={closeNav}
              >
                Entrar
              </Link>
              <Link
                href="/auth/register"
                className="block w-full px-4 py-3.5 rounded-xl text-base font-semibold text-center text-white gradient-primary hover:shadow-glow transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                onClick={closeNav}
              >
                Cadastrar
              </Link>
            </div>
          )}
        </div>

        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {isOpen ? 'Menu de navegação aberto' : 'Menu de navegação fechado'}
        </div>
      </div>
    </>
  );
};

export const MobileNavTrigger: React.FC<{
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}> = ({
  onClick,
  className = '',
  ariaLabel = 'Abrir menu de navegação',
}) => {
  return (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-xl text-neutral-600 hover:text-neutral-700 hover:bg-neutral-100/80 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden transition-colors ${className}`}
      aria-label={ariaLabel}
    >
      <Menu className="block h-6 w-6" />
    </button>
  );
};
