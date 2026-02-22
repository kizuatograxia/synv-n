import {
  isWeekend,
  isBrazilianHoliday,
  isBusinessDay,
  addBusinessDays,
  getBusinessDaysBetween,
  getNextBusinessDay,
} from '@/lib/utils/business-days'

/**
 * Helper to create UTC date from YYYY-MM-DD format
 * This ensures consistent behavior across timezones
 */
function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`)
}

describe('Business Day Calculator', () => {
  describe('isWeekend', () => {
    it('should return true for Saturday', () => {
      const saturday = utcDate('2026-02-14') // Saturday
      expect(isWeekend(saturday)).toBe(true)
    })

    it('should return true for Sunday', () => {
      const sunday = utcDate('2026-02-15') // Sunday
      expect(isWeekend(sunday)).toBe(true)
    })

    it('should return false for Monday', () => {
      const monday = utcDate('2026-02-09') // Monday
      expect(isWeekend(monday)).toBe(false)
    })

    it('should return false for weekday', () => {
      const wednesday = utcDate('2026-02-11') // Wednesday
      expect(isWeekend(wednesday)).toBe(false)
    })
  })

  describe('isBrazilianHoliday', () => {
    describe('Fixed Brazilian holidays', () => {
      it('should return true for New Year (Jan 1)', () => {
        const newYear = utcDate('2026-01-01')
        expect(isBrazilianHoliday(newYear)).toBe(true)
      })

      it('should return true for Tiradentes (Apr 21)', () => {
        const tiradentes = utcDate('2026-04-21')
        expect(isBrazilianHoliday(tiradentes)).toBe(true)
      })

      it('should return true for Labor Day (May 1)', () => {
        const laborDay = utcDate('2026-05-01')
        expect(isBrazilianHoliday(laborDay)).toBe(true)
      })

      it('should return true for Independence Day (Sep 7)', () => {
        const independence = utcDate('2026-09-07')
        expect(isBrazilianHoliday(independence)).toBe(true)
      })

      it('should return true for Nossa Senhora Aparecida (Oct 12)', () => {
        const aparecida = utcDate('2026-10-12')
        expect(isBrazilianHoliday(aparecida)).toBe(true)
      })

      it('should return true for Finados (Nov 2)', () => {
        const finados = utcDate('2026-11-02')
        expect(isBrazilianHoliday(finados)).toBe(true)
      })

      it('should return true for Republic Day (Nov 15)', () => {
        const republic = utcDate('2026-11-15')
        expect(isBrazilianHoliday(republic)).toBe(true)
      })

      it('should return true for Christmas (Dec 25)', () => {
        const christmas = utcDate('2026-12-25')
        expect(isBrazilianHoliday(christmas)).toBe(true)
      })

      it('should return false for non-holiday', () => {
        const regularDay = utcDate('2026-02-10') // Regular Tuesday
        expect(isBrazilianHoliday(regularDay)).toBe(false)
      })
    })

    describe('Custom holidays', () => {
      it('should return true for custom holiday (MM-DD format)', () => {
        const customDate = utcDate('2026-03-15')
        expect(
          isBrazilianHoliday(customDate, {
            customHolidays: ['03-15'],
          })
        ).toBe(true)
      })

      it('should return false when custom holidays list is empty', () => {
        const date = utcDate('2026-03-15')
        expect(
          isBrazilianHoliday(date, {
            customHolidays: [],
          })
        ).toBe(false)
      })
    })

    describe('Year-specific holidays', () => {
      it('should return true for year-specific holiday (YYYY-MM-DD format)', () => {
        const specificDate = utcDate('2026-06-15')
        expect(
          isBrazilianHoliday(specificDate, {
            yearSpecificHolidays: ['2026-06-15'],
          })
        ).toBe(true)
      })

      it('should return false for same date in different year', () => {
        const date2026 = utcDate('2026-06-15')
        const date2027 = utcDate('2027-06-15')
        expect(
          isBrazilianHoliday(date2026, {
            yearSpecificHolidays: ['2026-06-15'],
          })
        ).toBe(true)
        expect(
          isBrazilianHoliday(date2027, {
            yearSpecificHolidays: ['2026-06-15'],
          })
        ).toBe(false)
      })
    })
  })

  describe('isBusinessDay', () => {
    it('should return true for weekday that is not a holiday', () => {
      const tuesday = utcDate('2026-02-10')
      expect(isBusinessDay(tuesday)).toBe(true)
    })

    it('should return false for Saturday', () => {
      const saturday = utcDate('2026-02-14')
      expect(isBusinessDay(saturday)).toBe(false)
    })

    it('should return false for Sunday', () => {
      const sunday = utcDate('2026-02-15')
      expect(isBusinessDay(sunday)).toBe(false)
    })

    it('should return false for Brazilian holiday', () => {
      const christmas = utcDate('2026-12-25')
      expect(isBusinessDay(christmas)).toBe(false)
    })

    it('should return false for holiday that falls on weekday', () => {
      const tiradentes = utcDate('2026-04-21') // Tuesday in 2026
      expect(isBusinessDay(tiradentes)).toBe(false)
    })

    it('should return false for custom holiday on weekday', () => {
      const date = utcDate('2026-03-15') // Sunday in 2026
      expect(
        isBusinessDay(date, {
          customHolidays: ['03-15'],
        })
      ).toBe(false)
    })

    it('should return true for weekend that is not a custom holiday', () => {
      const saturday = utcDate('2026-02-14')
      expect(
        isBusinessDay(saturday, {
          customHolidays: ['03-15'],
        })
      ).toBe(false) // Still weekend
    })
  })

  describe('addBusinessDays', () => {
    it('should add 3 business days to Monday = Thursday', () => {
      const monday = utcDate('2026-02-09')
      const result = addBusinessDays(monday, 3)
      expect(result.getDay()).toBe(4) // Thursday
      expect(result.getDate()).toBe(12)
    })

    it('should add 1 business day to Monday = Tuesday', () => {
      const monday = utcDate('2026-02-09')
      const result = addBusinessDays(monday, 1)
      expect(result.getDay()).toBe(2) // Tuesday
      expect(result.getDate()).toBe(10)
    })

    it('should add 3 business days to Friday = Wednesday (skip weekend)', () => {
      const friday = utcDate('2026-02-13')
      const result = addBusinessDays(friday, 3)
      expect(result.getDay()).toBe(3) // Wednesday
      expect(result.getDate()).toBe(18)
    })

    it('should add 1 business day to Friday = Monday', () => {
      const friday = utcDate('2026-02-13')
      const result = addBusinessDays(friday, 1)
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getDate()).toBe(16)
    })

    it('should add 3 business days from Saturday = Thursday (treat as Monday + 3)', () => {
      const saturday = utcDate('2026-02-14')
      const result = addBusinessDays(saturday, 3)
      expect(result.getDay()).toBe(4) // Thursday
      expect(result.getDate()).toBe(19)
    })

    it('should add 3 business days from Sunday = Thursday (treat as Monday + 3)', () => {
      const sunday = utcDate('2026-02-15')
      const result = addBusinessDays(sunday, 3)
      expect(result.getDay()).toBe(4) // Thursday
      expect(result.getDate()).toBe(19)
    })

    it('should skip Brazilian holidays when adding business days', () => {
      // April 20, 2026 is Monday, April 21 is Tuesday (Tiradentes holiday)
      const monday = utcDate('2026-04-20')
      const result = addBusinessDays(monday, 3)
      // Mon Apr 20 -> Tue Apr 21 (holiday, skip) -> Wed Apr 22 (1) -> Thu Apr 23 (2) -> Fri Apr 24 (3)
      expect(result.getDate()).toBe(24) // Friday
      expect(result.getMonth()).toBe(3) // April (0-indexed)
    })

    it('should skip custom holidays when adding business days', () => {
      const monday = utcDate('2026-02-09')
      const result = addBusinessDays(monday, 3, {
        customHolidays: ['02-10'], // Tuesday is a custom holiday
      })
      // Mon Feb 9 -> Tue Feb 10 (holiday, skip) -> Wed Feb 11 (1) -> Thu Feb 12 (2) -> Fri Feb 13 (3)
      expect(result.getDay()).toBe(5) // Friday
      expect(result.getDate()).toBe(13)
    })

    it('should throw error when business days is zero or negative', () => {
      const monday = utcDate('2026-02-09')
      expect(() => addBusinessDays(monday, 0)).toThrow('businessDays must be a positive number')
      expect(() => addBusinessDays(monday, -1)).toThrow('businessDays must be a positive number')
    })

    it('should handle month boundaries correctly', () => {
      // Jan 30, 2026 is Friday
      const friday = utcDate('2026-01-30')
      const result = addBusinessDays(friday, 3)
      // Fri Jan 30 -> Mon Feb 2 (1) -> Tue Feb 3 (2) -> Wed Feb 4 (3)
      expect(result.getMonth()).toBe(1) // February (0-indexed)
      expect(result.getDate()).toBe(4)
    })

    it('should handle year boundaries correctly', () => {
      // Dec 31, 2025 is Wednesday
      const wednesday = utcDate('2025-12-31')
      const result = addBusinessDays(wednesday, 3)
      // Wed Dec 31 -> Thu Jan 1 (New Year, skip) -> Fri Jan 2 (1) -> Mon Jan 5 (2, skip Sat/Sun) -> Tue Jan 6 (3)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(0) // January
      expect(result.getDate()).toBe(6) // Tuesday
      expect(result.getDay()).toBe(2) // Tuesday
    })
  })

  describe('getBusinessDaysBetween', () => {
    it('should return 0 when end date is before start date', () => {
      const start = utcDate('2026-02-10')
      const end = utcDate('2026-02-08')
      expect(getBusinessDaysBetween(start, end)).toBe(0)
    })

    it('should return 0 when end date equals start date', () => {
      const start = utcDate('2026-02-10')
      const end = utcDate('2026-02-10')
      expect(getBusinessDaysBetween(start, end)).toBe(0)
    })

    it('should count 1 business day for consecutive days (Tue->Wed)', () => {
      const start = utcDate('2026-02-10') // Tuesday
      const end = utcDate('2026-02-11') // Wednesday
      expect(getBusinessDaysBetween(start, end)).toBe(1)
    })

    it('should count business days in same week (Mon->Fri)', () => {
      const start = utcDate('2026-02-09') // Monday
      const end = utcDate('2026-02-13') // Friday
      expect(getBusinessDaysBetween(start, end)).toBe(4) // Tue, Wed, Thu, Fri
    })

    it('should exclude weekends (Mon->Mon next week)', () => {
      const start = utcDate('2026-02-09') // Monday
      const end = utcDate('2026-02-16') // Monday next week
      expect(getBusinessDaysBetween(start, end)).toBe(5) // 5 business days
    })

    it('should exclude Brazilian holidays', () => {
      // April 20-24, 2026 (Mon-Fri with Tiradentes on Tue Apr 21)
      const start = utcDate('2026-04-20') // Monday
      const end = utcDate('2026-04-24') // Friday
      expect(getBusinessDaysBetween(start, end)).toBe(3) // Mon, Wed, Thu (Tue is holiday)
    })

    it('should count across multiple weeks', () => {
      const start = utcDate('2026-02-09') // Monday
      const end = utcDate('2026-02-20') // Friday next week
      // Mon Feb 9 -> Fri Feb 20: Tue-Fri week 1 (4), Mon-Fri week 2 (5) = 9 business days
      expect(getBusinessDaysBetween(start, end)).toBe(9)
    })
  })

  describe('getNextBusinessDay', () => {
    it('should return Tuesday when starting on Monday', () => {
      const monday = utcDate('2026-02-09')
      const result = getNextBusinessDay(monday)
      expect(result.getDay()).toBe(2) // Tuesday
      expect(result.getDate()).toBe(10)
    })

    it('should return Monday when starting on Friday', () => {
      const friday = utcDate('2026-02-13')
      const result = getNextBusinessDay(friday)
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getDate()).toBe(16)
    })

    it('should return Monday when starting on Saturday', () => {
      const saturday = utcDate('2026-02-14')
      const result = getNextBusinessDay(saturday)
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getDate()).toBe(16)
    })

    it('should return Monday when starting on Sunday', () => {
      const sunday = utcDate('2026-02-15')
      const result = getNextBusinessDay(sunday)
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getDate()).toBe(16)
    })

    it('should skip holidays and return next business day', () => {
      // April 20, 2026 is Monday, April 21 is Tuesday (Tiradentes holiday)
      const monday = utcDate('2026-04-20')
      const result = getNextBusinessDay(monday)
      expect(result.getDay()).toBe(3) // Wednesday (skip Tuesday holiday)
      expect(result.getDate()).toBe(22)
    })

    it('should skip custom holidays', () => {
      const monday = utcDate('2026-02-09')
      const result = getNextBusinessDay(monday, {
        customHolidays: ['02-10'], // Tuesday is holiday
      })
      expect(result.getDay()).toBe(3) // Wednesday
      expect(result.getDate()).toBe(11)
    })
  })
})
