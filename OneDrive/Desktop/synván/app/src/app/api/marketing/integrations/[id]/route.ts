import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { MarketingService } from '@/lib/services/marketing-service'

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

    const result = await MarketingService.disableIntegration(params.id, session.user.id)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao desativar integração' },
      { status: 400 }
    )
  }
}
