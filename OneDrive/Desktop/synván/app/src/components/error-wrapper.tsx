'use client';

import { ErrorBoundary } from '@/components/ui/error-boundary';

interface ErrorWrapperProps {
  children: React.ReactNode;
}

/**
 * A client component wrapper that adds ErrorBoundary to server components.
 * Usage in server components:
 *
 * import { ErrorWrapper } from '@/components/error-wrapper';
 *
 * export default function MyServerPage() {
 *   return (
 *     <ErrorWrapper>
 *       <YourPageContent />
 *     </ErrorWrapper>
 *   );
 * }
 */
export function ErrorWrapper({ children }: ErrorWrapperProps) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
