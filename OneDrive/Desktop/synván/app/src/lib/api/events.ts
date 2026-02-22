/**
 * API functions for events that can be used in both client and server components
 */

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return ''
  return process.env.NEXT_PUBLIC_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`
}

export type HalfPriceEligibility = 'STUDENT' | 'DISABLED' | 'YOUTH' | 'ELDERLY'

export interface Event {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string | null
  location: string | null
  address: string | null
  city: string | null
  state: string | null
  imageUrl: string | null
  isPublished: boolean
  halfPriceEnabled: boolean
  halfPriceLimit: number
  halfPriceElderlyFree: boolean
  organizer: {
    id: string
    name: string
    email: string
  }
  lots: Array<{
    id: string
    name: string
    price: number
    totalQuantity: number
    availableQuantity: number
    startDate: string
    endDate: string
    isActive: boolean
  }>
}

export interface EventsResponse {
  events: Event[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface FetchEventsParams {
  published?: boolean
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: string
  search?: string
  city?: string
  state?: string
  minPrice?: string
  maxPrice?: string
  organizerId?: string
}

/**
 * Fetch events from the API
 * This function can be used in both client and server components
 */
export async function fetchEvents(params: FetchEventsParams = {}): Promise<EventsResponse> {
  const {
    published = false,
    page = 1,
    pageSize = 12,
    sortBy = 'date',
    sortOrder = 'asc',
    search,
    city,
    state,
    minPrice,
    maxPrice,
    organizerId,
  } = params

  // Build query parameters
  const queryParams = new URLSearchParams({
    published: published.toString(),
    page: page.toString(),
    pageSize: pageSize.toString(),
    sortBy,
    sortOrder,
    ...(search ? { search } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    ...(organizerId ? { organizerId } : {}),
  })

  const url = `${getBaseUrl()}/api/events?${queryParams.toString()}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch a single event by ID
 * This function can be used in both client and server components
 */
export async function fetchEventById(id: string): Promise<Event | null> {
  const url = `${getBaseUrl()}/api/events/${id}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`Failed to fetch event: ${response.statusText}`)
  }

  const data = await response.json()
  return data.event
}

/**
 * Fetch events by organizer ID
 * This function can be used in both client and server components
 */
export async function fetchEventsByOrganizer(
  organizerId: string,
  options: {
    published?: boolean
    pageSize?: number
    excludeEventId?: string
  } = {}
): Promise<EventsResponse> {
  const { published = true, pageSize = 6, excludeEventId } = options

  const events = await fetchEvents({
    organizerId,
    published,
    pageSize,
  })

  // Filter out the current event if specified
  if (excludeEventId) {
    events.events = events.events.filter(event => event.id !== excludeEventId)
  }

  return events
}
