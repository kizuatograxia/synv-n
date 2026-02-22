import { NextRequest, NextResponse } from 'next/server'
import { QRCodeService } from '@/lib/qrcode/qrcode-service'
import { auth } from '@/lib/auth/config'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const ticketId = params.id

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: true,
        event: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ingresso não encontrado' }, { status: 404 })
    }

    if (ticket.userId !== session.user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    if (ticket.order.paymentStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Pagamento não aprovado' },
        { status: 400 }
      )
    }

    const qrDataURL = await QRCodeService.getTicketQRCode(ticketId, session.user.id)

    if (!qrDataURL) {
      return NextResponse.json(
        { error: 'Erro ao gerar QR Code' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      qrCode: qrDataURL,
      ticket: {
        id: ticket.id,
        code: ticket.code,
        type: ticket.type,
        price: ticket.price,
        event: {
          id: ticket.event.id,
          title: ticket.event.title,
          startTime: ticket.event.startTime,
          location: ticket.event.location,
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
