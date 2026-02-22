import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth/config'
import { z } from 'zod'
import { cacheInvalidatePattern } from '@/lib/cache/redis'

const lotSchema = z.object({
  name: z.string().min(1, 'Nome do lote é obrigatório'),
  price: z.number().positive('Preço deve ser positivo'),
  totalQuantity: z.number().positive('Quantidade total deve ser positiva'),
  availableQuantity: z.number().positive('Quantidade disponível deve ser positiva'),
  startDate: z.string().datetime('Data/hora inicial inválida'),
  endDate: z.string().datetime('Data/hora final inválida'),
  isActive: z.boolean().optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lots = await prisma.lot.findMany({
      where: { eventId: params.id },
      orderBy: { startDate: 'asc' }
    })

    return NextResponse.json({ lots })
  } catch (error) {
    console.error('Error fetching lots:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar lotes' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const validatedData = lotSchema.parse(body)

    const lot = await prisma.lot.create({
      data: {
        ...validatedData,
        eventId: params.id,
        startDate: new Date(validatedData.startDate),
        endDate: new Date(validatedData.endDate)
      }
    })

    // Invalidate event listings cache when a new lot is created
    await cacheInvalidatePattern('events:*')

    return NextResponse.json(
      { message: 'Lote criado com sucesso', lot },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating lot:', error)
    return NextResponse.json(
      { error: 'Erro ao criar lote' },
      { status: 500 }
    )
  }
}
