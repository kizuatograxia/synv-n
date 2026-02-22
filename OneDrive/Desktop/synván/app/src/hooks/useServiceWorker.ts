'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface ServiceWorkerRegistrationResult {
  registration: ServiceWorkerRegistration | null
  error: Error | null
  update: () => Promise<void>
  waiting: boolean
}

interface OfflineCheckinRecord {
  ticketId: string
  eventId: string
  ticketCode: string
  attendeeName: string
  checkedInAt: number
  synced: boolean
}

const DB_NAME = 'bileto-checkin'
const DB_VERSION = 1
const STORE_NAME = 'offline-checkins'

export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Service worker registered:', reg)
          setRegistration(reg)

          // Check for waiting service worker
          if (reg.waiting) {
            setWaiting(true)
          }

          // Listen for waiting service worker
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setWaiting(true)
                }
              })
            }
          })
        })
        .catch((err) => {
          console.error('[SW] Service worker registration failed:', err)
          setError(err)
        })

      // Listen for controller changes (service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW] Service worker activated')
        setWaiting(false)
        window.location.reload()
      })
    }
  }, [])

  const update = async () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  return { registration, error, update, waiting }
}

export function useOfflineCheckin() {
  const [online, setOnline] = useState(true)
  const [offlineQueue, setOfflineQueue] = useState<OfflineCheckinRecord[]>([])
  const dbRef = useRef<IDBDatabase | null>(null)
  const { data: session } = useSession()

  /**
   * Get CSRF token from cookies
   */
  function getCSRFToken(): string | undefined {
    if (typeof document === 'undefined') return undefined

    const name = 'csrf_token='
    const cookies = document.cookie.split(';')

    for (const cookie of cookies) {
      const trimmedCookie = cookie.trim()
      if (trimmedCookie.startsWith(name)) {
        return trimmedCookie.substring(name.length)
      }
    }

    return undefined
  }

  // Initialize IndexedDB
  useEffect(() => {
    if (typeof window === 'undefined') return

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database')
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object store for offline check-ins
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'ticketId' })
        store.createIndex('eventId', 'eventId', { unique: false })
        store.createIndex('synced', 'synced', { unique: false })
      }
    }

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      dbRef.current = db
      loadOfflineQueue(db)
    }

    // Listen for online/offline events
    setOnline(navigator.onLine)
    const handleOnline = () => {
      console.log('[Offline] Connection restored')
      setOnline(true)
      syncOfflineCheckins()
    }
    const handleOffline = () => {
      console.log('[Offline] Connection lost')
      setOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadOfflineQueue = (db: IDBDatabase) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const records = request.result || []
      setOfflineQueue(records.filter((r) => !r.synced))
    }
  }

  const addOfflineCheckin = (record: OfflineCheckinRecord) => {
    if (!dbRef.current) return false

    const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(record)

    request.onsuccess = () => {
      setOfflineQueue((prev) => [...prev, record])
      console.log('[Offline] Check-in queued for sync:', record.ticketCode)
    }

    return true
  }

  const syncOfflineCheckins = async () => {
    if (!dbRef.current || !online) return

    const transaction = dbRef.current.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('synced')
    const request = index.getAll(IDBKeyRange.only(false)) // Get all unsynced records

    request.onsuccess = async () => {
      const unsyncedRecords = request.result || []

      if (unsyncedRecords.length === 0) return

      console.log(`[Offline] Syncing ${unsyncedRecords.length} check-ins...`)

      for (const record of unsyncedRecords) {
        try {
          // Get CSRF token for authentication
          const csrfToken = session?.csrfToken || getCSRFToken()
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (csrfToken) {
            headers['x-csrf-token'] = csrfToken
          }

          // Use the correct check-in API endpoint
          const response = await fetch('/api/checkin', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ticketId: record.ticketId,
              eventId: record.eventId,
            }),
          })

          if (response.ok) {
            // Mark as synced
            const updateTx = dbRef.current!.transaction([STORE_NAME], 'readwrite')
            const updateStore = updateTx.objectStore(STORE_NAME)
            record.synced = true
            updateStore.put(record)

            setOfflineQueue((prev) => prev.filter((r) => r.ticketId !== record.ticketId))
            console.log('[Offline] Synced check-in:', record.ticketCode)
          } else {
            console.error('[Offline] Server rejected check-in:', record.ticketCode, await response.text())
          }
        } catch (error) {
          console.error('[Offline] Failed to sync check-in:', record.ticketCode, error)
        }
      }
    }
  }

  const getOfflineCheckin = (ticketId: string): Promise<OfflineCheckinRecord | null> => {
    return new Promise((resolve) => {
      if (!dbRef.current) {
        resolve(null)
        return
      }

      const transaction = dbRef.current.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(ticketId)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        resolve(null)
      }
    })
  }

  const clearSyncedRecords = () => {
    if (!dbRef.current) return

    const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('synced')
    const request = index.openCursor(IDBKeyRange.only(true))

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
  }

  return {
    online,
    offlineQueue,
    addOfflineCheckin,
    syncOfflineCheckins,
    getOfflineCheckin,
    clearSyncedRecords,
  }
}
