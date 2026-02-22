'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, LayoutDashboard, Calendar, Users, TicketIcon, Settings, BarChart3, Key, DollarSign, UserCog, Shield } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SidebarItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  roles?: string[];
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  role: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

const defaultOrganizerSections: SidebarSection[] = [
  {
    items: [
      { href: '/organizer/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
      { href: '/organizer/events', label: 'Meus Eventos', icon: <Calendar className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Gerenciamento',
    items: [
      { href: '/organizer/payouts', label: 'Pagamentos', icon: <DollarSign className="w-5 h-5" /> },
      { href: '/team', label: 'Equipe', icon: <Users className="w-5 h-5" /> },
      { href: '/organizer/api-keys', label: 'API Keys', icon: <Key className="w-5 h-5" /> },
    ],
  },
];

const defaultAdminSections: SidebarSection[] = [
  {
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
      { href: '/admin/users', label: 'Usuários', icon: <UserCog className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/admin/payouts', label: 'Pagamentos', icon: <DollarSign className="w-5 h-5" /> },
      { href: '/admin/settings', label: 'Configurações', icon: <Settings className="w-5 h-5" /> },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  role,
  collapsed = false,
  onToggle,
}) => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/organizer/dashboard' || href === '/admin/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => !item.roles || item.roles.includes(role)),
  })).filter(section => section.items.length > 0);

  return (
    <aside
      className={cn(
        "bg-neutral-900 text-white transition-all duration-300 hidden md:flex flex-col",
        collapsed ? 'w-[4rem]' : 'w-[16rem]'
      )}
      aria-label={role === 'ADMIN' ? 'Menu administrativo' : 'Menu do organizador'}
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-4 top-6 bg-neutral-700 hover:bg-neutral-600 text-white rounded-full p-2 shadow-lg border-2 border-neutral-50 transition-all z-10"
        aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        aria-expanded={!collapsed}
        aria-controls="sidebar-nav"
      >
        {collapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>

      <nav id="sidebar-nav" aria-label="Navegacao lateral" className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
        {filteredSections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            {section.title && !collapsed && (
              <h3 className="px-3 mb-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                      isActive(item.href)
                        ? 'bg-primary-500/20 text-primary-400 font-medium'
                        : 'text-neutral-500 hover:bg-white/5 hover:text-white'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!collapsed && <span className="text-sm">{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-t border-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center font-semibold shadow-glow">
              {role === 'ADMIN' ? (
                <Shield className="w-5 h-5" />
              ) : (
                <TicketIcon className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {role === 'ADMIN' ? 'Administrador' : 'Organizador'}
              </p>
              <p className="text-xs text-neutral-500 truncate">Painel de Controle</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export const OrganizerSidebar: React.FC<{ collapsed?: boolean; onToggle?: () => void }> = (props) => (
  <Sidebar sections={defaultOrganizerSections} role="ORGANIZER" {...props} />
);

export const AdminSidebar: React.FC<{ collapsed?: boolean; onToggle?: () => void }> = (props) => (
  <Sidebar sections={defaultAdminSections} role="ADMIN" {...props} />
);
