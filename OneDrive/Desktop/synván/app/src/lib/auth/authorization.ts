export type UserRole = 'ADMIN' | 'ORGANIZER' | 'ATTENDEE'

export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole)
}

export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function isOrganizer(role: UserRole): boolean {
  return role === 'ORGANIZER' || role === 'ADMIN'
}

export function isAttendee(role: UserRole): boolean {
  return role === 'ATTENDEE' || role === 'ORGANIZER' || role === 'ADMIN'
}
