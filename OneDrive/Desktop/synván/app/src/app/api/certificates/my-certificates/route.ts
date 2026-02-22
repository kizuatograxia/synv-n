import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { CertificateService } from '@/lib/services/certificate-service'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const certificates = await CertificateService.getCertificatesByUser(
      session.user.id
    )

    return NextResponse.json({ certificates })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar certificados' },
      { status: 500 }
    )
  }
}
