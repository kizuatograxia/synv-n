import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { ResaleService } from '@/lib/services/resale-service'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const listings = await ResaleService.getResaleListingsByUser(
      session.user.id
    )

    return NextResponse.json(listings)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar listings de revenda' },
      { status: 500 }
    )
  }
}
