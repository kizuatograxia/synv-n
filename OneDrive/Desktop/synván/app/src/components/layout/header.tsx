'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, ChevronDown, User, LogOut, LayoutDashboard, Calendar, PanelLeft, Search, ShoppingCart, Bell } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface NavLink {
  href: string;
  label: string;
  roles?: string[];
}

export interface HeaderProps {
  navLinks?: NavLink[];
  onMobileSidebarToggle?: () => void;
}

// Main navigation items matching ticket360.com.br
const mainNavItems = [
  { href: '/events?category=casas-clubes', label: 'Casas/Clubes' },
  { href: '/events?category=musica', label: 'Música' },
  { href: '/events?category=artistas', label: 'Artistas' },
  { href: '/events', label: 'Eventos' },
  { href: '/events?category=estados', label: 'Estados' },
  { href: '/events?category=turne', label: 'Turnês' },
];

export const Header: React.FC<HeaderProps> = ({
  navLinks = [],
  onMobileSidebarToggle,
}) => {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<(HTMLElement | null)[]>([]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/login' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/events?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleUserMenuKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setUserMenuOpen(false);
      return;
    }

    if (!userMenuOpen) return;

    const items = menuItemsRef.current.filter(Boolean) as HTMLElement[];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[next]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prev]?.focus();
    }
  }, [userMenuOpen]);

  useEffect(() => {
    if (userMenuOpen) {
      const items = menuItemsRef.current.filter(Boolean) as HTMLElement[];
      items[0]?.focus();
    }
  }, [userMenuOpen]);

  return (
    <header className="bg-white border-b border-light-border sticky top-0 z-40">
      <nav aria-label="Navegação principal" className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            {onMobileSidebarToggle && (
              <button
                onClick={onMobileSidebarToggle}
                className="md:hidden p-2 mr-2 rounded-lg text-light-secondary hover:text-accent hover:bg-accent-50 transition-colors"
                aria-label="Abrir menu lateral"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
            )}
            <Link href="/" className="text-2xl font-display font-bold text-accent">
              Sympla 360
            </Link>
          </div>

          {/* Desktop Navigation - ticket360.com.br style */}
          <div className="hidden lg:flex items-center space-x-1">
            {mainNavItems.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-light-text hover:text-accent rounded-lg hover:bg-gray-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search Bar - 450px width on desktop (ticket360.com.br) */}
          <div className="hidden md:flex flex-1 max-w-[450px] mx-4">
            <form onSubmit={handleSearch} className="w-full relative">
              <input
                type="text"
                placeholder="Buscar eventos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-4 pr-10 text-sm border border-light-border rounded-lg bg-white text-light-text placeholder:text-light-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-light-secondary hover:text-accent transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Right Side - Cart, Notifications, User */}
          <div className="flex items-center gap-2">
            {/* Cart Icon */}
            <Link
              href="/cart"
              className="p-2 rounded-lg text-light-secondary hover:text-accent hover:bg-accent-50 transition-colors relative"
              aria-label="Carrinho de compras"
            >
              <ShoppingCart className="w-5 h-5" />
            </Link>

            {/* Notifications Icon */}
            <button
              className="p-2 rounded-lg text-light-secondary hover:text-accent hover:bg-accent-50 transition-colors relative hidden sm:block"
              aria-label="Notificações"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full"></span>
            </button>

            {/* User Menu */}
            {status === 'loading' ? (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            ) : session ? (
              <div className="relative ml-1" ref={userMenuRef} onKeyDown={handleUserMenuKeyDown}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-light-text hover:text-accent transition-colors rounded-lg hover:bg-gray-50"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-controls="user-menu"
                >
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                    <User className="w-4 h-4 text-white" aria-hidden="true" />
                  </div>
                  <span className="hidden sm:block">{session.user?.name}</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", userMenuOpen && "rotate-180")} aria-hidden="true" />
                </button>

                {userMenuOpen && (
                  <div
                    id="user-menu"
                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-light-border py-2 z-50"
                    role="menu"
                    aria-label="Menu do usuário"
                  >
                    <Link
                      href="/orders"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-light-text hover:bg-gray-50 hover:text-accent transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                      tabIndex={-1}
                      ref={(el) => { menuItemsRef.current[0] = el; }}
                    >
                      <Calendar className="w-4 h-4" aria-hidden="true" />
                      Meus Ingressos
                    </Link>
                    <Link
                      href="/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-light-text hover:bg-gray-50 hover:text-accent transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                      tabIndex={-1}
                      ref={(el) => { menuItemsRef.current[1] = el; }}
                    >
                      <User className="w-4 h-4" aria-hidden="true" />
                      Minha Carteira
                    </Link>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-light-text hover:bg-gray-50 hover:text-accent transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                      role="menuitem"
                      tabIndex={-1}
                      ref={(el) => { menuItemsRef.current[2] = el; }}
                    >
                      <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                      Dashboard
                    </Link>
                    <hr className="my-2 border-light-border" aria-hidden="true" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-error hover:bg-error-50 transition-colors"
                      role="menuitem"
                      tabIndex={-1}
                      ref={(el) => { menuItemsRef.current[3] = el; }}
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link
                  href="/auth/login"
                  className="px-3 py-1.5 text-sm font-medium text-light-text hover:text-accent rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-accent rounded-lg hover:bg-accent-600 transition-colors"
                >
                  Cadastrar
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-light-secondary hover:text-accent hover:bg-accent-50 transition-colors"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="block h-5 w-5" />
              ) : (
                <Menu className="block h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Search Bar - 335px width on mobile (ticket360.com.br) */}
      <div className="md:hidden px-4 pb-3">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-4 pr-10 text-sm border border-light-border rounded-lg bg-white text-light-text placeholder:text-light-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-light-secondary hover:text-accent"
            aria-label="Buscar"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-light-border" id="mobile-menu">
          <div className="px-4 py-3 space-y-1 bg-white" role="menu">
            {mainNavItems.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-2.5 text-base font-medium text-light-text hover:text-accent hover:bg-gray-50 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
                role="menuitem"
              >
                {link.label}
              </Link>
            ))}

            {session ? (
              <>
                <hr className="my-2 border-light-border" aria-hidden="true" />
                <Link
                  href="/orders"
                  className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-light-text hover:text-accent hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  role="menuitem"
                >
                  <Calendar className="w-5 h-5" />
                  Meus Ingressos
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-light-text hover:text-accent hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  role="menuitem"
                >
                  <User className="w-5 h-5" />
                  Minha Carteira
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 px-3 py-2.5 text-base font-medium text-light-text hover:text-accent hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  role="menuitem"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-base font-medium text-error hover:bg-error-50 rounded-lg transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
              </>
            ) : (
              <div className="pt-2 space-y-2">
                <Link
                  href="/auth/login"
                  className="block px-3 py-2.5 text-base font-medium text-light-text hover:text-accent hover:bg-gray-50 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="block px-3 py-2.5 text-base font-semibold text-center text-white bg-accent rounded-lg hover:bg-accent-600 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Cadastrar
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
