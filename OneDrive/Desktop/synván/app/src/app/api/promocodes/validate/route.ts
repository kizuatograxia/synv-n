import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth/config'
import { applyPromocodeSchema } from '@/lib/validations/order'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = applyPromocodeSchema.parse(body)

    const promocode = await prisma.promocode.findUnique({
      where: { code: validatedData.code.toUpperCase() },
    })

    if (!promocode) {
      return NextResponse.json(
        { error: 'Cupom inválido' },
        { status: 404 }
      )
    }

    if (!promocode.isActive) {
      return NextResponse.json(
        { error: 'Cupom inativo' },
        { status: 400 }
      )
    }

    if (promocode.expiresAt && promocode.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Cupom expirado' },
        { status: 400 }
      )
    }

    if (promocode.maxUsage && promocode.currentUsage >= promocode.maxUsage) {
      return NextResponse.json(
        { error: 'Cupom esgotado' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'Cupom válido',
      promocode: {
        id: promocode.id,
        code: promocode.code,
        discountType: promocode.discountType,
        discountValue: promocode.discountValue,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error validating promocode:', error)
    return NextResponse.json(
      { error: 'Erro ao validar cupom' },
      { status: 500 }
    )
  }
}
