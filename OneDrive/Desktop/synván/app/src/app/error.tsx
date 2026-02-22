'use client';

import { useEffect } from 'react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200/60 shadow-elevated p-10 text-center animate-scale-in">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-error-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-error-500" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-display font-bold text-neutral-900 mb-2">
          Algo deu errado
        </h1>

        <p className="text-neutral-600 mb-8">
          Ocorreu um erro inesperado. Por favor, tente novamente ou entre em contato com o suporte se o problema persistir.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-8 text-left">
            <summary className="cursor-pointer text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-2">
              Ver detalhes do erro (desenvolvimento)
            </summary>
            <div className="mt-2 p-3 bg-neutral-50 rounded-xl text-xs font-mono text-error-700 overflow-auto max-h-32 border border-neutral-100">
              {error.toString()}
              {error.digest && (
                <div className="mt-2 text-neutral-600">
                  Error ID: {error.digest}
                </div>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="gradient"
            onClick={reset}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-[1rem] h-[1rem]" aria-hidden="true" />
            Tentar novamente
          </Button>

          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="flex items-center justify-center gap-2"
          >
            <Home className="w-[1rem] h-[1rem]" aria-hidden="true" />
            Ir para o início
          </Button>
        </div>
      </div>
    </div>
  );
}
