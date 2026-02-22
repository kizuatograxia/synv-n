import { describe, it, expect, beforeEach } from '@jest/globals'
import { ZoomIntegrationService } from '../zoom-integration-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: {
      update: jest.fn(),
    },
  },
}))

global.fetch = jest.fn()

describe('ZoomIntegrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createMeeting', () => {
    it('should create a Zoom meeting and return join URL', async () => {
      const mockMeeting = {
        id: '123456789',
        topic: 'Test Event',
        start_time: new Date().toISOString(),
        duration: 60,
        join_url: 'https://zoom.us/j/123456789',
        password: 'abc123',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: false,
          waiting_room: false
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockMeeting
      })

      const result = await ZoomIntegrationService.createMeeting(
        'event1',
        'Test Event',
        new Date(),
        60,
        'abc123'
      )

      expect(global.fetch).toHaveBeenCalled()
      expect(result.join_url).toBe('https://zoom.us/j/123456789')
    })
  })

  describe('getMeeting', () => {
    it('should fetch a Zoom meeting', async () => {
      const mockMeeting = {
        id: '123456789',
        topic: 'Test Event'
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockMeeting
      })

      const result = await ZoomIntegrationService.getMeeting('123456789')

      expect(result.id).toBe('123456789')
      expect(result.topic).toBe('Test Event')
    })
  })

  describe('updateMeeting', () => {
    it('should update a Zoom meeting', async () => {
      const mockMeeting = {
        id: '123456789',
        topic: 'Updated Event'
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockMeeting
      })

      const result = await ZoomIntegrationService.updateMeeting(
        '123456789',
        { topic: 'Updated Event' }
      )

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('meetings/123456789'),
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })

  describe('deleteMeeting', () => {
    it('should delete a Zoom meeting', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

      await ZoomIntegrationService.deleteMeeting('123456789')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('meetings/123456789'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('getMeetingRegistrants', () => {
    it('should fetch meeting registrants', async () => {
      const mockRegistrants = {
        registrants: [
          { id: 1, email: 'test@example.com' },
          { id: 2, email: 'test2@example.com' }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRegistrants
      })

      const result = await ZoomIntegrationService.getMeetingRegistrants('123456789')

      expect(result).toHaveLength(2)
    })
  })
})
