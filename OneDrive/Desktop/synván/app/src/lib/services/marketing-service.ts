import { prisma } from '../db/prisma'
import { logger } from '../logger'

export enum IntegrationType {
  FACEBOOK_PIXEL = 'FACEBOOK_PIXEL',
  GOOGLE_ANALYTICS = 'GOOGLE_ANALYTICS',
  RD_STATION = 'RD_STATION',
  HUBSPOT = 'HUBSPOT',
}

export interface IntegrationConfigInput {
  type: IntegrationType
  apiKey?: string
  enabled: boolean
}

export interface TrackEventInput {
  eventId: string
  eventType: 'PAGE_VIEW' | 'PURCHASE' | 'CHECKOUT'
  metadata?: Record<string, any>
}

export class MarketingService {
  static async configureIntegration(
    userId: string,
    eventId: string,
    input: IntegrationConfigInput
  ) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (event.organizerId !== userId) {
      throw new Error('Sem permissão para configurar integrações')
    }

    const existingConfig = await prisma.integrationConfig.findFirst({
      where: {
        eventId,
        type: input.type,
      },
    })

    if (existingConfig) {
      return await prisma.integrationConfig.update({
        where: { id: existingConfig.id },
        data: {
          apiKey: input.apiKey,
          enabled: input.enabled,
        },
      })
    }

    return await prisma.integrationConfig.create({
      data: {
        type: input.type,
        apiKey: input.apiKey,
        enabled: input.enabled,
        eventId,
        userId,
      },
    })
  }

  static async getIntegrations(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (event.organizerId !== userId) {
      throw new Error('Sem permissão para visualizar integrações')
    }

    return await prisma.integrationConfig.findMany({
      where: {
        eventId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  static async trackEvent(input: TrackEventInput) {
    const integrations = await prisma.integrationConfig.findMany({
      where: {
        eventId: input.eventId,
        enabled: true,
        type: {
          in: [
            IntegrationType.FACEBOOK_PIXEL,
            IntegrationType.GOOGLE_ANALYTICS,
          ],
        },
      },
    })

    const facebookPixel = integrations.find(
      (i: any) => i.type === IntegrationType.FACEBOOK_PIXEL
    )

    const googleAnalytics = integrations.find(
      (i: any) => i.type === IntegrationType.GOOGLE_ANALYTICS
    )

    if (facebookPixel) {
      await this.trackFacebookEvent(
        input.eventId,
        input.eventType,
        input.metadata
      )
    }

    if (googleAnalytics) {
      await this.trackGoogleAnalyticsEvent(
        input.eventId,
        input.eventType,
        input.metadata
      )
    }

    return {
      facebookPixelTracked: !!facebookPixel,
      googleAnalyticsTracked: !!googleAnalytics,
    }
  }

  static async trackPurchase(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        event: true,
        user: true,
        tickets: true,
      },
    })

    if (!order) {
      throw new Error('Pedido não encontrado')
    }

    const integrations = await prisma.integrationConfig.findMany({
      where: {
        eventId: order.eventId,
        enabled: true,
      },
    })

    const results: any = {
      facebookPixel: false,
      googleAnalytics: false,
      rdStation: false,
      hubspot: false,
    }

    for (const integration of integrations) {
      switch (integration.type) {
        case IntegrationType.FACEBOOK_PIXEL:
          await this.trackFacebookEvent(
            order.eventId,
            'PURCHASE',
            {
              value: order.totalAmount,
              currency: 'BRL',
              content_name: order.event.title,
              content_ids: order.tickets.map((t: any) => t.id),
              num_items: order.tickets.length,
              user_email: order.user.email,
              user_name: order.user.name,
            }
          )
          results.facebookPixel = true
          break

        case IntegrationType.GOOGLE_ANALYTICS:
          await this.trackGoogleAnalyticsEvent(
            order.eventId,
            'purchase',
            {
              transaction_id: orderId,
              value: order.totalAmount,
              currency: 'BRL',
              items: order.tickets.map((t: any) => ({
                item_id: t.id,
                item_name: t.type,
                quantity: 1,
                price: t.price,
              })),
            }
          )
          results.googleAnalytics = true
          break

        case IntegrationType.RD_STATION:
          if (integration.apiKey) {
            await this.syncToRDStation(order, integration.apiKey)
            results.rdStation = true
          }
          break

        case IntegrationType.HUBSPOT:
          if (integration.apiKey) {
            await this.syncToHubSpot(order, integration.apiKey)
            results.hubspot = true
          }
          break
      }
    }

    return results
  }

  private static async trackFacebookEvent(
    eventId: string,
    eventName: string,
    eventData: any
  ) {
    logger.debug(`[Facebook Pixel] Tracking ${eventName} for event ${eventId}`, { eventData })
  }

  private static async trackGoogleAnalyticsEvent(
    eventId: string,
    eventName: string,
    eventData: any
  ) {
    logger.debug(
      `[Google Analytics] Tracking ${eventName} for event ${eventId}`,
      { eventData }
    )
  }

  private static async syncToRDStation(order: any, apiKey: string) {
    logger.debug(`[RD Station] Syncing order ${order.id} to RD Station`)
  }

  private static async syncToHubSpot(order: any, apiKey: string) {
    logger.debug(`[HubSpot] Syncing order ${order.id} to HubSpot`)
  }

  static async disableIntegration(integrationId: string, userId: string) {
    const integration = await prisma.integrationConfig.findUnique({
      where: { id: integrationId },
      include: {
        event: {
          select: {
            organizerId: true,
          },
        },
      },
    })

    if (!integration) {
      throw new Error('Integração não encontrada')
    }

    if (integration.event.organizerId !== userId) {
      throw new Error('Sem permissão para desativar integração')
    }

    return await prisma.integrationConfig.update({
      where: { id: integrationId },
      data: {
        enabled: false,
      },
    })
  }

  static async getIntegrationStats(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (event.organizerId !== userId) {
      throw new Error('Sem permissão para visualizar estatísticas')
    }

    const integrations = await prisma.integrationConfig.findMany({
      where: {
        eventId,
      },
    })

    const orders = await prisma.order.findMany({
      where: {
        eventId,
        paymentStatus: 'APPROVED',
      },
    })

    return {
      totalOrders: orders.length,
      integrations: integrations.map((i: any) => ({
        type: i.type,
        enabled: i.enabled,
      })),
    }
  }
}
