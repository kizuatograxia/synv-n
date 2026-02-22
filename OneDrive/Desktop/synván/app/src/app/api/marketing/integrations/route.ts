import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { MarketingService, IntegrationType } from '@/lib/services/marketing-service'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { eventId, type, apiKey, enabled } = body

    if (!eventId || !type || enabled === undefined) {
      return NextResponse.json(
        { error: 'eventId, type, e enabled são obrigatórios' },
        { status: 400 }
      )
    }

    if (!Object.values(IntegrationType).includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de integração inválido' },
        { status: 400 }
      )
    }

    const config = await MarketingService.configureIntegration(
      session.user.id,
      eventId,
      { type, apiKey, enabled }
    )

    return NextResponse.json(config, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao configurar integração' },
      { status: 400 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      )
    }

    const integrations = await MarketingService.getIntegrations(
      eventId,
      session.user.id
    )

    return NextResponse.json({ integrations })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar integrações' },
      { status: 500 }
    )
  }
}
