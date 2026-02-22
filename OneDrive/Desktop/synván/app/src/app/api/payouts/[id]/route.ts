import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { PayoutService } from '@/lib/services/payout-service'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const payout = await prisma.payout.findUnique({
      where: { id: params.id },
      include: {
        bankAccount: {
          select: {
            id: true,
            bankName: true,
            agency: true,
            account: true,
            accountType: true,
            accountHolder: true,
            cpf: true,
            isDefault: true,
            isVerified: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!payout) {
      return NextResponse.json(
        { error: 'Repasse não encontrado' },
        { status: 404 }
      )
    }

    // Check if user is authorized to view this payout
    if (payout.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      id: payout.id,
      totalSales: payout.totalSales,
      totalFees: payout.totalFees,
      netAmount: payout.netAmount,
      anticipationAmount: payout.anticipationAmount,
      anticipationFee: payout.anticipationFee,
      bankTransferFee: payout.bankTransferFee,
      finalPayout: payout.finalPayout,
      status: payout.status,
      scheduledFor: payout.scheduledFor,
      processedAt: payout.processedAt,
      createdAt: payout.createdAt,
      bankAccount: payout.bankAccount,
      event: payout.event,
      user: payout.user,
    })
  } catch (error) {
    console.error('Error fetching payout:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar repasse' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Apenas administradores podem aprovar repasses' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body

    if (action === 'approve') {
      const payout = await PayoutService.approvePayout(
        params.id,
        session.user.id
      )

      return NextResponse.json({
        message: 'Repasse aprovado com sucesso',
        payout,
      })
    } else {
      return NextResponse.json(
        { error: 'Ação inválida' },
        { status: 400 }
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error('Error updating payout:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar repasse' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const payout = await PayoutService.cancelPayout(
      params.id,
      session.user.id
    )

    return NextResponse.json({
      message: 'Repasse cancelado com sucesso',
      payout,
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error('Error cancelling payout:', error)
    return NextResponse.json(
      { error: 'Erro ao cancelar repasse' },
      { status: 500 }
    )
  }
}
