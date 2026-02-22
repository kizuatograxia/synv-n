import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { ApiService } from '@/lib/services/api-service'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { name, scopes, tier } = body

    if (!name || !scopes || !Array.isArray(scopes)) {
      return NextResponse.json(
        { error: 'name e scopes são obrigatórios' },
        { status: 400 }
      )
    }

    const apiKey = await ApiService.createApiKey(session.user.id, {
      name,
      scopes,
      tier,
    })

    return NextResponse.json(apiKey, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar API key' },
      { status: 400 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const apiKeys = await ApiService.getApiKeys(session.user.id)

    return NextResponse.json({ apiKeys })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar API keys' },
      { status: 500 }
    )
  }
}
