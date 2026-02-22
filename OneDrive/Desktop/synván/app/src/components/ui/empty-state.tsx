'use client';

import React from 'react';
import { FileX, Search, Inbox, Calendar, Ticket } from 'lucide-react';
import { cn } from '@/lib/cn';

export type EmptyStateType = 'no-data' | 'no-results' | 'no-items' | 'no-events' | 'no-listings';

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const defaultConfig = {
  'no-data': {
    icon: <Inbox className="w-12 h-12" />,
    title: 'Nenhum dado disponível',
    description: 'Ainda não há nada para exibir aqui.',
  },
  'no-results': {
    icon: <Search className="w-12 h-12" />,
    title: 'Nenhum resultado encontrado',
    description: 'Tente ajustar os filtros ou a busca.',
  },
  'no-items': {
    icon: <FileX className="w-12 h-12" />,
    title: 'Nenhum item encontrado',
    description: 'Não há itens para exibir no momento.',
  },
  'no-events': {
    icon: <Calendar className="w-12 h-12" />,
    title: 'Nenhum evento disponível',
    description: 'Ainda não há eventos agendados.',
  },
  'no-listings': {
    icon: <Ticket className="w-12 h-12" />,
    title: 'Nenhum anúncio de revenda',
    description: 'Não há ingressos à venda no mercado de revenda no momento.',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-data',
  icon,
  title,
  description,
  action,
}) => {
  const config = defaultConfig[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-neutral-100 text-neutral-500 flex items-center justify-center mb-5">
        {icon || config.icon}
      </div>
      <h3 className="text-lg font-display font-semibold text-neutral-900 mb-2">
        {title || config.title}
      </h3>
      <p className="text-neutral-600 mb-8 max-w-md">
        {description || config.description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 gradient-primary text-white rounded-xl hover:shadow-glow transition-all duration-200 font-semibold active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
