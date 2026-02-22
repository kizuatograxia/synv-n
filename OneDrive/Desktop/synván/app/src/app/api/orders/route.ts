import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { OrderService } from '@/lib/services/order-service'
import { createOrderSchema } from '@/lib/validations/order'
import { z } from 'zod'

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
    const validatedData = createOrderSchema.parse(body)

    const result = await OrderService.createOrder(
      session.user.id,
      validatedData,
      validatedData.eventId
    )

    return NextResponse.json(
      {
        message: 'Pedido criado com sucesso',
        order: result.order,
        summary: result.summary,
        installmentDetails: result.installmentDetails,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Erro ao criar pedido' },
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

    const orders = await OrderService.getOrdersByUser(
      session.user.id,
      eventId || undefined
    )

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos' },
      { status: 500 }
    )
  }
}
