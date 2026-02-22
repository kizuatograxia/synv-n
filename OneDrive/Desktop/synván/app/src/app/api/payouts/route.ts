import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { PayoutService, CreatePayoutInput } from '@/lib/services/payout-service'
import { prisma } from '@/lib/db/prisma'
import { FeeEngine } from '@/lib/fees'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bankAccountId, anticipationAmount, eventId } = body

    if (!bankAccountId) {
      const defaultBankAccount = await prisma.bankAccount.findFirst({
        where: {
          userId: session.user.id,
          isDefault: true,
        },
      })

      if (!defaultBankAccount) {
        return NextResponse.json(
          { error: 'Nenhuma conta bancária cadastrada' },
          { status: 400 }
        )
      }
    }

    const event = eventId
      ? await prisma.event.findUnique({
          where: { id: eventId },
        })
      : null

    if (event) {
      const daysBeforeEvent = (new Date(event.startTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      })

      const hasBankAccount = await prisma.bankAccount.findFirst({
        where: { userId: session.user.id },
      })

      const validation = FeeEngine.validateAnticipationRequest(
        0,
        daysBeforeEvent,
        false, // isPrivate - not supported in current schema
        event.isPublished,
        !!hasBankAccount,
        false
      )

      if (!validation.valid && anticipationAmount) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        )
      }
    }

    const result = await PayoutService.requestPayout(session.user.id, {
      bankAccountId,
      anticipationAmount,
      eventId,
    })

    return NextResponse.json({
      message: 'Solicitação de repasse enviada com sucesso',
      payout: result,
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error('Error creating payout:', error)
    return NextResponse.json(
      { error: 'Erro ao solicitar repasse' },
      { status: 500 }
    )
  }
}

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
    const eventId = searchParams.get('eventId')

    const payouts = await PayoutService.getPayouts(session.user.id, eventId || undefined)

    return NextResponse.json({ payouts })
  } catch (error) {
    console.error('Error fetching payouts:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar repasses' },
      { status: 500 }
    )
  }
}
