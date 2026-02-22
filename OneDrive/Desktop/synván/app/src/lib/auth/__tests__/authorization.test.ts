/**
 * Unit Tests for Authorization (Role-Based Access Control)
 *
 * These tests verify role-based access control logic:
 * - Role checking functions (isAdmin, isOrganizer, isAttendee)
 * - Generic hasRole function for multiple role authorization
 * - Role hierarchy (ADMIN > ORGANIZER > ATTENDEE)
 */

import { hasRole, isAdmin, isOrganizer, isAttendee, UserRole } from '../authorization'

describe('Authorization - Role-Based Access Control', () => {
  describe('hasRole', () => {
    it('should return true when user role is in allowed roles', () => {
      expect(hasRole('ADMIN', ['ADMIN', 'ORGANIZER'])).toBe(true)
      expect(hasRole('ORGANIZER', ['ADMIN', 'ORGANIZER'])).toBe(true)
      expect(hasRole('ATTENDEE', ['ATTENDEE', 'ORGANIZER'])).toBe(true)
    })

    it('should return false when user role is not in allowed roles', () => {
      expect(hasRole('ATTENDEE', ['ADMIN', 'ORGANIZER'])).toBe(false)
      expect(hasRole('ORGANIZER', ['ADMIN'])).toBe(false)
      expect(hasRole('ADMIN', ['ORGANIZER', 'ATTENDEE'])).toBe(false)
    })

    it('should return true when single role matches', () => {
      expect(hasRole('ADMIN', ['ADMIN'])).toBe(true)
      expect(hasRole('ORGANIZER', ['ORGANIZER'])).toBe(true)
      expect(hasRole('ATTENDEE', ['ATTENDEE'])).toBe(true)
    })

    it('should return false when single role does not match', () => {
      expect(hasRole('ADMIN', ['ORGANIZER'])).toBe(false)
      expect(hasRole('ORGANIZER', ['ATTENDEE'])).toBe(false)
      expect(hasRole('ATTENDEE', ['ADMIN'])).toBe(false)
    })

    it('should handle empty allowed roles array', () => {
      expect(hasRole('ADMIN', [])).toBe(false)
      expect(hasRole('ORGANIZER', [])).toBe(false)
      expect(hasRole('ATTENDEE', [])).toBe(false)
    })

    it('should handle all roles allowed', () => {
      const allRoles: UserRole[] = ['ADMIN', 'ORGANIZER', 'ATTENDEE']
      expect(hasRole('ADMIN', allRoles)).toBe(true)
      expect(hasRole('ORGANIZER', allRoles)).toBe(true)
      expect(hasRole('ATTENDEE', allRoles)).toBe(true)
    })
  })

  describe('isAdmin', () => {
    it('should return true for ADMIN role', () => {
      expect(isAdmin('ADMIN')).toBe(true)
    })

    it('should return false for ORGANIZER role', () => {
      expect(isAdmin('ORGANIZER')).toBe(false)
    })

    it('should return false for ATTENDEE role', () => {
      expect(isAdmin('ATTENDEE')).toBe(false)
    })

    it('should be equivalent to hasRole with ADMIN only', () => {
      const testRole: UserRole = 'ADMIN'
      expect(isAdmin(testRole)).toEqual(hasRole(testRole, ['ADMIN']))
    })
  })

  describe('isOrganizer', () => {
    it('should return true for ORGANIZER role', () => {
      expect(isOrganizer('ORGANIZER')).toBe(true)
    })

    it('should return true for ADMIN role (role hierarchy)', () => {
      // ADMIN users have organizer privileges
      expect(isOrganizer('ADMIN')).toBe(true)
    })

    it('should return false for ATTENDEE role', () => {
      expect(isOrganizer('ATTENDEE')).toBe(false)
    })

    it('should implement role hierarchy correctly', () => {
      // ADMIN > ORGANIZER in hierarchy
      expect(isOrganizer('ADMIN')).toBe(true)
      expect(isOrganizer('ORGANIZER')).toBe(true)
      expect(isOrganizer('ATTENDEE')).toBe(false)
    })

    it('should be equivalent to hasRole with ORGANIZER and ADMIN', () => {
      const roles: UserRole[] = ['ADMIN', 'ORGANIZER', 'ATTENDEE']
      roles.forEach(role => {
        expect(isOrganizer(role)).toEqual(hasRole(role, ['ORGANIZER', 'ADMIN']))
      })
    })
  })

  describe('isAttendee', () => {
    it('should return true for ATTENDEE role', () => {
      expect(isAttendee('ATTENDEE')).toBe(true)
    })

    it('should return true for ORGANIZER role (role hierarchy)', () => {
      // ORGANIZER users are also attendees
      expect(isAttendee('ORGANIZER')).toBe(true)
    })

    it('should return true for ADMIN role (role hierarchy)', () => {
      // ADMIN users have all privileges including attendee
      expect(isAttendee('ADMIN')).toBe(true)
    })

    it('should implement role hierarchy correctly (all roles are attendees)', () => {
      expect(isAttendee('ADMIN')).toBe(true)
      expect(isAttendee('ORGANIZER')).toBe(true)
      expect(isAttendee('ATTENDEE')).toBe(true)
    })

    it('should be equivalent to hasRole with all roles', () => {
      const roles: UserRole[] = ['ADMIN', 'ORGANIZER', 'ATTENDEE']
      const allRoles: UserRole[] = ['ADMIN', 'ORGANIZER', 'ATTENDEE']
      roles.forEach(role => {
        expect(isAttendee(role)).toEqual(hasRole(role, allRoles))
      })
    })
  })

  describe('Role Hierarchy and Authorization Matrix', () => {
    /**
     * Role Hierarchy:
     * ADMIN - has all privileges
     * ORGANIZER - has organizer and attendee privileges
     * ATTENDEE - has attendee privileges only
     */

    it('should grant ADMIN access to all role-protected resources', () => {
      // ADMIN can access admin resources
      expect(isAdmin('ADMIN')).toBe(true)
      // ADMIN can access organizer resources
      expect(isOrganizer('ADMIN')).toBe(true)
      // ADMIN can access attendee resources
      expect(isAttendee('ADMIN')).toBe(true)
    })

    it('should grant ORGANIZER access to organizer and attendee resources', () => {
      // ORGANIZER cannot access admin-only resources
      expect(isAdmin('ORGANIZER')).toBe(false)
      // ORGANIZER can access organizer resources
      expect(isOrganizer('ORGANIZER')).toBe(true)
      // ORGANIZER can access attendee resources
      expect(isAttendee('ORGANIZER')).toBe(true)
    })

    it('should grant ATTENDEE access to attendee resources only', () => {
      // ATTENDEE cannot access admin-only resources
      expect(isAdmin('ATTENDEE')).toBe(false)
      // ATTENDEE cannot access organizer-only resources
      expect(isOrganizer('ATTENDEE')).toBe(false)
      // ATTENDEE can access attendee resources
      expect(isAttendee('ATTENDEE')).toBe(true)
    })
  })

  describe('Authorization Use Cases', () => {
    it('should authorize admin dashboard access for ADMIN only', () => {
      const adminDashboardAccess = (role: UserRole) => isAdmin(role)

      expect(adminDashboardAccess('ADMIN')).toBe(true)
      expect(adminDashboardAccess('ORGANIZER')).toBe(false)
      expect(adminDashboardAccess('ATTENDEE')).toBe(false)
    })

    it('should authorize event creation for ORGANIZER and ADMIN', () => {
      const eventCreationAccess = (role: UserRole) => isOrganizer(role)

      expect(eventCreationAccess('ADMIN')).toBe(true)
      expect(eventCreationAccess('ORGANIZER')).toBe(true)
      expect(eventCreationAccess('ATTENDEE')).toBe(false)
    })

    it('should authorize ticket purchase for all roles', () => {
      const ticketPurchaseAccess = (role: UserRole) => isAttendee(role)

      expect(ticketPurchaseAccess('ADMIN')).toBe(true)
      expect(ticketPurchaseAccess('ORGANIZER')).toBe(true)
      expect(ticketPurchaseAccess('ATTENDEE')).toBe(true)
    })

    it('should authorize custom role combinations', () => {
      // Example: A resource that only ADMIN and specific ORGANIZERs can access
      const customAccess = (role: UserRole) => hasRole(role, ['ADMIN'])

      expect(customAccess('ADMIN')).toBe(true)
      expect(customAccess('ORGANIZER')).toBe(false)
      expect(customAccess('ATTENDEE')).toBe(false)
    })

    it('should authorize multi-role protected resources', () => {
      // Example: A resource that requires either ADMIN or ATTENDEE role (unusual but possible)
      const adminOrAttendeeOnly = (role: UserRole) => hasRole(role, ['ADMIN', 'ATTENDEE'])

      expect(adminOrAttendeeOnly('ADMIN')).toBe(true)
      expect(adminOrAttendeeOnly('ORGANIZER')).toBe(false)
      expect(adminOrAttendeeOnly('ATTENDEE')).toBe(true)
    })
  })

  describe('Type Safety', () => {
    it('should only accept valid UserRole values', () => {
      // TypeScript should enforce these are the only valid values
      const validRoles: UserRole[] = ['ADMIN', 'ORGANIZER', 'ATTENDEE']

      validRoles.forEach(role => {
        expect(hasRole(role, ['ADMIN'])).toBeDefined()
        expect(isAdmin(role)).toBeDefined()
        expect(isOrganizer(role)).toBeDefined()
        expect(isAttendee(role)).toBeDefined()
      })
    })

    it('should handle type coercion correctly', () => {
      const role: UserRole = 'ADMIN'
      const allowedRoles: UserRole[] = ['ADMIN', 'ORGANIZER']

      expect(hasRole(role, allowedRoles)).toBe(true)
      expect(isAdmin(role)).toBe(true)
    })
  })
})
