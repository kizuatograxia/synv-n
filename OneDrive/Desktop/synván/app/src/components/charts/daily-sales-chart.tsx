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

interface DailySalesChartProps {
  data: Array<{
    date: string
    receita: number
    ingressos: number
  }>
  colors: string[]
  formatCurrency: (value: number) => string
}

export const DailySalesChart = memo(function DailySalesChart({
  data,
  colors,
  formatCurrency
}: DailySalesChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        aria-label="Gráfico de vendas diárias mostrando receita e ingressos vendidos"
        role="img"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#78716c' }}
          interval="preserveStartEnd"
          axisLine={{ stroke: '#d6d3d1' }}
          tickLine={{ stroke: '#d6d3d1' }}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#78716c' }} axisLine={{ stroke: '#d6d3d1' }} tickLine={{ stroke: '#d6d3d1' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#78716c' }} axisLine={{ stroke: '#d6d3d1' }} tickLine={{ stroke: '#d6d3d1' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.08)',
            padding: '12px 16px',
          }}
          formatter={(value: any, name: any) => [
            name === 'receita' ? formatCurrency(Number(value) || 0) : Number(value) || 0,
            name === 'receita' ? 'Receita' : 'Ingressos'
          ]}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="receita"
          stroke={colors[0]}
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 2 }}
          activeDot={{ r: 5, strokeWidth: 2 }}
          name="Receita"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ingressos"
          stroke={colors[1]}
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 2 }}
          activeDot={{ r: 5, strokeWidth: 2 }}
          name="Ingressos"
        />
      </LineChart>
    </ResponsiveContainer>
  )
})
