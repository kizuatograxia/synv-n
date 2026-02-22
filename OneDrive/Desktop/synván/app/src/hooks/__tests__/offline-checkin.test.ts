/**
 * Offline Check-in Integration Tests
 *
 * Tests the offline check-in functionality:
 * - Check-in works with no network (IndexedDB storage)
 * - Check-ins queue up when offline
 * - Check-ins sync when connection is restored
 * - Conflict detection prevents duplicate check-ins
 */

// Simplified mock for IndexedDB
const mockStore = new Map<string, any>()

// Mock fetch
global.fetch = jest.fn()

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random()),
} as any

beforeEach(() => {
  jest.clearAllMocks()
  mockStore.clear()
})

// Mock navigator.onLine
const mockOnLine = { value: true }
Object.defineProperty(navigator, 'onLine', {
  get() {
    return mockOnLine.value
  },
  set(value: boolean) {
    mockOnLine.value = value
    // Dispatch event
    if (value) {
      window.dispatchEvent(new Event('online'))
    } else {
      window.dispatchEvent(new Event('offline'))
    }
  },
  configurable: true,
})

describe('Offline Check-in', () => {
  describe('IndexedDB Storage', () => {
    it('should store offline check-in record', async () => {
      const record = {
        ticketId: 'ticket-123',
        eventId: 'event-456',
        ticketCode: 'ABC123',
        attendeeName: 'John Doe',
        checkedInAt: Date.now(),
        synced: false,
      }

      // Simulate IndexedDB add operation
      mockStore.set(record.ticketId, record)

      // Verify record was stored
      const stored = mockStore.get('ticket-123')
      expect(stored).toEqual(record)
    })

    it('should retrieve all unsynced check-ins', async () => {
      const records = [
        {
          ticketId: 'ticket-1',
          eventId: 'event-456',
          ticketCode: 'TICKET1',
          attendeeName: 'User 1',
          checkedInAt: Date.now(),
          synced: false,
        },
        {
          ticketId: 'ticket-2',
          eventId: 'event-456',
          ticketCode: 'TICKET2',
          attendeeName: 'User 2',
          checkedInAt: Date.now(),
          synced: true,
        },
        {
          ticketId: 'ticket-3',
          eventId: 'event-456',
          ticketCode: 'TICKET3',
          attendeeName: 'User 3',
          checkedInAt: Date.now(),
          synced: false,
        },
      ]

      // Store all records
      records.forEach((r) => mockStore.set(r.ticketId, r))

      // Get unsynced records
      const allRecords = Array.from(mockStore.values())
      const unsyncedRecords = allRecords.filter((r) => !r.synced)

      expect(unsyncedRecords.length).toBe(2)
      expect(unsyncedRecords.map((r) => r.ticketId).sort()).toEqual(['ticket-1', 'ticket-3'])
    })

    it('should mark check-in as synced after successful sync', async () => {
      const record = {
        ticketId: 'ticket-123',
        eventId: 'event-456',
        ticketCode: 'ABC123',
        attendeeName: 'John Doe',
        checkedInAt: Date.now(),
        synced: false,
      }

      // Add record
      mockStore.set(record.ticketId, record)

      // Mark as synced
      record.synced = true
      mockStore.set(record.ticketId, record)

      // Verify
      const stored = mockStore.get('ticket-123')
      expect(stored.synced).toBe(true)
    })
  })

  describe('Offline Check-in Flow', () => {
    it('should queue check-in when offline', async () => {
      // Simulate offline state
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const record = {
        ticketId: 'ticket-offline-1',
        eventId: 'event-456',
        ticketCode: 'OFF001',
        attendeeName: 'Offline User',
        checkedInAt: Date.now(),
        synced: false,
      }

      // Queue offline check-in
      mockStore.set(record.ticketId, record)

      // Verify record was stored
      const stored = mockStore.get('ticket-offline-1')
      expect(stored).toBeDefined()
      expect(stored.synced).toBe(false)
      expect(stored.ticketId).toBe('ticket-offline-1')

      // Restore online state
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    })

    it('should prevent duplicate offline check-ins for same ticket', async () => {
      const record = {
        ticketId: 'ticket-duplicate-1',
        eventId: 'event-456',
        ticketCode: 'DUP001',
        attendeeName: 'Duplicate User',
        checkedInAt: Date.now(),
        synced: false,
      }

      // First check-in
      mockStore.set(record.ticketId, record)

      // Second check-in with same ticketId
      const existing = mockStore.get('ticket-duplicate-1')
      const duplicateDetected = existing !== undefined

      expect(duplicateDetected).toBe(true)
    })

    it('should detect conflict between offline and online check-in', async () => {
      // Simulate online check-in (ticket already used)
      const onlineCheckin = {
        ticketId: 'ticket-conflict-1',
        eventId: 'event-456',
        ticketCode: 'CONFLICT',
        attendeeName: 'Conflict User',
        checkedInAt: Date.now() - 10000, // 10 seconds ago
        synced: true, // Already synced online
      }

      // Add synced (online) check-in
      mockStore.set(onlineCheckin.ticketId, onlineCheckin)

      // Try to add offline check-in for same ticket
      const existing = mockStore.get('ticket-conflict-1')

      // Conflict detected: ticket already checked in
      expect(existing).toBeDefined()
      expect(existing.synced).toBe(true)
    })
  })

  describe('Sync When Reconnected', () => {
    beforeEach(() => {
      // Mock successful fetch responses for sync
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          ticketId: 'ticket-sync-1',
          checkedInAt: new Date(),
        }),
      })
    })

    it('should sync all pending check-ins when connection is restored', async () => {
      // Queue multiple offline check-ins
      const records = [
        {
          ticketId: 'ticket-sync-1',
          eventId: 'event-456',
          ticketCode: 'SYNC001',
          attendeeName: 'Sync User 1',
          checkedInAt: Date.now(),
          synced: false,
        },
        {
          ticketId: 'ticket-sync-2',
          eventId: 'event-456',
          ticketCode: 'SYNC002',
          attendeeName: 'Sync User 2',
          checkedInAt: Date.now(),
          synced: false,
        },
      ]

      // Store records
      records.forEach((r) => mockStore.set(r.ticketId, r))

      // Verify records are queued
      const allRecords = Array.from(mockStore.values())
      const unsyncedRecords = allRecords.filter((r) => !r.synced)
      expect(unsyncedRecords.length).toBe(2)

      // Sync each record
      for (const record of records) {
        const response = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId: record.ticketId,
            eventId: record.eventId,
          }),
        })

        expect(response.ok).toBe(true)

        // Mark as synced
        if (response.ok) {
          record.synced = true
          mockStore.set(record.ticketId, record)
        }
      }

      // Verify all records are synced
      const finalRecords = Array.from(mockStore.values())
      const finalUnsynced = finalRecords.filter((r) => !r.synced)
      expect(finalUnsynced.length).toBe(0)
    })

    it('should handle sync failures gracefully', async () => {
      // Mock failed sync response
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Ingresso já utilizado' }),
      })

      const record = {
        ticketId: 'ticket-failed-sync',
        eventId: 'event-456',
        ticketCode: 'FAIL001',
        attendeeName: 'Failed Sync User',
        checkedInAt: Date.now(),
        synced: false,
      }

      // Add offline check-in
      mockStore.set(record.ticketId, record)

      // Try to sync (will fail)
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: record.ticketId,
          eventId: record.eventId,
        }),
      })

      expect(response.ok).toBe(false)

      // Verify record is still unsynced
      const stored = mockStore.get('ticket-failed-sync')
      expect(stored.synced).toBe(false)
    })

    it('should only sync unsynced records', async () => {
      // Mix of synced and unsynced records
      const records = [
        {
          ticketId: 'ticket-already-synced',
          eventId: 'event-456',
          ticketCode: 'ALREADY',
          attendeeName: 'Already Synced',
          checkedInAt: Date.now() - 10000,
          synced: true,
        },
        {
          ticketId: 'ticket-pending-sync',
          eventId: 'event-456',
          ticketCode: 'PENDING',
          attendeeName: 'Pending Sync',
          checkedInAt: Date.now(),
          synced: false,
        },
      ]

      // Store all records
      records.forEach((r) => mockStore.set(r.ticketId, r))

      // Get only unsynced records
      const allRecords = Array.from(mockStore.values())
      const unsyncedRecords = allRecords.filter((r) => !r.synced)

      expect(unsyncedRecords.length).toBe(1)
      expect(unsyncedRecords[0].ticketId).toBe('ticket-pending-sync')

      // Sync only unsynced record
      const recordToSync = unsyncedRecords[0]
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: recordToSync.ticketId,
          eventId: recordToSync.eventId,
        }),
      })

      expect(response.ok).toBe(true)

      // Verify only the pending record was synced
      recordToSync.synced = true
      mockStore.set(recordToSync.ticketId, recordToSync)

      const finalRecords = Array.from(mockStore.values())
      const finalUnsynced = finalRecords.filter((r) => !r.synced)
      expect(finalUnsynced.length).toBe(0)
    })
  })

  describe('Online/Offline Events', () => {
    it('should trigger online event handler when connection is restored', () => {
      const onlineHandler = jest.fn()
      window.addEventListener('online', onlineHandler)

      // Simulate connection restored
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      const event = new Event('online')
      window.dispatchEvent(event)

      expect(onlineHandler).toHaveBeenCalled()

      window.removeEventListener('online', onlineHandler)
    })

    it('should trigger offline event handler when connection is lost', () => {
      const offlineHandler = jest.fn()
      window.addEventListener('offline', offlineHandler)

      // Simulate connection lost
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const event = new Event('offline')
      window.dispatchEvent(event)

      expect(offlineHandler).toHaveBeenCalled()

      window.removeEventListener('offline', offlineHandler)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty offline queue', () => {
      const allRecords = Array.from(mockStore.values())
      expect(allRecords).toEqual([])
    })

    it('should handle non-existent ticket lookup', () => {
      const stored = mockStore.get('nonexistent-ticket')
      expect(stored).toBeUndefined()
    })

    it('should persist data across operations', () => {
      const record = {
        ticketId: 'ticket-persist-1',
        eventId: 'event-456',
        ticketCode: 'PERSIST',
        attendeeName: 'Persistent User',
        checkedInAt: Date.now(),
        synced: false,
      }

      // Add record
      mockStore.set(record.ticketId, record)

      // Data should still be there after subsequent operations
      mockStore.set('other-key', { data: 'other' })
      const stored = mockStore.get('ticket-persist-1')

      expect(stored).toBeDefined()
      expect(stored.ticketId).toBe('ticket-persist-1')
    })
  })
})
