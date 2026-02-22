import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { ApiService } from '@/lib/services/api-service'

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

    const result = await ApiService.revokeApiKey(session.user.id, params.id)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao revogar API key' },
      { status: 400 }
    )
  }
}
