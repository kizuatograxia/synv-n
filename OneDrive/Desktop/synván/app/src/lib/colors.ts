/**
 * Design Token Color Mapping
 *
 * This file maps Tailwind design tokens to their hex values.
 * Use these constants instead of hardcoded hex colors to maintain
 * consistency with the design system defined in tailwind.config.ts
 *
 * Design Principle #7: "Semantic color — primary, secondary, success, warning, error, neutral (no raw hex)"
 */

export const colors = {
  // Primary (warm coral)
  primary: {
    50: '#fef3f1',
    100: '#fde4df',
    200: '#fccdc5',
    300: '#f9a999',
    400: '#f27d66',
    500: '#E8553A',
    600: '#d4402a',
    700: '#b2311f',
    800: '#932c1d',
    900: '#7a291e',
    950: '#42110b',
  },
  // Secondary (deep indigo)
  secondary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366F1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  // Success (green)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },
  // Warning (amber)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  // Error (red)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },
  // Neutral (warm stone grays)
  neutral: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
    950: '#0c0a09',
  },
} as const

// Shorthand aliases for commonly used shades
export const color = {
  primary500: colors.primary[500],
  primary400: colors.primary[400],
  secondary500: colors.secondary[500],
  success500: colors.success[500],
  warning400: colors.warning[400],
  error500: colors.error[500],
  neutral200: colors.neutral[200],
}

// Chart color palette for data visualization
export const chartColors = [
  colors.primary[500],  // warm coral
  colors.secondary[500], // deep indigo
  colors.success[500],  // green
  colors.warning[500],  // amber
  colors.error[500],    // red
] as const
