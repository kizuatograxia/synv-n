'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Ticket, Clock, CheckCircle } from 'lucide-react'

interface RealTimeStats {
  activeTicketsSold: number
  todayRevenue: number
  pendingOrders: number
  approvedOrders: number
}

interface RealTimeStatsCardProps {
  realTimeStats: RealTimeStats
  formatCurrency: (value: number) => string
}

export function RealTimeStatsCard({ realTimeStats, formatCurrency }: RealTimeStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg font-display">Tempo Real</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-neutral-50/80 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <Ticket className="w-[1rem] h-[1rem] text-primary-600" />
            </div>
            <span className="text-sm md:text-base text-neutral-600">Ingressos Hoje</span>
          </div>
          <span className="font-display font-bold text-neutral-900 text-sm md:text-base">
            {realTimeStats.activeTicketsSold}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-neutral-50/80 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center">
              <DollarSign className="w-[1rem] h-[1rem] text-success-600" />
            </div>
            <span className="text-sm md:text-base text-neutral-600">Receita Hoje</span>
          </div>
          <span className="font-display font-bold text-neutral-900 text-sm md:text-base">
            {formatCurrency(realTimeStats.todayRevenue)}
          </span>
        </div>
        <div className={`flex items-center justify-between p-3 rounded-xl ${realTimeStats.pendingOrders > 0 ? 'bg-warning-50 border border-warning-200' : 'bg-neutral-50/80'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${realTimeStats.pendingOrders > 0 ? 'bg-warning-100' : 'bg-neutral-100'}`}>
              <Clock className={`w-[1rem] h-[1rem] ${realTimeStats.pendingOrders > 0 ? 'text-warning-600' : 'text-neutral-500'}`} />
            </div>
            <span className="text-sm md:text-base text-neutral-600">Pedidos Pendentes</span>
          </div>
          <span className="font-display font-bold text-neutral-900 text-sm md:text-base">
            {realTimeStats.pendingOrders}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 bg-neutral-50/80 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center">
              <CheckCircle className="w-[1rem] h-[1rem] text-success-600" />
            </div>
            <span className="text-sm md:text-base text-neutral-600">Pedidos Aprovados</span>
          </div>
          <span className="font-display font-bold text-neutral-900 text-sm md:text-base">
            {realTimeStats.approvedOrders}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
