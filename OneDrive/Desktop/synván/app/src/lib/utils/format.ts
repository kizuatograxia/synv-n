/**
 * Format CPF string (11 digits) to Brazilian format: XXX.XXX.XXX-XX
 */
export function formatCPF(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')

  // Limit to 11 digits
  const limited = digits.slice(0, 11)

  // Apply format: XXX.XXX.XXX-XX
  if (limited.length <= 3) {
    return limited
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 3)}.${limited.slice(3)}`
  } else if (limited.length <= 9) {
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`
  } else {
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`
  }
}

/**
 * Strip CPF formatting, returning only digits
 */
export function stripCPF(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Format phone string to Brazilian format: (XX) XXXXX-XXXX
 */
export function formatPhone(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')

  // Limit to 11 digits (2 for area code + 9 for number)
  const limited = digits.slice(0, 11)

  // Apply format: (XX) XXXXX-XXXX
  if (limited.length <= 2) {
    return limited
  } else if (limited.length <= 7) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`
  } else {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`
  }
}

/**
 * Strip phone formatting, returning only digits
 */
export function stripPhone(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Format number as Brazilian Real currency: R$ 1.234,56
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Format date as Brazilian format: DD/MM/YYYY
 */
export function formatDate(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj)
}

/**
 * Format date and time as Brazilian format: DD/MM/YYYY HH:MM
 */
export function formatDateTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj)
}
