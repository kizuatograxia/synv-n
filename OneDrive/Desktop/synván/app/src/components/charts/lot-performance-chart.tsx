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

interface LotPerformanceChartProps {
  data: Array<{
    name: string
    vendidos: number
    disponiveis: number
    receita: number
  }>
  colors: string[]
}

export const LotPerformanceChart = memo(function LotPerformanceChart({
  data,
  colors
}: LotPerformanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        aria-label="Gráfico de performance por lote mostrando ingressos vendidos e disponíveis"
        role="img"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#78716c' }} interval="preserveStartEnd" axisLine={{ stroke: '#d6d3d1' }} tickLine={{ stroke: '#d6d3d1' }} />
        <YAxis tick={{ fontSize: 12, fill: '#78716c' }} axisLine={{ stroke: '#d6d3d1' }} tickLine={{ stroke: '#d6d3d1' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.08)',
            padding: '12px 16px',
          }}
        />
        <Legend />
        <Bar dataKey="vendidos" fill={colors[0]} name="Vendidos" radius={[4, 4, 0, 0]} />
        <Bar dataKey="disponiveis" fill={colors[2]} name="Disponíveis" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})
