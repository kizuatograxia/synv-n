'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CartItem } from '@/lib/validations/order'

export interface CartState {
  items: CartItem[]
  promocode: string | null
  eventId: string | null
}

const CART_STORAGE_KEY = 'bileto_cart'
const CART_EXPIRY_MS = 15 * 60 * 1000 // 15 minutes

interface StoredCart extends CartState {
  expiresAt: number
  createdAt: number
}

/**
 * Format remaining time in MM:SS format
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Check if time is running low (less than 3 minutes)
 */
export function isTimeLow(ms: number): boolean {
  return ms > 0 && ms < 3 * 60 * 1000
}

/**
 * Hook for managing cart state in localStorage (frontend-only)
 */
export function useCart() {
  const [cart, setCart] = useState<CartState>({
    items: [],
    promocode: null,
    eventId: null,
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(CART_EXPIRY_MS)
  const isInitialized = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Load cart from localStorage on mount (only once)
  useEffect(() => {
    if (isInitialized.current) return

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        const parsedCart: StoredCart = JSON.parse(stored)

        // Check if cart has expired
        if (parsedCart.expiresAt < Date.now()) {
          localStorage.removeItem(CART_STORAGE_KEY)
        } else {
          setCart({
            items: parsedCart.items,
            promocode: parsedCart.promocode,
            eventId: parsedCart.eventId,
          })
          // Calculate initial time remaining
          setTimeRemaining(Math.max(0, parsedCart.expiresAt - Date.now()))
        }
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error)
    } finally {
      setIsLoaded(true)
      isInitialized.current = true
    }
  }, [])

  // Save cart to localStorage whenever it changes (after initial load)
  useEffect(() => {
    if (isLoaded && isInitialized.current) {
      try {
        const now = Date.now()
        const storedCart: StoredCart = {
          ...cart,
          expiresAt: now + CART_EXPIRY_MS,
          createdAt: now,
        }
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(storedCart))

        // Reset timer when cart is updated
        setTimeRemaining(CART_EXPIRY_MS)
      } catch (error) {
        console.error('Error saving cart to localStorage:', error)
      }
    }
  }, [cart, isLoaded])

  // Timer countdown
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Only start timer if cart has items and is loaded
    if (isLoaded && cart.items.length > 0 && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1000
          if (newTime <= 0) {
            // Time expired, clear cart
            clearCart()
            return 0
          }
          return newTime
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isLoaded, cart.items.length, cart.eventId]) // Add cart.eventId to restart timer on event change

  const setItems = useCallback((items: CartItem[], eventId: string) => {
    setCart(prev => ({
      ...prev,
      items,
      eventId,
    }))
  }, [])

  const setPromocode = useCallback((promocode: string | null) => {
    setCart(prev => ({
      ...prev,
      promocode,
    }))
  }, [])

  const clearCart = useCallback(() => {
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing cart from localStorage:', error)
    }
    setCart({
      items: [],
      promocode: null,
      eventId: null,
    })
  }, [])

  const updateItem = useCallback((lotId: string, quantity: number, ticketType: 'GENERAL' | 'MEIA_ENTRADA' | 'VIP' | 'EARLY_BIRD' = 'GENERAL', seatIds?: string[]) => {
    setCart(prev => {
      const existingItemIndex = prev.items.findIndex(item => item.lotId === lotId)

      if (existingItemIndex >= 0) {
        // Update existing item
        const newItems = [...prev.items]
        if (quantity > 0) {
          newItems[existingItemIndex] = {
            lotId,
            quantity,
            ticketType,
            seatIds,
          }
        } else {
          // Remove item if quantity is 0
          newItems.splice(existingItemIndex, 1)
        }
        return {
          ...prev,
          items: newItems,
        }
      } else {
        // Add new item
        return {
          ...prev,
          items: [...prev.items, { lotId, quantity, ticketType, seatIds }],
        }
      }
    })
  }, [])

  const removeItem = useCallback((lotId: string) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(item => item.lotId !== lotId),
    }))
  }, [])

  return {
    cart,
    isLoaded,
    setItems,
    setPromocode,
    clearCart,
    updateItem,
    removeItem,
    timeRemaining,
  }
}
