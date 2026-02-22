'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DailySalesChart } from '@/components/charts/daily-sales-chart'

interface DailySalesCardProps {
  salesChartData: Array<{
    date: string
    receita: number
    ingressos: number
  }>
  colors: string[]
  formatCurrency: (value: number) => string
}

export function DailySalesCard({ salesChartData, colors, formatCurrency }: DailySalesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg font-display">Vendas Diárias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 md:h-80">
          {salesChartData.length > 0 ? (
            <DailySalesChart data={salesChartData} colors={colors} formatCurrency={formatCurrency} />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-500">
              Sem dados disponíveis
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
