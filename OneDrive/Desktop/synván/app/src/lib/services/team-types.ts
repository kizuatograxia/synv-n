export enum TeamRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum TeamStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED',
}

export enum TeamPermission {
  CREATE_EVENTS = 'CREATE_EVENTS',
  EDIT_EVENTS = 'EDIT_EVENTS',
  DELETE_EVENTS = 'DELETE_EVENTS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  MANAGE_TICKETS = 'MANAGE_TICKETS',
  MANAGE_TEAM = 'MANAGE_TEAM',
  VIEW_ORDERS = 'VIEW_ORDERS',
}

export interface InviteTeamMemberInput {
  email: string
  role: TeamRole
  eventId: string
}

export interface UpdateTeamMemberInput {
  memberId: string
  role: TeamRole
}
