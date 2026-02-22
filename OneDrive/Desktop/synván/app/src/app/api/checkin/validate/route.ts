import { NextRequest, NextResponse } from 'next/server'
import { QRCodeService } from '@/lib/qrcode/qrcode-service'
import { auth } from '@/lib/auth/config'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { qrData, eventId } = body

    if (!qrData || !eventId) {
      return NextResponse.json(
        { error: 'QR Code e ID do evento são obrigatórios' },
        { status: 400 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    if (event.organizer.id !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const result = await QRCodeService.validateTicketForCheckin(qrData, eventId)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
