import { NextRequest, NextResponse } from 'next/server'
import { seatMapService } from '@/lib/services/seat-map-service'
import { auth } from '@/lib/auth/config'
import { z } from 'zod'
import { cacheInvalidatePattern } from '@/lib/cache/redis'

const seatMapUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  rows: z.number().min(1).max(50).optional(),
  columns: z.number().min(1).max(50).optional(),
  aisleConfig: z.array(z.array(z.number())).optional()
})

const sectorCreateSchema = z.object({
  name: z.string().min(1),
  color: z.string().default('#000000'),
  price: z.number().min(0),
  rowStart: z.number().min(0),
  rowEnd: z.number().min(0),
  colStart: z.number().min(0),
  colEnd: z.number().min(0)
})

const reservationSchema = z.object({
  seatIds: z.array(z.string()).min(1),
  reservationTimeout: z.number().optional()
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; mapId: string } }
) {
  try {
    const seatMap = await seatMapService.getSeatMap(params.mapId)

    if (!seatMap) {
      return NextResponse.json(
        { error: 'Mapa de assento não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ seatMap })
  } catch (error) {
    console.error('Error fetching seat map:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar mapa de assento' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; mapId: string } }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = seatMapUpdateSchema.parse(body)

    const seatMap = await seatMapService.updateSeatMap(
      params.mapId,
      validatedData
    )

    return NextResponse.json({
      message: 'Mapa de assento atualizado com sucesso',
      seatMap
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating seat map:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar mapa de assento' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; mapId: string } }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    await seatMapService.deleteSeatMap(params.mapId)

    return NextResponse.json({
      message: 'Mapa de assento deletado com sucesso'
    })
  } catch (error) {
    console.error('Error deleting seat map:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar mapa de assento' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; mapId: string } }
) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'create-sector') {
    return await createSector(request, params.mapId)
  } else if (action === 'reserve') {
    return await reserveSeats(request, params.mapId)
  } else {
    return NextResponse.json(
      { error: 'Ação inválida' },
      { status: 400 }
    )
  }
}

async function createSector(request: NextRequest, seatMapId: string) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = sectorCreateSchema.parse(body)

    const sector = await seatMapService.createSector(
      seatMapId,
      validatedData,
      body.lotId
    )

    return NextResponse.json({
      message: 'Setor criado com sucesso',
      sector
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating sector:', error)
    return NextResponse.json(
      { error: 'Erro ao criar setor' },
      { status: 500 }
    )
  }
}

async function reserveSeats(request: NextRequest, seatMapId: string) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = reservationSchema.parse(body)

    const seats = await seatMapService.reserveSeats(seatMapId, {
      userId: session.user.id,
      seatIds: validatedData.seatIds,
      reservationTimeout: validatedData.reservationTimeout
    })

    // Invalidate seat availability cache for this seat map
    await cacheInvalidatePattern(`seat-availability:${seatMapId}:*`)

    return NextResponse.json({
      message: 'Assentos reservados com sucesso',
      seats
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error reserving seats:', error)
    const message = error instanceof Error ? error.message : 'Erro ao reservar assentos'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}
