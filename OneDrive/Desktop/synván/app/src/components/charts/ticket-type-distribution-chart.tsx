'use client'

import { memo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface TicketTypeDistributionChartProps {
  data: Array<{
    name: string
    value: number
  }>
  colors: string[]
}

export const TicketTypeDistributionChart = memo(function TicketTypeDistributionChart({
  data,
  colors
}: TicketTypeDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart aria-label="Gráfico de pizza mostrando distribuição por tipo de ingresso" role="img">
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={30}
          label={(entry) => `${entry.name}: ${entry.value}`}
          labelLine={false}
          strokeWidth={2}
          stroke="white"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.08)',
            padding: '12px 16px',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})
