import { prisma } from '../db/prisma'
import crypto from 'crypto'
import { TeamRole, TeamStatus, TeamPermission, type InviteTeamMemberInput, type UpdateTeamMemberInput } from './team-types'

export { TeamRole, TeamStatus, TeamPermission }
export type { InviteTeamMemberInput, UpdateTeamMemberInput }

export const ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  [TeamRole.ADMIN]: [
    TeamPermission.CREATE_EVENTS,
    TeamPermission.EDIT_EVENTS,
    TeamPermission.DELETE_EVENTS,
    TeamPermission.VIEW_ANALYTICS,
    TeamPermission.MANAGE_TICKETS,
    TeamPermission.MANAGE_TEAM,
    TeamPermission.VIEW_ORDERS,
  ],
  [TeamRole.EDITOR]: [
    TeamPermission.EDIT_EVENTS,
    TeamPermission.VIEW_ANALYTICS,
    TeamPermission.MANAGE_TICKETS,
    TeamPermission.VIEW_ORDERS,
  ],
  [TeamRole.VIEWER]: [
    TeamPermission.VIEW_ANALYTICS,
    TeamPermission.VIEW_ORDERS,
  ],
}

export class TeamService {
  static async inviteTeamMember(
    inviterId: string,
    eventId: string,
    input: InviteTeamMemberInput
  ) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (event.organizerId !== inviterId) {
      const inviterTeamMember = await prisma.teamMember.findFirst({
        where: {
          userId: inviterId,
          eventId,
          status: TeamStatus.ACTIVE,
          role: TeamRole.ADMIN,
        },
      })

      if (!inviterTeamMember) {
        throw new Error('Sem permissão para convidar membros')
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    })

    if (existingUser) {
      const existingMembership = await prisma.teamMember.findFirst({
        where: {
          userId: existingUser.id,
          eventId,
        },
      })

      if (existingMembership) {
        throw new Error('Este usuário já é membro da equipe')
      }

      const teamMember = await prisma.teamMember.create({
        data: {
          userId: existingUser.id,
          eventId,
          role: input.role,
          status: TeamStatus.ACTIVE,
        },
      })

      await this.logActivity(
        teamMember.id,
        TeamPermission.MANAGE_TEAM,
        `Convidou ${existingUser.name} (${existingUser.email})`
      )

      return teamMember
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        eventId,
        role: input.role,
        status: TeamStatus.PENDING,
        userId: crypto.randomUUID(),
      },
    })

    await this.logActivity(
      teamMember.id,
      TeamPermission.MANAGE_TEAM,
      `Enviou convite para ${input.email}`
    )

    return teamMember
  }

  static async getTeamMembers(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    const hasAccess =
      event.organizerId === userId ||
      (await prisma.teamMember.findFirst({
        where: {
          eventId,
          userId,
          status: TeamStatus.ACTIVE,
        },
      }))

    if (!hasAccess) {
      throw new Error('Sem permissão para visualizar equipe')
    }

    return await prisma.teamMember.findMany({
      where: {
        eventId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  static async updateTeamMember(
    memberId: string,
    requesterId: string,
    input: UpdateTeamMemberInput
  ) {
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        event: true,
      },
    })

    if (!teamMember) {
      throw new Error('Membro da equipe não encontrado')
    }

    const event = teamMember.event

    if (event.organizerId !== requesterId) {
      const requesterMember = await prisma.teamMember.findFirst({
        where: {
          userId: requesterId,
          eventId: event.id,
          status: TeamStatus.ACTIVE,
          role: TeamRole.ADMIN,
        },
      })

      if (!requesterMember) {
        throw new Error('Sem permissão para atualizar membros')
      }
    }

    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        role: input.role,
      },
    })

    await this.logActivity(
      memberId,
      TeamPermission.MANAGE_TEAM,
      `Cargo alterado para ${input.role}`
    )

    return updatedMember
  }

  static async removeTeamMember(memberId: string, requesterId: string) {
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        event: true,
      },
    })

    if (!teamMember) {
      throw new Error('Membro da equipe não encontrado')
    }

    const event = teamMember.event

    if (event.organizerId !== requesterId) {
      const requesterMember = await prisma.teamMember.findFirst({
        where: {
          userId: requesterId,
          eventId: event.id,
          status: TeamStatus.ACTIVE,
          role: TeamRole.ADMIN,
        },
      })

      if (!requesterMember) {
        throw new Error('Sem permissão para remover membros')
      }
    }

    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        status: TeamStatus.REMOVED,
      },
    })

    await this.logActivity(
      memberId,
      TeamPermission.MANAGE_TEAM,
      `Membro removido da equipe`
    )

    return { success: true }
  }

  static async getActivityLogs(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    const hasAccess =
      event.organizerId === userId ||
      (await prisma.teamMember.findFirst({
        where: {
          eventId,
          userId,
          status: TeamStatus.ACTIVE,
        },
      }))

    if (!hasAccess) {
      throw new Error('Sem permissão para visualizar logs')
    }

    return await prisma.activityLog.findMany({
      where: {
        teamMember: {
          eventId,
        },
      },
      include: {
        teamMember: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })
  }

  static async checkPermission(
    userId: string,
    eventId: string,
    permission: TeamPermission
  ): Promise<boolean> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      return false
    }

    if (event.organizerId === userId) {
      return true
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId,
        eventId,
        status: TeamStatus.ACTIVE,
      },
    })

    if (!teamMember) {
      return false
    }

    const permissions = ROLE_PERMISSIONS[teamMember.role as TeamRole]
    return permissions.includes(permission)
  }

  private static async logActivity(
    teamMemberId: string,
    action: TeamPermission,
    details: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return await prisma.activityLog.create({
      data: {
        teamMemberId,
        action,
        details,
        ipAddress,
        userAgent,
      },
    })
  }
}
