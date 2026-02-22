import { prisma } from '@/lib/db/prisma'

enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD'
}

interface SeatMapConfig {
  name: string
  rows: number
  columns: number
  aisleConfig?: number[][]
  sectors?: Array<{
    name: string
    color: string
    price: number
    rowStart: number
    rowEnd: number
    colStart: number
    colEnd: number
  }>
}

interface SeatReservation {
  userId: string
  seatIds: string[]
  reservationTimeout?: number
}

export class SeatMapService {
  async createSeatMap(eventId: string, config: SeatMapConfig, sessionId?: string) {
    return await prisma.$transaction(async (tx) => {
      const seatMap = await tx.seatMap.create({
        data: {
          name: config.name,
          rows: config.rows,
          columns: config.columns,
          aisleConfig: config.aisleConfig || [],
          eventId,
          sessionId
        }
      })

      let seatCount = 0
      const aisleSet = new Set(
        config.aisleConfig?.map(([row, col]) => `${row}-${col}`) || []
      )

      const seats = []
      for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.columns; col++) {
          if (aisleSet.has(`${row}-${col}`)) {
            continue
          }

          const label = `${String.fromCharCode(65 + row)}${col + 1}`
          seats.push({
            row,
            column: col,
            label,
            seatMapId: seatMap.id
          })
          seatCount++
        }
      }

      if (seats.length > 0) {
        await tx.seat.createMany({ data: seats })
      }

      return seatMap
    })
  }

  async createSector(seatMapId: string, sector: NonNullable<SeatMapConfig['sectors']>[0], lotId?: string) {
    return await prisma.$transaction(async (tx) => {
      const sectorRecord = await tx.sector.create({
        data: {
          name: sector.name,
          color: sector.color,
          price: sector.price,
          rowStart: sector.rowStart,
          rowEnd: sector.rowEnd,
          colStart: sector.colStart,
          colEnd: sector.colEnd,
          seatMapId,
          lots: lotId ? { connect: { id: lotId } } : undefined
        }
      })

      await tx.seat.updateMany({
        where: {
          seatMapId,
          row: { gte: sector.rowStart, lte: sector.rowEnd },
          column: { gte: sector.colStart, lte: sector.colEnd }
        },
        data: { sectorId: sectorRecord.id }
      })

      return sectorRecord
    })
  }

  async getSeatMap(seatMapId: string) {
    return await prisma.seatMap.findUnique({
      where: { id: seatMapId },
      include: {
        sectors: {
          include: {
            lots: true
          }
        },
        seats: {
          include: {
            sector: true,
            lot: true,
            ticket: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    })
  }

  async getEventSeatMaps(eventId: string) {
    return await prisma.seatMap.findMany({
      where: { eventId },
      include: {
        session: true,
        sectors: {
          include: {
            lots: true
          }
        },
        _count: {
          select: {
            seats: true
          }
        }
      }
    })
  }

  async getAvailableSeats(seatMapId: string, sectorId?: string) {
    const now = new Date()
    
    const where: any = {
      seatMapId,
      status: SeatStatus.AVAILABLE
    }

    if (sectorId) {
      where.sectorId = sectorId
    }

    return await prisma.seat.findMany({
      where,
      include: {
        sector: true,
        lot: true
      }
    })
  }

  async reserveSeats(seatMapId: string, reservation: SeatReservation) {
    const { userId, seatIds, reservationTimeout = 900000 } = reservation
    const timeoutDate = new Date(Date.now() + reservationTimeout)

    return await prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: {
          id: { in: seatIds },
          seatMapId,
          status: SeatStatus.AVAILABLE
        },
        include: {
          sector: true,
          lot: true
        }
      })

      if (seats.length !== seatIds.length) {
        throw new Error('Alguns assentos não estão disponíveis')
      }

      const updatedSeats = await Promise.all(
        seats.map((seat) =>
          tx.seat.update({
            where: { id: seat.id },
            data: {
              status: SeatStatus.RESERVED,
              reservedAt: timeoutDate,
              reservedBy: userId
            },
            include: {
              sector: true,
              lot: true
            }
          })
        )
      )

      return updatedSeats
    })
  }

  async releaseReservations(userId: string, seatIds: string[]) {
    return await prisma.seat.updateMany({
      where: {
        id: { in: seatIds },
        status: SeatStatus.RESERVED,
        reservedBy: userId
      },
      data: {
        status: SeatStatus.AVAILABLE,
        reservedAt: null,
        reservedBy: null
      }
    })
  }

  async confirmSeatReservations(seatIds: string[], ticketIds: string[]) {
    return await prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: {
          id: { in: seatIds }
        }
      })

      if (seats.length !== seatIds.length) {
        throw new Error('Alguns assentos não foram encontrados')
      }

      for (let i = 0; i < seatIds.length; i++) {
        await tx.seat.update({
          where: { id: seatIds[i] },
          data: {
            status: SeatStatus.SOLD,
            ticketId: ticketIds[i],
            reservedAt: null,
            reservedBy: null
          }
        })
      }

      return seats
    })
  }

  async releaseExpiredReservations() {
    const now = new Date()

    const result = await prisma.seat.updateMany({
      where: {
        status: SeatStatus.RESERVED,
        reservedAt: {
          lt: now
        }
      },
      data: {
        status: SeatStatus.AVAILABLE,
        reservedAt: null,
        reservedBy: null
      }
    })

    return result.count
  }

  async deleteSeatMap(seatMapId: string) {
    return await prisma.seatMap.delete({
      where: { id: seatMapId }
    })
  }

  async updateSeatMap(seatMapId: string, config: Partial<SeatMapConfig>) {
    return await prisma.seatMap.update({
      where: { id: seatMapId },
      data: {
        ...(config.name && { name: config.name }),
        ...(config.rows && { rows: config.rows }),
        ...(config.columns && { columns: config.columns }),
        ...(config.aisleConfig && { aisleConfig: config.aisleConfig })
      }
    })
  }
}

export const seatMapService = new SeatMapService()
