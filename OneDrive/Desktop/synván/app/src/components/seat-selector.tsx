'use client'

import { useCallback, useState, useEffect } from 'react'
import { SeatStatus } from '@prisma/client'
import { color as designColor } from '@/lib/colors'
import { SkeletonTextBlock } from '@/components/ui/skeleton'

interface Seat {
  id: string
  row: number
  column: number
  label: string
  status: SeatStatus
  sector?: {
    id: string
    name: string
    color: string
    price: number
  }
  lot?: {
    id: string
    name: string
    price: number
  }
}

interface Sector {
  id: string
  name: string
  color: string
  price: number
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

interface SeatMap {
  id: string
  name: string
  rows: number
  columns: number
  aisleConfig: number[][]
  sectors: Sector[]
  seats: Seat[]
}

interface SeatSelectorProps {
  seatMapId: string
  eventId: string
  onSeatSelection: (seats: Seat[]) => void
  maxSelections?: number
  initialSelectedSeats?: string[]
}

export default function SeatSelector({
  seatMapId,
  eventId,
  onSeatSelection,
  maxSelections = 10,
  initialSelectedSeats = []
}: SeatSelectorProps) {
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set(initialSelectedSeats))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchSeatMap = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/events/${eventId}/seat-map/${seatMapId}`)
      const data = await response.json()

      if (response.ok) {
        setSeatMap(data.seatMap)
      } else {
        setError(data.error || 'Erro ao carregar mapa de assento')
      }
    } catch (err) {
      setError('Erro ao carregar mapa de assento')
    } finally {
      setLoading(false)
    }
  }, [eventId, seatMapId])

  useEffect(() => {
    fetchSeatMap()
  }, [fetchSeatMap])

  useEffect(() => {
    if (seatMap) {
      const selectedSeatObjects = seatMap.seats.filter(seat =>
        selectedSeats.has(seat.id)
      )
      onSeatSelection(selectedSeatObjects)
    }
  }, [selectedSeats, seatMap, onSeatSelection])

  const handleSeatClick = async (seat: Seat) => {
    if (seat.status !== SeatStatus.AVAILABLE) {
      return
    }

    const newSelected = new Set(selectedSeats)

    if (newSelected.has(seat.id)) {
      newSelected.delete(seat.id)
      setSelectedSeats(newSelected)
    } else {
      if (newSelected.size >= maxSelections) {
        setError(`Você pode selecionar no máximo ${maxSelections} assentos`)
        return
      }

      try {
        const reserveResponse = await fetch(
          `/api/events/${eventId}/seat-map/${seatMapId}?action=reserve`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              seatIds: [seat.id],
              reservationTimeout: 900000
            })
          }
        )

        if (reserveResponse.ok) {
          newSelected.add(seat.id)
          setSelectedSeats(newSelected)
          setError('')
        } else {
          const data = await reserveResponse.json()
          setError(data.error || 'Erro ao reservar assento')
        }
      } catch (err) {
        setError('Erro ao reservar assento')
      }
    }
  }

  const handleReleaseSeat = async (seatId: string) => {
    try {
      const response = await fetch(
        `/api/events/${eventId}/seat-map/${seatMapId}/seats/${seatId}?action=release-reservation`,
        {
          method: 'DELETE'
        }
      )

      if (response.ok) {
        const newSelected = new Set(selectedSeats)
        newSelected.delete(seatId)
        setSelectedSeats(newSelected)
      }
    } catch (err) {
      setError('Erro ao liberar reserva')
    }
  }

  const releaseAllSeats = async () => {
    const promises = Array.from(selectedSeats).map(seatId =>
      handleReleaseSeat(seatId)
    )
    await Promise.all(promises)
  }

  const getSeatColor = (seat: Seat) => {
    switch (seat.status) {
      case SeatStatus.AVAILABLE:
        return seat.sector?.color || designColor.neutral200
      case SeatStatus.RESERVED:
        return designColor.warning400
      case SeatStatus.SOLD:
        return designColor.error500
      default:
        return designColor.neutral200
    }
  }

  const getSeatStatus = (row: number, column: number) => {
    const isAisle = seatMap?.aisleConfig.some(([r, c]) => r === row && c === column)
    if (isAisle) return 'aisle'
    return 'seat'
  }

  const renderSeatGrid = () => {
    if (!seatMap) return null

    const grid = []
    for (let row = 0; row < seatMap.rows; row++) {
      const rowSeats = []
      for (let col = 0; col < seatMap.columns; col++) {
        const status = getSeatStatus(row, col)
        const seatId = `${row}-${col}`

        if (status === 'aisle') {
          rowSeats.push(
            <div key={seatId} className="w-8 h-8" />
          )
        } else {
          const seat = seatMap.seats.find(s => s.row === row && s.column === col)
          const isSelected = selectedSeats.has(seat?.id || '')
          const color = getSeatColor(seat || {} as Seat)

          if (seat) {
            rowSeats.push(
              <div
                key={seat.id}
                onClick={() => handleSeatClick(seat)}
                title={`${seat.label} - ${seat.status === SeatStatus.SOLD ? 'Vendido' : seat.status === SeatStatus.RESERVED ? 'Reservado' : seat.sector?.name || 'Disponível'}`}
                className={`
                  w-8 h-8 rounded-sm cursor-pointer flex items-center justify-center text-xs
                  transition-all duration-150
                  ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : 'hover:opacity-80'}
                  ${seat.status === SeatStatus.SOLD ? 'cursor-not-allowed opacity-50' : ''}
                `}
                style={{ backgroundColor: isSelected ? designColor.primary400 : color }}
              >
                {col + 1}
              </div>
            )
          }
        }
      }
      grid.push(
        <div key={row} className="flex items-center justify-center gap-1 mb-1">
          <div className="w-6 h-8 flex items-center justify-center text-xs font-bold text-gray-500">
            {String.fromCharCode(65 + row)}
          </div>
          {rowSeats}
          <div className="w-6 h-8 flex items-center justify-center text-xs font-bold text-gray-500">
            {String.fromCharCode(65 + row)}
          </div>
        </div>
      )
    }
    return grid
  }

  const renderColumnLabels = () => {
    if (!seatMap) return null

    const labels = []
    for (let col = 0; col < seatMap.columns; col++) {
      labels.push(
        <div key={col} className="w-8 h-6 flex items-center justify-center text-xs text-gray-500">
          {col + 1}
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center gap-1 mb-2 ml-7 mr-7">
        {labels}
      </div>
    )
  }

  const renderLegend = () => {
    const uniqueSectors = seatMap?.sectors || []
    const hasGeneralSeats = seatMap?.seats.some(s => !s.sector && s.status === SeatStatus.AVAILABLE)

    return (
      <div className="flex flex-wrap gap-4 justify-center mt-6">
        <div className="flex items-center gap-2">
          <div className="w-[1rem] h-[1rem] rounded bg-green-500" />
          <span className="text-xs text-gray-600">Disponível</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[1rem] h-[1rem] rounded bg-yellow-400" />
          <span className="text-xs text-gray-600">Reservado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[1rem] h-[1rem] rounded bg-red-500" />
          <span className="text-xs text-gray-600">Vendido</span>
        </div>
        {hasGeneralSeats && (
          <div className="flex items-center gap-2">
            <div className="w-[1rem] h-[1rem] rounded bg-gray-200" />
            <span className="text-xs text-gray-600">Geral</span>
          </div>
        )}
        {uniqueSectors.map(sector => (
          <div key={sector.id} className="flex items-center gap-2">
            <div
              className="w-[1rem] h-[1rem] rounded"
              style={{ backgroundColor: sector.color }}
            />
            <span className="text-xs text-gray-600">{sector.name}</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-12 space-y-4" aria-live="polite" aria-busy="true">
        <div className="h-6 bg-neutral-200 rounded animate-pulse w-48 mx-auto" />
        <div className="bg-white rounded-lg shadow-md p-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: 32 }).map((_, i) => (
              <div key={i} className="h-8 bg-neutral-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && !seatMap) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {error}
      </div>
    )
  }

  const selectedSeatsList = seatMap?.seats.filter(s => selectedSeats.has(s.id)) || []
  const totalPrice = selectedSeatsList.reduce((sum, seat) => {
    return sum + (seat.sector?.price || seat.lot?.price || 0)
  }, 0)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Selecione seus assentos
        </h3>
        <div className="text-sm text-gray-600">
          Selecionados: {selectedSeats.size}/{maxSelections}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="flex justify-center mb-6 relative">
        <div className="bg-gray-100 rounded-lg p-4 md:p-6 w-full overflow-x-auto">
          <div className="min-w-max mx-auto">
            <div className="flex justify-center mb-4">
              <div className="bg-gray-300 text-gray-700 px-4 py-2 rounded-t-lg text-sm whitespace-nowrap">
                Palco
              </div>
            </div>
            {renderColumnLabels()}
            <div className="flex flex-col items-center">
              {renderSeatGrid()}
            </div>
            {renderLegend()}
          </div>
        </div>
        <p className="md:hidden text-xs text-neutral-600 absolute bottom-0 left-4 right-4 text-center bg-white/90 backdrop-blur py-2 px-4 rounded-lg shadow">
          Deslize para ver mais assentos →
        </p>
      </div>

      {selectedSeatsList.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">
            Assentos Selecionados
          </h4>
          <div className="space-y-2 mb-4">
            {selectedSeatsList.map(seat => (
              <div
                key={seat.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-[1rem] h-[1rem] rounded"
                    style={{ backgroundColor: getSeatColor(seat) }}
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {seat.label}
                    </div>
                    <div className="text-sm text-gray-600">
                      {seat.sector?.name || 'Geral'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      R$ {(seat.sector?.price || seat.lot?.price || 0).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleReleaseSeat(seat.id)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Remover assento selecionado"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-blue-50 rounded-lg p-4">
            <div className="text-lg font-semibold text-gray-900">
              Total
            </div>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalPrice.toFixed(2)}
            </div>
          </div>

          <button
            onClick={releaseAllSeats}
            className="w-full mt-4 py-2 px-4 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Limpar Seleção
          </button>
        </div>
      )}
    </div>
  )
}
