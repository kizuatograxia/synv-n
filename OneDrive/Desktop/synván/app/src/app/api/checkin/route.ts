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
    const { ticketId, eventId } = body

    if (!ticketId || !eventId) {
      return NextResponse.json(
        { error: 'ID do ingresso e ID do evento são obrigatórios' },
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

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 })
    }

    if (ticket.isUsed) {
      return NextResponse.json(
        { error: 'Ingresso já utilizado' },
        { status: 400 }
      )
    }

    if (ticket.order.paymentStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Pagamento não aprovado' },
        { status: 400 }
      )
    }

    const success = await QRCodeService.checkinTicket(ticketId, eventId)

    if (!success) {
      return NextResponse.json(
        { error: 'Erro ao realizar check-in' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ticketId,
      checkedInAt: new Date(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
