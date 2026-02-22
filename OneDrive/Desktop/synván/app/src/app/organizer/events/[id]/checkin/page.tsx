'use client'

import { useState, useRef, useEffect } from 'react'
import * as QrScannerModule from 'react-qr-scanner'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useToast } from '@/hooks/useToast'
import { useServiceWorker, useOfflineCheckin } from '@/hooks/useServiceWorker'
const QrReader = (QrScannerModule as any).default || QrScannerModule

interface ValidationResult {
  valid: boolean
  ticket?: {
    id: string
    code: string
    type: string
    price: number
    isUsed: boolean
    lot: {
      name: string
    }
  }
  attendee?: {
    name: string
    email: string
  }
  error?: string
}

interface OfflineCheckinRecord {
  ticketId: string
  eventId: string
  checkedInAt: number
  synced: boolean
  attendeeName?: string
  ticketCode?: string
}

interface CheckinHistory {
  id: string
  ticketCode: string
  attendeeName: string
  checkedInAt: Date
  lotName: string
  ticketType: string
}

interface EventStats {
  totalExpected: number
  lots: Array<{
    id: string
    name: string
    totalQuantity: number
    availableQuantity: number
  }>
}

export default function CheckinPage({ params }: { params: { id: string } }) {
  const toast = useToast()
  const { registration: swRegistration } = useServiceWorker()
  const { online, offlineQueue, addOfflineCheckin, syncOfflineCheckins, getOfflineCheckin } = useOfflineCheckin()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [keepScannerOpen, setKeepScannerOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastScannedData, setLastScannedData] = useState<string | null>(null)
  const [scanCooldown, setScanCooldown] = useState(false)
  const [checkinCount, setCheckinCount] = useState(0)
  const [checkinHistory, setCheckinHistory] = useState<CheckinHistory[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [eventStats, setEventStats] = useState<EventStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Log Service Worker registration
  useEffect(() => {
    if (swRegistration) {
      console.log('[Check-in] Service Worker registered for offline support')
    }
  }, [swRegistration])

  const handleScan = async (data: string | null) => {
    if (!data || scanCooldown) return

    // Prevent duplicate scans of the same QR code within 2 seconds
    if (data === lastScannedData) {
      return
    }

    setLastScannedData(data)
    setScanCooldown(true)
    setValidationResult(null)
    setLoading(true)

    try {
      // Parse QR data to get ticket ID
      let ticketId = ''
      try {
        const qrData = JSON.parse(data)
        ticketId = qrData.ticketId || ''
      } catch {
        // If not JSON, the data itself might be the ticket ID
        ticketId = data
      }

      // Check if ticket was already checked in offline (conflict detection)
      if (ticketId) {
        const offlineCheckin = await getOfflineCheckin(ticketId)
        if (offlineCheckin) {
          setValidationResult({
            valid: false,
            error: `Ingresso já checkado ${offlineCheckin.synced ? 'online' : 'offline'} às ${new Date(offlineCheckin.checkedInAt).toLocaleTimeString('pt-BR')}`,
          })
          setLoading(false)
          setTimeout(() => {
            setScanCooldown(false)
            setLastScannedData(null)
          }, 2000)
          return
        }
      }

      const response = await fetch('/api/checkin/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData: data,
          eventId: params.id,
        }),
      })

      const result: ValidationResult = await response.json()
      setValidationResult(result)

      if (result.valid && result.ticket) {
        await performCheckin(result.ticket.id, result.attendee?.name, result.ticket.code)
      }

      // Auto-dismiss result after 2 seconds for rapid scanning (only if keepScannerOpen is true)
      if (keepScannerOpen) {
        setTimeout(() => {
          setValidationResult(null)
        }, 2000)
      } else {
        // Close scanner after successful scan if not in continuous mode
        if (result.valid) {
          setScannerOpen(false)
        }
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        error: 'Erro ao validar ingresso',
      })

      // Keep error visible longer
      setTimeout(() => {
        setValidationResult(null)
      }, 3000)
    } finally {
      setLoading(false)

      // Clear cooldown after 2 seconds to allow same ticket to be scanned again
      setTimeout(() => {
        setScanCooldown(false)
        setLastScannedData(null)
      }, 2000)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setValidationResult(null)
    setLoading(true)

    try {
      // Check if ticket was already checked in offline (conflict detection)
      const offlineCheckin = await getOfflineCheckin(searchQuery)
      if (offlineCheckin) {
        setValidationResult({
          valid: false,
          error: `Ingresso já checkado ${offlineCheckin.synced ? 'online' : 'offline'} às ${new Date(offlineCheckin.checkedInAt).toLocaleTimeString('pt-BR')}`,
        })
        setLoading(false)
        return
      }

      const response = await fetch('/api/checkin/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData: JSON.stringify({
            ticketId: searchQuery,
            eventId: params.id,
            userId: '',
            timestamp: Date.now(),
            signature: '',
          }),
          eventId: params.id,
        }),
      })

      const result: ValidationResult = await response.json()
      setValidationResult(result)

      if (result.valid && result.ticket) {
        await performCheckin(result.ticket.id, result.attendee?.name, result.ticket.code)
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        error: 'Erro ao validar ingresso',
      })
    } finally {
      setLoading(false)
    }
  }

  const playSuccessSound = () => {
    if (!soundEnabled) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const performCheckin = async (ticketId: string, attendeeName?: string, ticketCode?: string) => {
    if (!online) {
      // Use IndexedDB-based offline queue
      const offlineRecord = {
        ticketId,
        eventId: params.id,
        ticketCode: ticketCode || '',
        attendeeName: attendeeName || '',
        checkedInAt: Date.now(),
        synced: false,
      }
      addOfflineCheckin(offlineRecord)
      setCheckinCount(prev => prev + 1)

      // Add to history
      if (attendeeName && ticketCode) {
        const historyItem: CheckinHistory = {
          id: crypto.randomUUID(),
          ticketCode,
          attendeeName,
          checkedInAt: new Date(),
          lotName: validationResult?.ticket?.lot?.name || 'N/A',
          ticketType: validationResult?.ticket?.type || 'GENERAL',
        }
        setCheckinHistory(prev => [historyItem, ...prev])
      }

      playSuccessSound()

      setValidationResult(prev => prev ? {
        ...prev,
        valid: true,
        error: 'Check-in realizado offline. Será sincronizado quando a conexão for restaurada.',
      } : null)
      return
    }

    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId,
          eventId: params.id,
        }),
      })

      if (response.ok) {
        setCheckinCount(prev => prev + 1)
        playSuccessSound()
        toast.success('Check-in realizado com sucesso!')

        // Add to history
        if (attendeeName && ticketCode) {
          const historyItem: CheckinHistory = {
            id: crypto.randomUUID(),
            ticketCode,
            attendeeName,
            checkedInAt: new Date(),
            lotName: validationResult?.ticket?.lot?.name || 'N/A',
            ticketType: validationResult?.ticket?.type || 'GENERAL',
          }
          setCheckinHistory(prev => [historyItem, ...prev])
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao realizar check-in')
        setValidationResult(prev => prev ? {
          ...prev,
          valid: false,
          error: error.error || 'Erro ao realizar check-in',
        } : null)
      }
    } catch (error) {
      toast.error('Erro ao realizar check-in')
      setValidationResult(prev => prev ? {
        ...prev,
        valid: false,
        error: 'Erro ao realizar check-in',
      } : null)
    }
  }

  const handleSyncOffline = async () => {
    if (!online || offlineQueue.length === 0) return

    setLoading(true)
    await syncOfflineCheckins()
    setLoading(false)
  }

  // Fetch event statistics (total expected tickets from lots)
  useEffect(() => {
    const fetchEventStats = async () => {
      try {
        const response = await fetch(`/api/events/${params.id}`)
        const data = await response.json()

        if (response.ok && data.event) {
          // Calculate total expected tickets from all lots
          const totalExpected = data.event.lots?.reduce((sum: number, lot: any) => {
            return sum + (lot.totalQuantity || 0)
          }, 0) || 0

          setEventStats({
            totalExpected,
            lots: data.event.lots || []
          })
        }
      } catch (error) {
        console.error('Error fetching event stats:', error)
      } finally {
        setLoadingStats(false)
      }
    }

    fetchEventStats()
  }, [params.id])

  return (
    <OrganizerAppShell>
      <main className="max-w-2xl mx-auto">
        <PageHeader
          title="Check-in"
          subtitle="Escaneie códigos QR ou busque por nome/código"
          breadcrumbs={[
            { label: 'Dashboard', href: '/organizer/dashboard' },
            { label: 'Eventos', href: '/organizer/events' },
            { label: 'Check-in' },
          ]}
          actions={
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    'p-4 rounded-xl transition-colors',
                    soundEnabled
                      ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  )}
                  aria-label={soundEnabled ? 'Desativar som' : 'Ativar som'}
                  title={soundEnabled ? 'Som ativado' : 'Som desativado'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {soundEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    )}
                    {!soundEnabled && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    )}
                  </svg>
                </button>
                <Badge variant={online ? 'success' : 'error'}>
                  {online ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {!loadingStats && eventStats && (
                  <>
                    <div className="flex items-center gap-4">
                      <span className="text-neutral-600">Check-ins:</span>
                      <span className="font-semibold text-success-600">{checkinCount}</span>
                    </div>
                    <div className="w-px h-4 bg-neutral-300" aria-hidden="true" />
                    <div className="flex items-center gap-4">
                      <span className="text-neutral-600">Restantes:</span>
                      <span className="font-semibold text-neutral-900">
                        {Math.max(0, eventStats.totalExpected - checkinCount)}
                      </span>
                    </div>
                    <div className="w-px h-4 bg-neutral-300" aria-hidden="true" />
                    <div className="flex items-center gap-4">
                      <span className="text-neutral-600">Total:</span>
                      <span className="font-semibold text-neutral-900">{eventStats.totalExpected}</span>
                    </div>
                  </>
                )}
                {loadingStats && (
                  <span className="text-neutral-600">Carregando estatísticas...</span>
                )}
              </div>
            </div>
          }
        />

        <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-shadow p-8 mb-8">

          {offlineQueue.length > 0 && (
            <div className="mb-4 p-4 bg-warning-50 border border-warning-200 rounded-xl" role="alert" aria-live="polite">
              <div className="flex items-center justify-between">
                <span className="text-sm text-warning-800">
                  {offlineQueue.length} check-in{offlineQueue.length > 1 ? 's' : ''} pendente{offlineQueue.length > 1 ? 's' : ''} de sincronização
                  {!online && ' (conexão offline - será sincronizado automaticamente)'}
                </span>
                {online && (
                  <Button
                    onClick={handleSyncOffline}
                    disabled={loading}
                    size="sm"
                  >
                    Sincronizar
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <Button
              onClick={() => setScannerOpen(!scannerOpen)}
              variant="gradient"
              className="w-full"
            >
              <svg className="w-5 h-5 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              {scannerOpen ? 'Fechar Scanner' : 'Escanear QR Code'}
            </Button>

            <div className="flex gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar por código ou nome..."
                className="flex-1 px-4 py-4 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Buscar participante"
              />
              <Button
                onClick={handleSearch}
                disabled={loading}
                variant="secondary"
              >
                Buscar
              </Button>
            </div>

            {/* Continuous scan toggle */}
            <label className="flex items-center gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={keepScannerOpen}
                onChange={(e) => setKeepScannerOpen(e.target.checked)}
                className="w-[1rem] h-[1rem] text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                aria-label="Manter scanner aberto para escaneamento contínuo"
              />
              <span className="text-sm text-neutral-700">
                Modo escaneamento contínuo (recomendado para check-in rápido)
              </span>
            </label>
          </div>

          {scannerOpen && (
            <div className="mt-8 space-y-4">
              {/* Scanner status indicator */}
              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl text-sm",
                scanCooldown ? "bg-warning-50 text-warning-800" : "bg-success-50 text-success-800"
              )} role="status" aria-live="polite">
                <div className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  scanCooldown ? "bg-warning-500" : "bg-success-500"
                )} aria-hidden="true" />
                <span>
                  {scanCooldown ? 'Aguardando próximo scan...' : 'Pronto para escanear'}
                </span>
              </div>

              <QrReader
                onScan={handleScan}
                constraints={{ facingMode: 'environment' }}
              />
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-card p-8 mb-8">
            <div className="flex items-center justify-center" role="status" aria-live="polite">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-4 text-neutral-600">Processando...</span>
            </div>
          </div>
        )}

        {validationResult && (
          <div
            className={cn(
              'bg-white rounded-2xl shadow-card border p-8 mb-8',
              validationResult.valid ? 'border-l-4 border-success-500' : 'border-l-4 border-error-500'
            )}
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                validationResult.valid ? 'bg-success-100' : 'bg-error-100'
              }`}>
                {validationResult.valid ? (
                  <svg className="w-6 h-6 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="ml-4 flex-1">
                <h3 className={cn(
                  'text-lg font-display font-bold',
                  validationResult.valid ? 'text-success-900' : 'text-error-900'
                )}>
                  {validationResult.valid ? 'Check-in realizado' : 'Erro no check-in'}
                </h3>
                {validationResult.error && (
                  <p className={`mt-4 text-sm ${
                    validationResult.valid ? 'text-success-700' : 'text-error-700'
                  }`}>
                    {validationResult.error}
                  </p>
                )}
                {validationResult.ticket && (
                  <div className="mt-4 p-4 bg-neutral-50 rounded-xl">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-neutral-600">Código:</span>
                        <span className="ml-4 text-neutral-900">{validationResult.ticket.code}</span>
                      </div>
                      <div>
                        <span className="font-medium text-neutral-600">Tipo:</span>
                        <span className="ml-4">{validationResult.ticket.type}</span>
                      </div>
                      <div>
                        <span className="font-medium text-neutral-600">Lote:</span>
                        <span className="ml-4 text-neutral-900">{validationResult.ticket.lot.name}</span>
                      </div>
                      <div>
                        <span className="font-medium text-neutral-600">Valor:</span>
                        <span className="ml-4 text-neutral-900">
                          R$ {validationResult.ticket.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {validationResult.attendee && (
                      <div className="mt-4 pt-4 border-t border-neutral-200">
                        <span className="font-medium text-neutral-600">Participante:</span>
                        <span className="ml-4 text-neutral-900">
                          {validationResult.attendee.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Check-in History */}
        {checkinHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-shadow border border-neutral-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-neutral-900">
                Histórico de Check-ins
              </h2>
              <Badge variant="info">{checkinHistory.length} registros</Badge>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {checkinHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 truncate">
                        {item.attendeeName}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-4 mt-4 text-sm text-neutral-600">
                        <span className="font-mono text-xs">{item.ticketCode}</span>
                        <span>{item.lotName}</span>
                        <Badge variant="neutral" size="sm">{item.ticketType}</Badge>
                      </div>
                    </div>
                    <div className="text-right text-sm text-neutral-600">
                      {new Date(item.checkedInAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </OrganizerAppShell>
  )
}
