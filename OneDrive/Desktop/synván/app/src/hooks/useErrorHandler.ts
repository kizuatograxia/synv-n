'use client';

import { useState, useCallback } from 'react';

export interface ErrorHandlerState {
  error: Error | null;
  isError: boolean;
}

/**
 * Hook for handling errors in functional components
 * Useful for handling async errors (e.g., in useEffect, event handlers)
 */
export const useErrorHandler = () => {
  const [state, setState] = useState<ErrorHandlerState>({
    error: null,
    isError: false,
  });

  const handleError = useCallback((error: unknown) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    setState({
      error: errorObj,
      isError: true,
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      error: null,
      isError: false,
    });
  }, []);

  const throwIfError = useCallback(() => {
    if (state.isError && state.error) {
      throw state.error;
    }
  }, [state.isError, state.error]);

  return {
    ...state,
    handleError,
    reset,
    throwIfError,
  };
};
