'use client'

import { useState, useEffect } from 'react'
import useSWR, { SWRConfiguration } from 'swr'
import { useSession } from 'next-auth/react'

interface ApiError {
  message: string
  status?: number
  code?: string
}

interface FetchConfig extends RequestInit {
  headers?: Record<string, string>
}

/**
 * Get CSRF token from cookies
 * Reads the csrf_token cookie that was set by the server
 */
function getCSRFToken(): string | undefined {
  if (typeof document === 'undefined') return undefined

  const name = 'csrf_token='
  const cookies = document.cookie.split(';')

  for (let cookie of cookies) {
    const trimmedCookie = cookie.trim()
    if (trimmedCookie.startsWith(name)) {
      return trimmedCookie.substring(name.length)
    }
  }

  return undefined
}

/**
 * Build auth headers from session CSRF token (or cookie fallback)
 */
function getAuthHeaders(
  session: { csrfToken?: string } | null | undefined,
  method?: string
): Record<string, string> {
  const headers: Record<string, string> = {}
  const csrfToken = session?.csrfToken || getCSRFToken()

  if (csrfToken) {
    const m = (method || 'GET').toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) {
      headers['x-csrf-token'] = csrfToken
    }
  }

  return headers
}

/**
 * Fetcher function that adds auth headers and handles responses
 */
async function fetcher(url: string, config?: FetchConfig): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config?.headers,
  }

  // Add CSRF token for state-changing methods if available
  const method = config?.method || 'GET'
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    const csrfToken = getCSRFToken()
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
  }

  const response = await fetch(url, {
    ...config,
    credentials: config?.credentials || 'include',
    headers,
  })

  // Handle non-JSON responses (like DELETE requests that return 204)
  if (response.status === 204) {
    return null
  }

  const data = await response.json()

  if (!response.ok) {
    const error: ApiError = {
      message: data.message || data.error || 'An error occurred',
      status: response.status,
      code: data.code,
    }
    throw error
  }

  return data
}

/**
 * Enhanced useSWR hook with automatic authentication headers
 *
 * @example
 * ```tsx
 * const { data, error, isLoading } = useApi('/api/orders')
 * const { data, error, isLoading } = useApi('/api/events', { params: { published: 'true' } })
 * ```
 */
export function useApi<T = any>(
  url: string | null,
  swrOptions?: SWRConfiguration,
  fetchOptions?: FetchConfig
) {
  const { data: session } = useSession()

  const headers: Record<string, string> = {
    ...fetchOptions?.headers,
    ...getAuthHeaders(session, fetchOptions?.method),
  }

  return useSWR<T>(
    url,
    (url) => fetcher(url, { ...fetchOptions, headers }),
    {
      ...swrOptions,
      // Don't retry on 401 (unauthorized) or 403 (forbidden)
      shouldRetryOnError: (error: ApiError) => {
        return error.status !== 401 && error.status !== 403
      },
      // Revalidate on focus for authenticated requests, but not too frequently
      revalidateOnFocus: session ? true : false,
    }
  )
}

/**
 * Hook for making API mutations (POST, PUT, PATCH, DELETE)
 *
 * @example
 * ```tsx
 * const { trigger, isMutating } = useApiMutation('/api/orders', 'POST')
 *
 * const handleSubmit = async (data: OrderData) => {
 *   try {
 *     const result = await trigger(data)
 *     toast.success('Order created!')
 *   } catch (error) {
 *     toast.error(error.message)
 *   }
 * }
 * ```
 */
export function useApiMutation<T = any, B = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
) {
  const { data: session } = useSession()
  const [isMutating, setIsMutating] = useState(false)

  const trigger = async (body?: B, fetchOptions?: FetchConfig): Promise<T> => {
    setIsMutating(true)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...fetchOptions?.headers,
      ...getAuthHeaders(session, method),
    }

    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        ...fetchOptions,
      })

      // Handle 204 No Content
      if (response.status === 204) {
        return null as T
      }

      const data = await response.json()

      if (!response.ok) {
        const error: ApiError = {
          message: data.message || data.error || 'An error occurred',
          status: response.status,
          code: data.code,
        }
        throw error
      }

      return data as T
    } finally {
      setIsMutating(false)
    }
  }

  return {
    trigger,
    isMutating,
  }
}

/**
 * Hook for API pagination
 *
 * Supports multiple response shapes through a generic type parameter.
 *
 * @example
 * ```tsx
 * // Standard shape with items and total
 * const { data, error, isLoading, setPage, page } = useApiPagination('/api/events', 10)
 *
 * // Custom response shape
 * const { data, error, isLoading } = useApiPagination<Event>('/api/events', 10, {}, {
 *   dataKey: 'events',
 *   totalKey: 'count'
 * })
 * ```
 */
export function useApiPagination<
  T = any,
  R = any
>(
  baseUrl: string,
  pageSize: number = 10,
  swrOptions?: SWRConfiguration,
  options?: {
    dataKey?: string
    totalKey?: string
  }
) {
  const [page, setPage] = useState(1)

  // Default options
  const dataKey = options?.dataKey || 'items'
  const totalKey = options?.totalKey || 'total'

  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  })

  const url = `${baseUrl}?${params.toString()}`
  const { data, error, isLoading } = useApi<R>(url, swrOptions)

  // Extract items from response - try common keys
  const items = data
    ? ((data as any)[dataKey] as T[]) ||
      ((data as any).items as T[]) ||
      ((data as any).data as T[]) ||
      ((data as any).events as T[]) ||
      ((data as any).users as T[]) ||
      []
    : []

  // Extract total from response - try common keys
  const total = data
    ? (((data as any)[totalKey] as number | undefined) ||
       ((data as any).total as number | undefined) ||
       ((data as any).count as number | undefined) ||
       items.length) ?? 0
    : 0

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0

  return {
    data: items,
    total,
    page,
    totalPages,
    isLoading,
    error,
    setPage,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages || 1)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
  }
}

/**
 * Hook for infinite scroll / load more pattern
 *
 * @example
 * ```tsx
 * const { data, isLoading, isLoadingMore, loadMore, hasMore } = useApiInfinite('/api/events', 20)
 * ```
 */
export function useApiInfinite<T = any>(
  baseUrl: string,
  pageSize: number = 20
) {
  const { data: session } = useSession()
  const [pages, setPages] = useState<T[][]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const loadPage = async (pageNum: number) => {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String((pageNum - 1) * pageSize),
    })

    const url = `${baseUrl}?${params.toString()}`

    try {
      const response = await fetcher(url, {
        headers: getAuthHeaders(session),
        credentials: 'include',
      })
      const items = response.items || response.data || response.events || response

      return items as T[]
    } catch (err) {
      setError(err as ApiError)
      return []
    }
  }

  const loadMore = async () => {
    if (isLoadingMore) return

    setIsLoadingMore(true)
    const nextPage = pages.length + 1
    const newItems = await loadPage(nextPage)

    if (newItems.length > 0) {
      setPages((prev) => [...prev, newItems])
    }

    setIsLoadingMore(false)
  }

  const refresh = async () => {
    setIsLoading(true)
    setError(null)
    const items = await loadPage(1)
    setPages([items])
    setIsLoading(false)
  }

  // Load first page on mount
  useEffect(() => {
    refresh()
  }, [baseUrl])

  const flatData = pages.flatMap((page) => page)
  const hasMore = pages.length > 0 && pages[pages.length - 1].length >= pageSize

  return {
    data: flatData,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    refresh,
    hasMore,
  }
}

export type { ApiError, FetchConfig }
