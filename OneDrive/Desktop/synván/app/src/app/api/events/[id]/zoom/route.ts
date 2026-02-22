import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { ZoomIntegrationService } from '@/lib/services/zoom-integration-service'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const createMeetingSchema = z.object({
  topic: z.string().min(1),
  startTime: z.string().datetime(),
  duration: z.number().min(15).max(240),
  password: z.string().min(4).max(10).optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        lots: true
      }
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    if (event.organizerId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createMeetingSchema.parse(body)

    const meeting = await ZoomIntegrationService.createMeeting(
      params.id,
      validatedData.topic,
      new Date(validatedData.startTime),
      validatedData.duration,
      validatedData.password
    )

    return NextResponse.json({
      message: 'Reunião Zoom criada com sucesso',
      meeting
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating Zoom meeting:', error)
    return NextResponse.json(
      { error: 'Erro ao criar reunião Zoom' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        lots: true
      }
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    if (event.organizerId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    const meetings = await ZoomIntegrationService.getMeetingParticipantCount(params.id)

    return NextResponse.json({ meetings })
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar reuniões' },
      { status: 500 }
    )
  }
}
