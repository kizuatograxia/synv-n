import { NextRequest, NextResponse } from 'next/server'
import { seatMapService } from '@/lib/services/seat-map-service'
import { auth } from '@/lib/auth/config'
import { z } from 'zod'

const seatMapCreateSchema = z.object({
  name: z.string().min(1),
  rows: z.number().min(1).max(50),
  columns: z.number().min(1).max(50),
  aisleConfig: z.array(z.array(z.number())).optional(),
  sectors: z.array(z.object({
    name: z.string().min(1),
    color: z.string().optional(),
    price: z.number().min(0),
    rowStart: z.number().min(0),
    rowEnd: z.number().min(0),
    colStart: z.number().min(0),
    colEnd: z.number().min(0)
  })).optional()
})

export async function GET(
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

    const seatMaps = await seatMapService.getEventSeatMaps(params.id)

    return NextResponse.json({ seatMaps })
  } catch (error) {
    console.error('Error fetching seat maps:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar mapas de assento' },
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

    const body = await request.json()
    const validatedData = seatMapCreateSchema.parse(body)

    const seatMap = await seatMapService.createSeatMap(
      params.id,
      {
        name: validatedData.name,
        rows: validatedData.rows,
        columns: validatedData.columns,
        aisleConfig: validatedData.aisleConfig
      },
      body.sessionId
    )

    if (validatedData.sectors && validatedData.sectors.length > 0) {
      for (const sector of validatedData.sectors) {
        await seatMapService.createSector(seatMap.id, {
          ...sector,
          color: sector.color || '#3B82F6'
        })
      }
    }

    return NextResponse.json({
      message: 'Mapa de assento criado com sucesso',
      seatMap
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating seat map:', error)
    return NextResponse.json(
      { error: 'Erro ao criar mapa de assento' },
      { status: 500 }
    )
  }
}
