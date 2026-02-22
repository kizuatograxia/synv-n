import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { ResaleService } from '@/lib/services/resale-service'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listing = await ResaleService.getResaleListingById(params.id)

    return NextResponse.json(listing)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Listing não encontrado' },
      { status: 404 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { paymentMethod } = body

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Campo obrigatório: paymentMethod' },
        { status: 400 }
      )
    }

    const result = await ResaleService.buyResaleTicket(session.user.id, {
      resaleListingId: params.id,
      paymentMethod,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao comprar ingresso de revenda' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const listing = await ResaleService.cancelResaleListing(
      params.id,
      session.user.id
    )

    return NextResponse.json(listing)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar listing de revenda' },
      { status: 400 }
    )
  }
}
