'use client'

import { forwardRef, useState } from 'react'
import { cn } from '@/lib/cn'

interface ToggleProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
  className?: string
  'aria-label'?: string
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onChange,
      disabled = false,
      label,
      description,
      className,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = useState(defaultChecked)
    const checked = controlledChecked !== undefined ? controlledChecked : internalChecked

    const handleChange = () => {
      if (disabled) return

      const newChecked = !checked
      if (controlledChecked === undefined) {
        setInternalChecked(newChecked)
      }
      onChange?.(newChecked)
    }

    const toggleId = `toggle-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className={cn('flex items-start gap-4', className)}>
        <button
          ref={ref}
          type="button"
          role="switch"
          id={toggleId}
          aria-checked={checked}
          aria-label={ariaLabel || label}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={handleChange}
          className={cn(
            // Base styles
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            // Colors based on state
            checked ? 'bg-primary-600' : 'bg-neutral-200',
            // Disabled state
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>

        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={toggleId}
                className={cn(
                  'text-sm font-medium text-neutral-900',
                  disabled && 'opacity-50'
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-neutral-600">{description}</p>
            )}
          </div>
        )}
      </div>
    )
  }
)

Toggle.displayName = 'Toggle'
