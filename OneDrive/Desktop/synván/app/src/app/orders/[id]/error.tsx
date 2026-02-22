'use client';

import { useEffect } from 'react';
import { AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Order detail page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-error-100 rounded-full">
            <AlertCircle className="w-12 h-12 text-error-600" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Erro ao carregar pedido
        </h1>

        <p className="text-neutral-600 mb-6">
          Ocorreu um erro ao carregar os detalhes do pedido. Por favor, tente novamente.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm font-medium text-neutral-700 hover:text-neutral-900 mb-2">
              Ver detalhes do erro
            </summary>
            <div className="mt-2 p-3 bg-neutral-100 rounded text-xs font-mono text-error-700 overflow-auto max-h-32">
              {error.toString()}
            </div>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            onClick={reset}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-[1rem] h-[1rem]" aria-hidden="true" />
            Tentar novamente
          </Button>

          <Button
            variant="outline"
            onClick={() => (window.location.href = '/orders')}
            className="flex items-center justify-center gap-2"
          >
            <FileText className="w-[1rem] h-[1rem]" aria-hidden="true" />
            Meus pedidos
          </Button>
        </div>
      </div>
    </div>
  );
}
