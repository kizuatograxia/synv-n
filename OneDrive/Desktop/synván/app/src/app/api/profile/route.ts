import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { ProfileService } from '@/lib/services/profile-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') || 'profile'

    if (section === 'profile') {
      const profile = await ProfileService.getAttendeeProfile(session.user.id)
      return NextResponse.json({ profile })
    }

    if (section === 'orders') {
      const limit = searchParams.get('limit') 
        ? parseInt(searchParams.get('limit')!) 
        : 20

      const orders = await ProfileService.getOrderHistory(session.user.id, limit)
      return NextResponse.json({ orders })
    }

    if (section === 'wallet') {
      const wallet = await ProfileService.getTicketWallet(session.user.id)
      return NextResponse.json({ wallet })
    }

    if (section === 'waitlist') {
      const waitlist = await ProfileService.getWaitlistEntries(session.user.id)
      return NextResponse.json({ waitlist })
    }

    return NextResponse.json(
      { error: 'Seção inválida' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar perfil' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const updates: { name?: string; phone?: string } = {}

    if (body.name) {
      updates.name = body.name
    }

    if (body.phone !== undefined) {
      updates.phone = body.phone || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo para atualizar' },
        { status: 400 }
      )
    }

    const user = await ProfileService.updateProfile(session.user.id, updates)

    return NextResponse.json({
      message: 'Perfil atualizado com sucesso',
      user
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar perfil' },
      { status: 500 }
    )
  }
}
