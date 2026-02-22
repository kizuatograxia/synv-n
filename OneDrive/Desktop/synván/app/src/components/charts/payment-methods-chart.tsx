'use client'

import { memo } from 'react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface PaymentMethodsChartProps {
  data: Array<{
    name: string
    value: number
  }>
  colors: string[]
}

export const PaymentMethodsChart = memo(function PaymentMethodsChart({
  data,
  colors
}: PaymentMethodsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        aria-label="Gráfico de barras horizontal mostrando métodos de pagamento"
        role="img"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis type="number" tick={{ fontSize: 12, fill: '#78716c' }} axisLine={{ stroke: '#d6d3d1' }} tickLine={{ stroke: '#d6d3d1' }} />
        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: '#78716c' }} axisLine={{ stroke: '#d6d3d1' }} tickLine={{ stroke: '#d6d3d1' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.08)',
            padding: '12px 16px',
          }}
        />
        <Bar dataKey="value" fill={colors[0]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})
