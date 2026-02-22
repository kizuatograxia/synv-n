'use client'

import { memo } from 'react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { colors } from '@/lib/colors'

interface AdminOrdersChartProps {
  data: Array<{
    date: string
    revenue: number
    orders: number
    tickets: number
  }>
  formatDate: (dateString: string) => string
  CustomTooltip: ({ active, payload, label }: any) => React.ReactNode
}

export const AdminOrdersChart = memo(function AdminOrdersChart({
  data,
  formatDate,
  CustomTooltip
}: AdminOrdersChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        aria-label="Gráfico de barras mostrando pedidos e ingressos ao longo do tempo"
        role="img"
      >
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke={colors.neutral[500]}
          tick={{ fill: colors.neutral[500], fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis stroke={colors.neutral[500]} tick={{ fill: colors.neutral[500], fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="orders" fill={colors.secondary[500]} name="Pedidos" radius={[4, 4, 0, 0]} />
        <Bar dataKey="tickets" fill={colors.success[500]} name="Ingressos" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})
