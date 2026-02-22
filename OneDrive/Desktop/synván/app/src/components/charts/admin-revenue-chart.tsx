'use client'

import { memo } from 'react'
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { colors } from '@/lib/colors'

interface AdminRevenueChartProps {
  data: Array<{
    date: string
    revenue: number
    orders: number
    tickets: number
  }>
  formatDate: (dateString: string) => string
  formatCurrency: (value: number) => string
  CustomTooltip: ({ active, payload, label }: any) => React.ReactNode
}

export const AdminRevenueChart = memo(function AdminRevenueChart({
  data,
  formatDate,
  formatCurrency,
  CustomTooltip
}: AdminRevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        aria-label="Gráfico de área mostrando receita ao longo do tempo"
        role="img"
      >
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary[500]} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={colors.primary[500]} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke={colors.neutral[500]}
          tick={{ fill: colors.neutral[500], fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(value) => `R$ ${value / 1000}k`}
          stroke={colors.neutral[500]}
          tick={{ fill: colors.neutral[500], fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={colors.primary[500]}
          fillOpacity={1}
          fill="url(#colorRevenue)"
          name="Receita"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})
