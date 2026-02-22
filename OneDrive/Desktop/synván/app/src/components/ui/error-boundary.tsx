'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-elevated border border-neutral-200/60 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-error-50 rounded-2xl">
                <AlertCircle className="w-12 h-12 text-error-600" aria-hidden="true" />
              </div>
            </div>

            <h1 className="text-2xl font-display font-bold text-neutral-900 mb-2">
              Algo deu errado
            </h1>

            <p className="text-neutral-600 mb-6">
              Ocorreu um erro inesperado. Por favor, tente novamente ou entre em contato com o suporte se o problema persistir.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-2">
                  Ver detalhes do erro (desenvolvimento)
                </summary>
                <div className="mt-2 p-3 bg-neutral-50 rounded-xl text-xs font-mono text-error-700 overflow-auto max-h-32 border border-neutral-100">
                  {this.state.error.toString()}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="gradient"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-[1rem] h-[1rem]" aria-hidden="true" />
                Tentar novamente
              </Button>

              <Button
                variant="outline"
                onClick={this.handleGoHome}
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

    return this.props.children;
  }
}

export const DefaultErrorFallback = ({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) => (
  <div className="min-h-[400px] flex items-center justify-center bg-neutral-50 px-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-elevated border border-neutral-200/60 p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="p-4 bg-error-50 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-error-600" aria-hidden="true" />
        </div>
      </div>

      <h1 className="text-2xl font-display font-bold text-neutral-900 mb-2">
        Algo deu errado
      </h1>

      <p className="text-neutral-600 mb-6">
        Ocorreu um erro ao carregar esta página. Por favor, tente novamente.
      </p>

      {process.env.NODE_ENV === 'development' && (
        <details className="mb-6 text-left">
          <summary className="cursor-pointer text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-2">
            Ver detalhes do erro
          </summary>
          <div className="mt-2 p-3 bg-neutral-50 rounded-xl text-xs font-mono text-error-700 overflow-auto max-h-32 border border-neutral-100">
            {error.toString()}
          </div>
        </details>
      )}

      <Button
        variant="gradient"
        onClick={reset}
        className="flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-[1rem] h-[1rem]" aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  </div>
);
