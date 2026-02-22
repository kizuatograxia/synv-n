'use client'

import { memo } from 'react'
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { colors } from '@/lib/colors'

interface AdminTrendsChartProps {
  data: Array<{
    date: string
    revenue: number
    orders: number
    tickets: number
  }>
  formatDate: (dateString: string) => string
  CustomTooltip: ({ active, payload, label }: any) => React.ReactNode
}

export const AdminTrendsChart = memo(function AdminTrendsChart({
  data,
  formatDate,
  CustomTooltip
}: AdminTrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        aria-label="Gráfico de linhas mostrando tendências de pedidos e ingressos"
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
        <Line
          type="monotone"
          dataKey="orders"
          stroke={colors.secondary[500]}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Pedidos"
        />
        <Line
          type="monotone"
          dataKey="tickets"
          stroke={colors.success[500]}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Ingressos"
        />
      </LineChart>
    </ResponsiveContainer>
  )
})
