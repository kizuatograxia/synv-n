/**
 * Business Day Calculator for Brazilian Payout System
 *
 * Calculates business days excluding weekends and Brazilian national holidays.
 * This ensures compliance with VISION.md requirement: "Payouts transfer to organizers within 3 business days"
 *
 * Business days in Brazil are Monday-Friday (0-4 in JS Date).
 * Weekends (Saturday=5, Sunday=6) are excluded from calculations.
 *
 * Brazilian National Holidays (fixed dates):
 * - Jan 1: Ano Novo (New Year's Day)
 * - Apr 21: Tiradentes
 * - May 1: Dia do Trabalhador (Labor Day)
 * - Sep 7: Independência do Brasil (Independence Day)
 * - Oct 12: Nossa Senhora Aparecida (Patron Saint of Brazil)
 * - Nov 2: Finados (All Souls' Day)
 * - Nov 15: Proclamação da República (Republic Day)
 * - Dec 25: Natal (Christmas)
 *
 * Movable holidays (Catholic):
 * - Carnival: 47 days before Easter
 * - Good Friday: 2 days before Easter
 * - Corpus Christi: 60 days after Easter
 *
 * Note: This implementation uses a simplified holiday list with fixed dates only.
 * Movable holidays (Carnival, Easter, etc.) can be added as needed.
 */

export interface BusinessDayOptions {
  /** Custom holidays to exclude (format: 'MM-DD') */
  customHolidays?: string[]
  /** Year-specific holidays (format: 'YYYY-MM-DD') */
  yearSpecificHolidays?: string[]
}

/**
 * Brazilian national holidays (fixed dates, format: 'MM-DD')
 */
const BRAZILIAN_HOLIDAYS = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalhador
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
]

/**
 * Check if a date is a weekend day (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday (0) or Saturday (6)
}

/**
 * Check if a date is a Brazilian holiday
 */
export function isBrazilianHoliday(date: Date, options?: BusinessDayOptions): boolean {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const monthDay = `${month}-${day}`

  // Check fixed Brazilian holidays
  if (BRAZILIAN_HOLIDAYS.includes(monthDay)) {
    return true
  }

  // Check custom holidays
  if (options?.customHolidays?.includes(monthDay)) {
    return true
  }

  // Check year-specific holidays (format: 'YYYY-MM-DD')
  if (options?.yearSpecificHolidays) {
    const year = date.getFullYear()
    const fullDate = `${year}-${monthDay}`
    if (options.yearSpecificHolidays.includes(fullDate)) {
      return true
    }
  }

  return false
}

/**
 * Check if a date is a business day (not weekend, not holiday)
 */
export function isBusinessDay(date: Date, options?: BusinessDayOptions): boolean {
  return !isWeekend(date) && !isBrazilianHoliday(date, options)
}

/**
 * Add business days to a date
 * @param startDate - The starting date
 * @param businessDays - Number of business days to add (must be positive)
 * @param options - Optional holiday configuration
 * @returns The date after adding business days
 *
 * @example
 * // Monday + 3 business days = Thursday
 * addBusinessDays(new Date('2026-02-09'), 3) // 2026-02-12 (Thursday)
 *
 * // Friday + 3 business days = Wednesday
 * addBusinessDays(new Date('2026-02-13'), 3) // 2026-02-18 (Wednesday)
 *
 * // Saturday + 3 business days = Wednesday (treated as Monday request)
 * addBusinessDays(new Date('2026-02-14'), 3) // 2026-02-18 (Wednesday)
 */
export function addBusinessDays(
  startDate: Date,
  businessDays: number,
  options?: BusinessDayOptions
): Date {
  if (businessDays <= 0) {
    throw new Error('businessDays must be a positive number')
  }

  const result = new Date(startDate)

  // If start date is a weekend, move to next Monday
  if (isWeekend(result)) {
    const dayOfWeek = result.getDay()
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek // Sunday -> +1, Saturday -> +2
    result.setDate(result.getDate() + daysUntilMonday)
  }

  let daysAdded = 0

  // Add business days (start from the next day)
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1)

    // DEBUG
    if (process.env.DEBUG_BUSINESS_DAYS === 'true') {
      console.log('addBusinessDays loop:', result.toISOString(), 'getDay():', result.getDay(), 'isWeekend:', isWeekend(result), 'isBusinessDay:', isBusinessDay(result, options), 'daysAdded BEFORE:', daysAdded, 'businessDays target:', businessDays)
    }

    if (isBusinessDay(result, options)) {
      daysAdded++
      if (process.env.DEBUG_BUSINESS_DAYS === 'true') {
        console.log('  -> daysAdded AFTER:', daysAdded)
      }
    }
  }

  return result
}

/**
 * Calculate the number of business days between two dates
 * @param startDate - The start date
 * @param endDate - The end date
 * @param options - Optional holiday configuration
 * @returns Number of business days between the dates
 */
export function getBusinessDaysBetween(
  startDate: Date,
  endDate: Date,
  options?: BusinessDayOptions
): number {
  if (endDate <= startDate) {
    return 0
  }

  let businessDays = 0
  const current = new Date(startDate)

  while (current < endDate) {
    current.setDate(current.getDate() + 1)
    if (isBusinessDay(current, options)) {
      businessDays++
    }
  }

  return businessDays
}

/**
 * Get the next business day from a given date
 * @param date - The starting date
 * @param options - Optional holiday configuration
 * @returns The next business day
 */
export function getNextBusinessDay(date: Date, options?: BusinessDayOptions): Date {
  const result = new Date(date)

  do {
    result.setDate(result.getDate() + 1)
  } while (!isBusinessDay(result, options))

  return result
}
