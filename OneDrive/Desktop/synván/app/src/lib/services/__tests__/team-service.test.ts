import { TeamService, TeamRole, TeamStatus, TeamPermission } from '@/lib/services/team-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    teamMember: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

describe('TeamService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('inviteTeamMember', () => {
    it('should invite new team member successfully', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockUser = {
        id: 'user2',
        name: 'John Doe',
        email: 'john@example.com',
      }

      const mockTeamMember = {
        id: 'tm1',
        userId: 'user2',
        eventId: 'event1',
        role: TeamRole.EDITOR,
        status: TeamStatus.ACTIVE,
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.teamMember.create as jest.Mock).mockResolvedValue(mockTeamMember)

      const result = await TeamService.inviteTeamMember('user1', 'event1', {
        email: 'john@example.com',
        role: TeamRole.EDITOR,
        eventId: 'event1',
      })

      expect(result).toEqual(mockTeamMember)
      expect(prisma.teamMember.create).toHaveBeenCalledWith({
        data: {
          userId: 'user2',
          eventId: 'event1',
          role: TeamRole.EDITOR,
          status: TeamStatus.ACTIVE,
        },
      })
    })

    it('should throw error if user already is team member', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockUser = {
        id: 'user2',
        name: 'John Doe',
        email: 'john@example.com',
      }

      const mockExistingMember = {
        id: 'tm1',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(
        mockExistingMember
      )

      await expect(
        TeamService.inviteTeamMember('user1', 'event1', {
          email: 'john@example.com',
          role: TeamRole.EDITOR,
          eventId: 'event1',
        })
      ).rejects.toThrow('Este usuário já é membro da equipe')
    })

    it('should create pending team member for new user', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const mockTeamMember = {
        id: 'tm1',
        userId: expect.any(String),
        eventId: 'event1',
        role: TeamRole.EDITOR,
        status: TeamStatus.PENDING,
      }

      ;(prisma.teamMember.create as jest.Mock).mockResolvedValue(mockTeamMember)

      const result = await TeamService.inviteTeamMember('user1', 'event1', {
        email: 'new@example.com',
        role: TeamRole.EDITOR,
        eventId: 'event1',
      })

      expect(result.status).toBe(TeamStatus.PENDING)
      expect(prisma.teamMember.create).toHaveBeenCalledWith({
        data: {
          eventId: 'event1',
          role: TeamRole.EDITOR,
          status: TeamStatus.PENDING,
          userId: expect.any(String),
        },
      })
    })
  })

  describe('getTeamMembers', () => {
    it('should get team members for event organizer', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockTeamMembers = [
        {
          id: 'tm1',
          role: TeamRole.EDITOR,
          status: TeamStatus.ACTIVE,
          user: {
            id: 'user2',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ]

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.teamMember.findMany as jest.Mock).mockResolvedValue(
        mockTeamMembers
      )

      const result = await TeamService.getTeamMembers('event1', 'user1')

      expect(result).toEqual(mockTeamMembers)
      expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
        where: {
          eventId: 'event1',
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
    })

    it('should allow active team member to view', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockTeamMember = {
        id: 'tm1',
        userId: 'user2',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(
        mockTeamMember
      )

      await expect(
        TeamService.getTeamMembers('event1', 'user2')
      ).resolves.not.toThrow()
    })
  })

  describe('updateTeamMember', () => {
    it('should update team member role', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockTeamMember = {
        id: 'tm1',
        userId: 'user2',
        role: TeamRole.EDITOR,
        event: mockEvent,
      }

      const updatedMember = {
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      }

      ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(mockTeamMember)
      ;(prisma.teamMember.update as jest.Mock).mockResolvedValue(updatedMember)

      const result = await TeamService.updateTeamMember('tm1', 'user1', {
        memberId: 'tm1',
        role: TeamRole.ADMIN,
      })

      expect(result).toEqual(updatedMember)
    })
  })

  describe('removeTeamMember', () => {
    it('should remove team member', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockTeamMember = {
        id: 'tm1',
        userId: 'user2',
        event: mockEvent,
      }

      ;(prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(mockTeamMember)
      ;(prisma.teamMember.update as jest.Mock).mockResolvedValue({
        id: 'tm1',
        status: TeamStatus.REMOVED,
      })

      const result = await TeamService.removeTeamMember('tm1', 'user1')

      expect(result).toEqual({ success: true })
      expect(prisma.teamMember.update).toHaveBeenCalledWith({
        where: { id: 'tm1' },
        data: {
          status: TeamStatus.REMOVED,
        },
      })
    })
  })

  describe('checkPermission', () => {
    it('should return true for event organizer', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)

      const result = await TeamService.checkPermission(
        'user1',
        'event1',
        TeamPermission.VIEW_ANALYTICS
      )

      expect(result).toBe(true)
    })

    it('should return false for non-member', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await TeamService.checkPermission(
        'user2',
        'event1',
        TeamPermission.VIEW_ANALYTICS
      )

      expect(result).toBe(false)
    })
  })
})
