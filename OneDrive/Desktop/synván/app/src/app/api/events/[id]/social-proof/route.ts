import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        orders: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          take: 10,
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    const uniqueFriends = Array.from(
      new Map(
        event.orders.map((order) => [order.user.id, order.user])
      ).values()
    ).slice(0, 5)

    return NextResponse.json({
      friends: uniqueFriends,
      totalAttendees: event.orders.length,
    })
  } catch (error) {
    console.error('Error fetching social proof:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados' },
      { status: 500 }
    )
  }
}
