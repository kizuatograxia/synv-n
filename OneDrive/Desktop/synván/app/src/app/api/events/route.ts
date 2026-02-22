import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { auth } from '@/lib/auth/config'
import { z } from 'zod'
import { cacheGet, cacheSet, cacheInvalidatePattern, CACHE_TTL } from '@/lib/cache/redis'

const eventSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  slug: z.string().min(3, 'Slug deve ter pelo menos 3 caracteres'),
  startTime: z.string().datetime('Data/hora inicial inválida'),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
  imageUrl: z.string().url('URL da imagem inválida').optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const published = searchParams.get('published')
    const search = searchParams.get('search')
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const category = searchParams.get('category')
    const organizerId = searchParams.get('organizerId')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '12', 10)
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Generate cache key from search parameters
    const cacheKey = `events:${searchParams.toString()}`

    // Try to get from cache first
    const cachedEvents = await cacheGet<any>(cacheKey)
    if (cachedEvents) {
      return NextResponse.json(cachedEvents)
    }

    const where: any = {}

    if (published === 'true') {
      where.isPublished = true
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' }
    }

    if (state) {
      where.state = { equals: state }
    }

    if (startDate) {
      where.startTime = { gte: new Date(startDate) }
    }

    if (endDate) {
      where.startTime = { lte: new Date(endDate) }
    }

    if (minPrice) {
      where.lots = {
        some: {
          isActive: true,
          price: { gte: parseFloat(minPrice) },
        },
      }
    }

    if (maxPrice) {
      where.lots = {
        some: {
          isActive: true,
          price: { lte: parseFloat(maxPrice) },
        },
      }
    }

    if (category) {
      where.description = { contains: category, mode: 'insensitive' }
    }

    // Handle special case for organizerId="me" to get current user's events
    if (organizerId === 'me') {
      const session = await auth()
      if (session?.user?.id) {
        where.organizerId = session.user.id
      } else {
        return NextResponse.json(
          { error: 'Não autorizado' },
          { status: 401 }
        )
      }
    } else if (organizerId) {
      where.organizerId = organizerId
    }

    // Determine order by clause
    let orderBy: any = { startTime: 'asc' }
    if (sortBy === 'date') {
      orderBy = { startTime: sortOrder as 'asc' | 'desc' }
    } else if (sortBy === 'price') {
      orderBy = { lots: { price: sortOrder as 'asc' | 'desc' } }
    } else if (sortBy === 'title') {
      orderBy = { title: sortOrder as 'asc' | 'desc' }
    }

    // Get total count for pagination
    const total = await prisma.event.count({ where })

    // Get paginated events
    const events = await prisma.event.findMany({
      where,
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        lots: {
          where: { isActive: true },
          orderBy: { price: 'asc' }
        }
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize
    })

    const totalPages = Math.ceil(total / pageSize)

    const responseData = {
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    }

    // Cache the response for 5 minutes
    await cacheSet(cacheKey, responseData, CACHE_TTL.EVENT_LISTINGS)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar eventos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const validatedData = eventSchema.parse(body)

    const existingEvent = await prisma.event.findUnique({
      where: { slug: validatedData.slug }
    })

    if (existingEvent) {
      return NextResponse.json(
        { error: 'Slug já está em uso' },
        { status: 400 }
      )
    }

    const event = await prisma.event.create({
      data: {
        ...validatedData,
        startTime: new Date(validatedData.startTime),
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        organizerId: session.user.id
      }
    })

    // Invalidate all event listing caches when a new event is created
    await cacheInvalidatePattern('events:*')

    return NextResponse.json(
      { message: 'Evento criado com sucesso', event },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Erro ao criar evento' },
      { status: 500 }
    )
  }
}
