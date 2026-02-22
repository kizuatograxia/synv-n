import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { CertificateService } from '@/lib/services/certificate-service'

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
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId é obrigatório' },
        { status: 400 }
      )
    }

    const certificate = await CertificateService.generateCertificate({
      orderId,
    })

    return NextResponse.json(certificate, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar certificado' },
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

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    // If eventId is provided, get certificates for that event (organizer view)
    if (eventId) {
      const certificates = await CertificateService.getCertificatesByEvent(
        eventId,
        session.user.id
      )

      return NextResponse.json({ certificates })
    }

    // Otherwise, get certificates for the current user
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
