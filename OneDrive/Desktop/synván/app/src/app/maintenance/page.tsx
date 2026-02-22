'use client';

import Link from 'next/link';
import { Home, Wrench, Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MaintenancePage() {
  return (
    <main role="main" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-neutral-200/60 shadow-elevated p-12 text-center animate-scale-in">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-warning-50 flex items-center justify-center animate-pulse">
            <Wrench className="w-10 h-10 text-warning-500" aria-hidden="true" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-display font-bold text-neutral-900 mb-4">
          Manutenção Programada
        </h1>

        {/* Description */}
        <p className="text-lg text-neutral-600 mb-8">
          Estamos realizando melhorias no sistema para oferecer uma experiência melhor. Voltaremos em breve.
        </p>

        {/* Estimated time */}
        <div className="bg-neutral-50 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-primary-500" aria-hidden="true" />
            <p className="text-sm font-medium text-neutral-900">Previsão de retorno</p>
          </div>
          <p className="text-2xl font-bold text-neutral-900">2-3 horas</p>
        </div>

        {/* What to expect */}
        <div className="bg-primary-50 rounded-xl p-6 mb-8 text-left">
          <h2 className="text-sm font-semibold text-primary-900 mb-3">
            Durante a manutenção:
          </h2>
          <ul className="space-y-2 text-sm text-primary-700">
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>O sistema estará temporariamente indisponível</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>Compras em andamento não serão afetadas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>Ingressos já comprados continuam válidos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>Check-ins via QR code funcionarão normalmente</span>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="mb-8">
          <p className="text-sm text-neutral-600 mb-3">Precisa de ajuda urgente?</p>
          <a
            href="mailto:suporte@bileto.com.br"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            <Mail className="w-[1rem] h-[1rem]" aria-hidden="true" />
            Entre em contato com o suporte
          </a>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="gradient"
              className="w-full flex items-center justify-center gap-2"
            >
              <Home className="w-[1rem] h-[1rem]" aria-hidden="true" />
              Ir para o início
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-100">
          <p className="text-xs text-neutral-500">
            Obrigado pela compreensão. Equipe Bileto
          </p>
        </div>
      </div>
    </main>
  );
}
