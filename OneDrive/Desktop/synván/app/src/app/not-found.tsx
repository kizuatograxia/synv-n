'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NotFound() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200/60 shadow-elevated p-10 text-center animate-scale-in">
        <div className="flex justify-center mb-6">
          <div className="w-[4rem] h-[4rem] rounded-2xl bg-warning-50 flex items-center justify-center">
            <Search className="w-[2rem] h-[2rem] text-warning-500" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-display font-bold text-neutral-900 mb-2">
          Página não encontrada
        </h1>

        <p className="text-neutral-600 mb-8">
          A página que você está procurando não existe ou foi removida.
        </p>

        {/* Search suggestion */}
        <div className="mb-8">
          <p className="text-sm text-neutral-600 mb-3">Busque por eventos:</p>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite o nome do evento..."
              className="flex-1"
            />
            <Button type="submit" variant="primary" size="md">
              <Search className="w-[1rem] h-[1rem]" aria-hidden="true" />
            </Button>
          </form>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="gradient"
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2"
          >
            Voltar
          </Button>

          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
            >
              <Home className="w-[1rem] h-[1rem]" aria-hidden="true" />
              Ir para o início
            </Button>
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-100">
          <p className="text-sm text-neutral-600 mb-3">Links úteis:</p>
          <div className="flex flex-col gap-2">
            <Link href="/events" className="text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors">
              → Ver todos os eventos
            </Link>
            <Link href="/orders" className="text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors">
              → Meus pedidos
            </Link>
            <Link href="/profile" className="text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors">
              → Meu perfil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
