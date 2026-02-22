'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LotPerformanceChart } from '@/components/charts/lot-performance-chart'

interface LotPerformance {
  lotId: string
  lotName: string
  price: number
  totalTickets: number
  soldTickets: number
  availableTickets: number
  revenue: number
  sellRate: number
}

interface LotPerformanceCardProps {
  lotPerformance: LotPerformance[]
  colors: string[]
  formatCurrency: (value: number) => string
}

export function LotPerformanceCard({ lotPerformance, colors, formatCurrency }: LotPerformanceCardProps) {
  const lotPerformanceChartData = lotPerformance.map(lot => ({
    name: lot.lotName,
    vendidos: lot.soldTickets,
    disponiveis: lot.availableTickets,
    receita: lot.revenue
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg font-display">Performance por Lote</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <LotPerformanceChart data={lotPerformanceChartData} colors={colors} />
        </div>
        <div className="mt-4 space-y-4">
          {lotPerformance.map((lot) => (
            <div key={lot.lotId} className="flex items-center justify-between p-3 bg-neutral-50/80 rounded-xl text-sm md:text-base">
              <div className="flex-1 min-w-0">
                <div className="font-display font-medium text-neutral-900 truncate">{lot.lotName}</div>
                <div className="text-neutral-500">
                  {lot.soldTickets}/{lot.totalTickets} vendidos · {formatCurrency(lot.price)}
                </div>
              </div>
              <div className="text-right ml-2 flex-shrink-0">
                <div className="font-display font-bold text-success-600">{formatCurrency(lot.revenue)}</div>
                <div className="text-neutral-500">{lot.sellRate.toFixed(1)}% taxa</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
