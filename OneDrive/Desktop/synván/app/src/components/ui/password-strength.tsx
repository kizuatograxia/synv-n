'use client'

import React from 'react'
import { getPasswordStrength } from '@/lib/validations/auth'
import { cn } from '@/lib/cn'

export type PasswordStrengthProps = {
  password: string
  className?: string
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  className
}) => {
  const strength = getPasswordStrength(password)

  const getStrengthLabel = () => {
    if (!password) return ''
    if (strength === 0) return 'Fraca'
    if (strength === 1) return 'Média'
    return 'Forte'
  }

  const getStrengthColor = () => {
    if (!password) return 'bg-neutral-200'
    if (strength === 0) return 'bg-error-500'
    if (strength === 1) return 'bg-warning-600'
    return 'bg-success-500'
  }

  const getStrengthWidth = () => {
    if (!password) return '0%'
    if (strength === 0) return '33%'
    if (strength === 1) return '66%'
    return '100%'
  }

  return (
    <div className={cn('mt-2', className)}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-neutral-600">Força da senha</span>
        <span className={cn(
          'text-xs font-medium',
          strength === 0 ? 'text-error-600' :
          strength === 1 ? 'text-warning-600' :
          'text-success-600'
        )}>
          {getStrengthLabel()}
        </span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', getStrengthColor())}
          style={{ width: getStrengthWidth() }}
        />
      </div>
    </div>
  )
}
