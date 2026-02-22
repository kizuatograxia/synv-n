/**
 * Charts Module
 *
 * This module exports all Recharts components to enable code splitting.
 * By importing all chart components in a single module, Next.js can create
 * a separate chunk that's loaded on-demand when dashboard pages are accessed.
 *
 * This reduces the initial bundle size for non-dashboard pages.
 */

'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

// Export all components
export {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
}

// Re-export types if needed
export type { TooltipProps, LegendProps } from 'recharts'
