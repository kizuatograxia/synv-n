'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { color as designColor } from '@/lib/colors'

interface Seat {
  id: string
  row: number
  column: number
  label: string
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD'
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

interface SeatMapProps {
  eventId: string
  seatMapId?: string
}

export default function SeatMapEditor({ eventId, seatMapId }: SeatMapProps) {
  const router = useRouter()
  const [config, setConfig] = useState({
    name: 'Mapa Principal',
    rows: 10,
    columns: 15,
    aisleConfig: [] as number[][]
  })
  const [sectors, setSectors] = useState<Sector[]>([])
  const [seats, setSeats] = useState<Seat[]>([])
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'view' | 'edit-sector' | 'add-aisle'>('view')
  const [newSector, setNewSector] = useState<{
    name: string
    color: string
    price: number
  }>({
    name: '',
    color: designColor.primary500,
    price: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const focusedSeatRef = useRef<{ row: number; col: number } | null>(null)

  const handleCreateSeatMap = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/events/${eventId}/seat-map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...config,
          sectors: sectors.map(s => ({
            name: s.name,
            color: s.color,
            price: s.price,
            rowStart: s.rowStart,
            rowEnd: s.rowEnd,
            colStart: s.colStart,
            colEnd: s.colEnd
          }))
        })
      })

      const data = await response.json()

      if (response.ok) {
        router.push(`/organizer/events/${eventId}`)
      } else {
        setError(data.error || 'Erro ao criar mapa de assento')
      }
    } catch (err) {
      setError('Erro ao criar mapa de assento')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSeat = (seatId: string) => {
    // In view mode, don't select seats
    if (mode === 'view') return

    const newSelected = new Set(selectedSeats)
    if (newSelected.has(seatId)) {
      newSelected.delete(seatId)
    } else {
      newSelected.add(seatId)
    }
    setSelectedSeats(newSelected)
  }

  // Handle keyboard navigation for seat grid
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, row: number, col: number) => {
    let newRow = row
    let newCol = col
    let handled = false

    switch (event.key) {
      case 'ArrowUp':
        newRow = Math.max(0, row - 1)
        handled = true
        break
      case 'ArrowDown':
        newRow = Math.min(config.rows - 1, row + 1)
        handled = true
        break
      case 'ArrowLeft':
        newCol = Math.max(0, col - 1)
        handled = true
        break
      case 'ArrowRight':
        newCol = Math.min(config.columns - 1, col + 1)
        handled = true
        break
      case 'Enter':
      case ' ':
        // Toggle seat selection on Enter or Space
        event.preventDefault()
        handleToggleSeat(`${row}-${col}`)
        handled = true
        break
      default:
        return
    }

    if (handled) {
      event.preventDefault()
      // Focus the next seat
      const nextSeatId = `seat-${newRow}-${newCol}`
      const nextSeatButton = document.getElementById(nextSeatId)
      if (nextSeatButton && nextSeatButton instanceof HTMLButtonElement) {
        nextSeatButton.focus()
        focusedSeatRef.current = { row: newRow, col: newCol }
      }
    }
  }, [config.rows, config.columns, mode, selectedSeats])

  const handleCreateSector = () => {
    if (selectedSeats.size === 0 || !newSector.name || newSector.price <= 0) {
      setError('Selecione assentos e preencha os dados do setor')
      return
    }

    const selectedSeatsList = Array.from(selectedSeats)
    const rows = selectedSeatsList.map(id => {
      const seat = seats.find(s => s.id === id)
      return seat ? seat.row : 0
    })
    const cols = selectedSeatsList.map(id => {
      const seat = seats.find(s => s.id === id)
      return seat ? seat.column : 0
    })

    const sector: Sector = {
      id: `sector-${Date.now()}`,
      name: newSector.name,
      color: newSector.color,
      price: newSector.price,
      rowStart: Math.min(...rows),
      rowEnd: Math.max(...rows),
      colStart: Math.min(...cols),
      colEnd: Math.max(...cols)
    }

    setSectors([...sectors, sector])
    setSelectedSeats(new Set())
    setMode('view')
    setNewSector({ name: '', color: designColor.primary500, price: 0 })
  }

  const handleDeleteSector = (sectorId: string) => {
    setSectors(sectors.filter(s => s.id !== sectorId))
  }

  const getSeatColor = (row: number, column: number) => {
    const sector = sectors.find(s =>
      row >= s.rowStart &&
      row <= s.rowEnd &&
      column >= s.colStart &&
      column <= s.colEnd
    )
    return sector?.color || designColor.neutral200
  }

  const getSeatStatus = (row: number, column: number) => {
    const isAisle = config.aisleConfig.some(([r, c]) => r === row && c === column)
    if (isAisle) return 'aisle'
    return 'seat'
  }

  const renderSeatGrid = () => {
    const grid = []
    for (let row = 0; row < config.rows; row++) {
      const rowSeats = []
      for (let col = 0; col < config.columns; col++) {
        const status = getSeatStatus(row, col)
        const seatId = `${row}-${col}`

        if (status === 'aisle') {
          rowSeats.push(
            <div key={seatId} className="w-8 h-8" aria-hidden="true" aria-label="Corredor" />
          )
        } else {
          const isSelected = selectedSeats.has(seatId)
          const color = getSeatColor(row, col)
          const rowLabel = String.fromCharCode(65 + row)
          const seatLabel = `Assento ${rowLabel}${col + 1}`
          const sector = sectors.find(s =>
            row >= s.rowStart &&
            row <= s.rowEnd &&
            col >= s.colStart &&
            col <= s.colEnd
          )
          const isInteractive = mode !== 'view'

          rowSeats.push(
            <button
              key={seatId}
              id={`seat-${row}-${col}`}
              type="button"
              onClick={() => handleToggleSeat(seatId)}
              onKeyDown={(e) => handleKeyDown(e, row, col)}
              disabled={!isInteractive}
              className={`
                w-8 h-8 rounded-sm flex items-center justify-center text-xs
                transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                ${isSelected ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
                ${isInteractive ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                ${!isInteractive && mode === 'view' ? 'opacity-70' : ''}
              `}
              style={{ backgroundColor: isSelected ? designColor.primary400 : color }}
              aria-label={`${seatLabel}${sector ? `, Setor: ${sector.name}, Preço: R$ ${sector.price.toFixed(2)}` : ', sem setor'}${isSelected ? ', selecionado' : ''}${!isInteractive ? ', visualização apenas' : ''}`}
              aria-pressed={isSelected}
              aria-disabled={!isInteractive}
              role={isInteractive ? 'button' : 'img'}
            >
              <span className="sr-only">{seatLabel}</span>
              <span aria-hidden="true">{col + 1}</span>
            </button>
          )
        }
      }
      grid.push(
        <div key={row} className="flex items-center justify-center gap-4 mb-4" role="row">
          <div className="w-6 h-8 flex items-center justify-center text-xs font-bold text-neutral-600" aria-label={`Fileira ${String.fromCharCode(65 + row)}`}>
            {String.fromCharCode(65 + row)}
          </div>
          <div role="rowgroup" className="contents">
            {rowSeats}
          </div>
          <div className="w-6 h-8 flex items-center justify-center text-xs font-bold text-neutral-600" aria-hidden="true">
            {String.fromCharCode(65 + row)}
          </div>
        </div>
      )
    }
    return grid
  }

  const renderColumnLabels = () => {
    const labels = []
    for (let col = 0; col < config.columns; col++) {
      labels.push(
        <div key={col} className="w-8 h-6 flex items-center justify-center text-xs text-neutral-600" aria-label={`Coluna ${col + 1}`}>
          {col + 1}
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center gap-4 mb-4 ml-8 mr-8" role="row" aria-label="Números das colunas">
        {labels}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          {seatMapId ? 'Editar' : 'Criar'} Mapa de Assento
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-4 rounded-lg mb-8">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-lg p-8 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Configuração do Mapa
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Nome do Mapa
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Fileiras (Rows)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.rows}
                    onChange={(e) => setConfig({ ...config, rows: parseInt(e.target.value) })}
                    className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Colunas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.columns}
                    onChange={(e) => setConfig({ ...config, columns: parseInt(e.target.value) })}
                    className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="mb-4" role="group" aria-label="Seletor de modo de edição">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Modo de Edição
                </label>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('view')
                      setSelectedSeats(new Set())
                    }}
                    className={`px-4 py-4 rounded-lg text-sm font-medium transition-colors ${
                      mode === 'view'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                    aria-pressed={mode === 'view'}
                  >
                    👁️ Visualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('edit-sector')
                      setSelectedSeats(new Set())
                    }}
                    className={`px-4 py-4 rounded-lg text-sm font-medium transition-colors ${
                      mode === 'edit-sector'
                        ? 'bg-primary-600 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                    aria-pressed={mode === 'edit-sector'}
                  >
                    🎨 Criar Setor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('add-aisle')
                      setSelectedSeats(new Set())
                    }}
                    className={`px-4 py-4 rounded-lg text-sm font-medium transition-colors ${
                      mode === 'add-aisle'
                        ? 'bg-amber-600 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                    aria-pressed={mode === 'add-aisle'}
                  >
                    ➕ Adicionar Corredor
                  </button>
                </div>
                <p className="text-sm text-neutral-600 mt-4">
                  {mode === 'view' && 'Clique em assentos para visualizar detalhes (modo de visualização)'}
                  {mode === 'edit-sector' && 'Selecione assentos para criar um setor com preço'}
                  {mode === 'add-aisle' && 'Selecione assentos para transformar em corredor (espaço vazio)'}
                </p>
              </div>

              {/* Sector Creation Form */}
              {mode === 'edit-sector' && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4" role="region" aria-label="Formulário de criação de setor">
                  <h3 className="text-sm font-medium text-primary-900 mb-4">
                    Criar Novo Setor
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="sectorName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Setor
                      </label>
                      <input
                        id="sectorName"
                        type="text"
                        value={newSector.name}
                        onChange={(e) => setNewSector({ ...newSector, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ex: Plateia, Camarote, Balcão"
                        aria-describedby="sectorNameHint"
                      />
                      <p id="sectorNameHint" className="text-sm text-gray-500 mt-4">
                        Um nome descritivo para este setor
                      </p>
                    </div>
                    <div>
                      <label htmlFor="sectorPrice" className="block text-sm font-medium text-gray-700 mb-1">
                        Preço (R$)
                      </label>
                      <input
                        id="sectorPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newSector.price}
                        onChange={(e) => setNewSector({ ...newSector, price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="0.00"
                        aria-describedby="sectorPriceHint"
                      />
                      <p id="sectorPriceHint" className="text-sm text-gray-500 mt-4">
                        Preço do ingresso para este setor
                      </p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="sectorColor" className="block text-sm font-medium text-gray-700 mb-1">
                      Cor do Setor
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        id="sectorColor"
                        type="color"
                        value={newSector.color}
                        onChange={(e) => setNewSector({ ...newSector, color: e.target.value })}
                        className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                      <span className="text-sm text-gray-600" aria-live="polite">
                        Cor selecionada: {newSector.color}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleCreateSector}
                      disabled={selectedSeats.size === 0 || !newSector.name || newSector.price <= 0}
                      className="px-4 py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      aria-describedby="createSectorHint"
                    >
                      Criar Setor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('view')
                        setSelectedSeats(new Set())
                      }}
                      className="px-4 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancelar
                    </button>
                  </div>
                  <p id="createSectorHint" className="text-sm text-primary-700 mt-4" aria-live="polite">
                    {selectedSeats.size === 0
                      ? 'Selecione pelo menos um assento no mapa acima para criar o setor'
                      : `${selectedSeats.size} assento(s) selecionado(s)`}
                  </p>
                </div>
              )}

              {/* Aisle Creation Form */}
              {mode === 'add-aisle' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4" role="region" aria-label="Formulário de criação de corredor">
                  <h3 className="text-sm font-medium text-amber-900 mb-4">
                    Adicionar Corredor
                  </h3>
                  <p className="text-sm text-amber-800 mb-4">
                    Corredores são espaços vazios entre fileiras para facilitar a circulação.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      // Convert selected seats to aisle
                      const newAisles = [...config.aisleConfig]
                      selectedSeats.forEach(seatId => {
                        const [row, col] = seatId.split('-').map(Number)
                        if (!newAisles.some(([r, c]) => r === row && c === col)) {
                          newAisles.push([row, col])
                        }
                      })
                      setConfig({ ...config, aisleConfig: newAisles })
                      setSelectedSeats(new Set())
                    }}
                    disabled={selectedSeats.size === 0}
                    className="px-4 py-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed mr-4"
                  >
                    Adicionar Corredor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('view')
                      setSelectedSeats(new Set())
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <p className="text-sm text-amber-700 mt-4" aria-live="polite">
                    {selectedSeats.size === 0
                      ? 'Selecione assentos no mapa acima para transformar em corredor'
                      : `${selectedSeats.size} assento(s) serão transformados em corredor`}
                  </p>
                </div>
              )}

              <div className="flex justify-center">
                <div className="bg-neutral-100 rounded-lg p-4 md:p-6 w-full overflow-x-auto">
                  <div className="min-w-max mx-auto" role="region" aria-label="Mapa de assentos interativo">
                    <h3 className="text-sm font-medium text-neutral-900 mb-4 text-center">
                      Mapa de Assentos
                    </h3>
                    {renderColumnLabels()}
                    <div className="flex flex-col items-center" role="grid" aria-label="Grade de assentos">
                      {renderSeatGrid()}
                    </div>
                  </div>
                </div>
                <p className="md:hidden text-xs text-neutral-600 absolute bottom-4 left-4 right-4 text-center bg-white/90 backdrop-blur py-2 px-4 rounded-lg shadow">
                  Deslize para ver mais assentos →
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gray-50 rounded-lg p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Setores ({sectors.length})
              </h3>

              {sectors.length === 0 ? (
                <p className="text-gray-500 text-sm mb-8">
                  Nenhum setor criado
                </p>
              ) : (
                <div className="space-y-4">
                  {sectors.map(sector => (
                    <div
                      key={sector.id}
                      className="bg-white rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-[1rem] h-[1rem] rounded"
                            style={{ backgroundColor: sector.color }}
                          />
                          <span className="font-medium text-gray-900">
                            {sector.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSector(sector.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remover
                        </button>
                      </div>
                      <div className="text-sm text-gray-600">
                        Preço: R$ {sector.price.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Fileiras {String.fromCharCode(65 + sector.rowStart)}-{String.fromCharCode(65 + sector.rowEnd)},
                        Colunas {sector.colStart + 1}-{sector.colEnd + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-6 border-t">
                <div className="text-sm text-gray-600 mb-4">
                  Total de assentos: {config.rows * config.columns - config.aisleConfig.length}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleCreateSeatMap}
                disabled={loading}
                className="flex-1 py-4 px-4 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Salvando...' : seatMapId ? 'Atualizar' : 'Criar Mapa'}
              </button>
              <button
                onClick={() => router.back()}
                className="flex-1 py-4 px-4 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
