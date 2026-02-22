import { prisma } from '@/lib/db/prisma'
import { cacheInvalidatePattern } from '@/lib/cache/redis'

interface ZoomMeeting {
  id: string
  topic: string
  start_time: string
  duration: number
  join_url: string
  password?: string
  settings: {
    host_video: boolean
    participant_video: boolean
    join_before_host: boolean
    mute_upon_entry: boolean
    waiting_room: boolean
  }
}

interface ZoomAccessToken {
  access_token: string
  token_type: string
  expires_in: number
}

export class ZoomIntegrationService {
  private static apiKey = process.env.ZOOM_API_KEY
  private static apiSecret = process.env.ZOOM_API_SECRET
  private static baseUrl = 'https://api.zoom.us/v2'

  static async getAccessToken(): Promise<ZoomAccessToken> {
    const timestamp = Date.now()
    const signature = await this.generateSignature(this.apiKey!, timestamp)

    const response = await fetch(`${this.baseUrl}/users/me/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${signature}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    return data as ZoomAccessToken
  }

  static async createMeeting(
    eventId: string,
    topic: string,
    startTime: Date,
    duration: number,
    password?: string
  ): Promise<ZoomMeeting> {
    const accessToken = await this.getAccessToken()

    const meetingResponse = await fetch(`${this.baseUrl}/users/me/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time: startTime.toISOString(),
        duration,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: false,
          waiting_room: false,
          auto_recording: 'cloud'
        }
      })
    })

    const meeting = await meetingResponse.json()

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        location: 'Online',
        address: null,
        city: null,
        state: null
      }
    })

    // Invalidate event listings cache when event is updated for Zoom meeting
    await cacheInvalidatePattern('events:*')

    return meeting as ZoomMeeting
  }

  static async getMeeting(meetingId: string): Promise<ZoomMeeting> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`
      }
    })

    const data = await response.json()
    return data as ZoomMeeting
  }

  static async updateMeeting(
    meetingId: string,
    updates: Partial<ZoomMeeting>
  ): Promise<ZoomMeeting> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })

    const data = await response.json()
    return data as ZoomMeeting
  }

  static async deleteMeeting(meetingId: string): Promise<void> {
    const accessToken = await this.getAccessToken()

    await fetch(`${this.baseUrl}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`
      }
    })
  }

  static async getMeetingRegistrants(meetingId: string): Promise<any[]> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/meetings/${meetingId}/registrants`, {
      headers: {
        'Authorization': `Bearer ${accessToken.access_token}`
      }
    })

    const data = await response.json()
    return data.registrants || []
  }

  static async getMeetingParticipantCount(meetingId: string): Promise<number> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(`${this.baseUrl}/meetings/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken.access_token}`
        }
      })

      const data = await response.json()
      return data.participants_count || 0
    } catch (error) {
      console.error('Error getting participant count:', error)
      return 0
    }
  }

  private static async generateSignature(apiKey: string, timestamp: number): Promise<string> {
    const message = `${apiKey}${timestamp}`
    const encoder = new TextEncoder()
    const data = encoder.encode(message)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.apiSecret!),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      data
    )

    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

export const zoomIntegrationService = new ZoomIntegrationService()
