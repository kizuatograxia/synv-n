import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth/config'
import { z } from 'zod'
import { cacheInvalidatePattern } from '@/lib/cache/redis'

const lotUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  totalQuantity: z.number().positive().optional(),
  availableQuantity: z.number().nonnegative().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; lotId: string } }
) {
  try {
    const lot = await prisma.lot.findFirst({
      where: {
        id: params.lotId,
        eventId: params.id
      }
    })

    if (!lot) {
      return NextResponse.json(
        { error: 'Lote não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ lot })
  } catch (error) {
    console.error('Error fetching lot:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar lote' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; lotId: string } }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id: params.id }
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
    const validatedData = lotUpdateSchema.parse(body)

    const updatedLot = await prisma.lot.updateMany({
      where: {
        id: params.lotId,
        eventId: params.id
      },
      data: {
        ...validatedData,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined
      }
    })

    // Invalidate event listings cache when a lot is updated
    await cacheInvalidatePattern('events:*')

    return NextResponse.json({
      message: 'Lote atualizado com sucesso',
      lot: updatedLot
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating lot:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar lote' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; lotId: string } }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id: params.id }
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

    await prisma.lot.deleteMany({
      where: {
        id: params.lotId,
        eventId: params.id
      }
    })

    // Invalidate event listings cache when a lot is deleted
    await cacheInvalidatePattern('events:*')

    return NextResponse.json({
      message: 'Lote deletado com sucesso'
    })
  } catch (error) {
    console.error('Error deleting lot:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar lote' },
      { status: 500 }
    )
  }
}
