import { NextRequest, NextResponse } from 'next/server'
import { QRCodeService, OfflineCheckinRecord } from '@/lib/qrcode/qrcode-service'
import { auth } from '@/lib/auth/config'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, records } = body

    if (!eventId || !Array.isArray(records)) {
      return NextResponse.json(
        { error: 'ID do evento e registros são obrigatórios' },
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

    const synced = await QRCodeService.syncOfflineCheckins(records)

    return NextResponse.json({
      success: true,
      syncedCount: synced,
      totalRecords: records.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
