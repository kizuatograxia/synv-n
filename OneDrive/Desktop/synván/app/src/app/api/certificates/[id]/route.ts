import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { CertificateService } from '@/lib/services/certificate-service'

export async function GET(
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

    const certificate = await CertificateService.downloadCertificate(
      params.id,
      session.user.id
    )

    const html = CertificateService.generateCertificateHTML(certificate)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="certificado-${params.id}.html"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao baixar certificado' },
      { status: 400 }
    )
  }
}
