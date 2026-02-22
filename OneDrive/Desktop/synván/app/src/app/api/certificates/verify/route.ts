import { NextRequest, NextResponse } from 'next/server'
import { CertificateService } from '@/lib/services/certificate-service'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json(
        { error: 'Código de verificação é obrigatório' },
        { status: 400 }
      )
    }

    const result = await CertificateService.verifyCertificate(code)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar certificado' },
      { status: 500 }
    )
  }
}
