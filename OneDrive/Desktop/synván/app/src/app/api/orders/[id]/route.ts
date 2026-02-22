import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { OrderService } from '@/lib/services/order-service'
import { updateOrderSchema } from '@/lib/validations/order'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

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

    const order = await OrderService.getOrderById(params.id, session.user.id)

    return NextResponse.json({ order })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar pedido' },
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

    const body = await request.json()
    const validatedData = updateOrderSchema.parse(body)

    const order = await OrderService.updateOrder(
      params.id,
      session.user.id,
      validatedData
    )

    return NextResponse.json({
      message: 'Pedido atualizado com sucesso',
      order,
    })
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

    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar pedido' },
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

    const order = await OrderService.getOrderById(params.id, session.user.id)

    if (order.paymentStatus === 'APPROVED') {
      return NextResponse.json(
        { error: 'Não é possível deletar um pedido aprovado' },
        { status: 400 }
      )
    }

    await prisma.order.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      message: 'Pedido cancelado com sucesso',
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: 'Erro ao cancelar pedido' },
      { status: 500 }
    )
  }
}
