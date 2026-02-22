'use client'

import { useContext } from 'react'
import { ToastContext, ToastType } from '@/components/ui/toast'

/**
 * Hook for displaying toast notifications
 *
 * Provides access to the toast context for showing success, error, warning, and info messages.
 * Must be used within a ToastProvider (usually added at the root layout).
 *
 * @example
 * ```tsx
 * const toast = useToast()
 *
 * // Show different toast types
 * toast.success('Order created successfully!')
 * toast.error('Something went wrong')
 * toast.warning('Account expiring soon')
 * toast.info('New message received')
 *
 * // Custom duration (default is 5000ms)
 * toast.success('Saved!', 3000)
 * ```
 */
export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider. Add ToastProvider to your root layout.')
  }

  const { showToast, removeToast } = context

  return {
    /**
     * Show a success toast notification
     * @param message - The message to display
     * @param duration - Duration in milliseconds (default: 5000). Use 0 for no auto-dismiss
     */
    success: (message: string, duration?: number) => showToast('success', message, duration),

    /**
     * Show an error toast notification
     * @param message - The message to display
     * @param duration - Duration in milliseconds (default: 5000). Use 0 for no auto-dismiss
     */
    error: (message: string, duration?: number) => showToast('error', message, duration),

    /**
     * Show a warning toast notification
     * @param message - The message to display
     * @param duration - Duration in milliseconds (default: 5000). Use 0 for no auto-dismiss
     */
    warning: (message: string, duration?: number) => showToast('warning', message, duration),

    /**
     * Show an info toast notification
     * @param message - The message to display
     * @param duration - Duration in milliseconds (default: 5000). Use 0 for no auto-dismiss
     */
    info: (message: string, duration?: number) => showToast('info', message, duration),

    /**
     * Show a toast notification with custom type
     * @param type - The type of toast to display
     * @param message - The message to display
     * @param duration - Duration in milliseconds (default: 5000). Use 0 for no auto-dismiss
     */
    show: (type: ToastType, message: string, duration?: number) => showToast(type, message, duration),

    /**
     * Remove a toast notification by ID
     * @param id - The ID of the toast to remove
     */
    remove: (id: string) => removeToast(id),
  }
}
