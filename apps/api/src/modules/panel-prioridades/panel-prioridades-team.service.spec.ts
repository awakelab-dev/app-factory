import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PanelPrioritiesTeamService } from './panel-prioridades-team.service';
import type { AuthUser } from '@awk/auth';

describe('PanelPrioritiesTeamService', () => {
  let service: PanelPrioritiesTeamService;
  let prisma: PrismaService;

  const mockUser: AuthUser = {
    id: 'user-1',
    email: 'antonio@awakelab.dev',
    displayName: 'Antonio Alonso',
    roles: ['panel_admin'],
    isAdmin: false
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PanelPrioritiesTeamService,
        {
          provide: PrismaService,
          useValue: {
            panelTeamMember: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn()
            }
          }
        }
      ]
    }).compile();

    service = module.get<PanelPrioritiesTeamService>(PanelPrioritiesTeamService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listTeamMembers', () => {
    it('should list active team members only by default', async () => {
      const mockMembers = [
        {
          id: 'member-1',
          userId: mockUser.id,
          name: 'Marta',
          email: 'marta@awakelab.dev',
          active: true
        }
      ];

      (prisma.panelTeamMember.findMany as jest.Mock).mockResolvedValue(mockMembers);

      const result = await service.listTeamMembers(mockUser);

      expect(result).toHaveLength(1);
      expect((prisma.panelTeamMember.findMany as jest.Mock)).toHaveBeenCalledWith({
        where: { userId: mockUser.id, active: true },
        orderBy: { name: 'asc' }
      });
    });

    it('should include inactive members if requested', async () => {
      const mockMembers = [
        { id: 'member-1', name: 'Marta', active: true },
        { id: 'member-2', name: 'Luis', active: false }
      ];

      (prisma.panelTeamMember.findMany as jest.Mock).mockResolvedValue(mockMembers);

      const result = await service.listTeamMembers(mockUser, true);

      expect(result).toHaveLength(2);
    });
  });

  describe('addTeamMember', () => {
    it('should create a new team member', async () => {
      const request = {
        name: 'Nerea',
        email: 'nerea@awakelab.dev'
      };

      const created = {
        id: 'member-new',
        userId: mockUser.id,
        addedByUserId: mockUser.id,
        ...request,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.panelTeamMember.create as jest.Mock).mockResolvedValue(created);

      const result = await service.addTeamMember(mockUser, request);

      expect(result.name).toBe('Nerea');
      expect(result.active).toBe(true);
    });
  });

  describe('removeTeamMember', () => {
    it('should deactivate a team member', async () => {
      const member = {
        id: 'member-1',
        userId: mockUser.id,
        name: 'Marta',
        active: true
      };

      const deactivated = { ...member, active: false };

      (prisma.panelTeamMember.findUnique as jest.Mock).mockResolvedValue(member);
      (prisma.panelTeamMember.update as jest.Mock).mockResolvedValue(deactivated);

      await service.removeTeamMember(mockUser, 'member-1');

      expect(prisma.panelTeamMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { active: false }
      });
    });

    it('should throw NotFoundException if member does not exist', async () => {
      (prisma.panelTeamMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.removeTeamMember(mockUser, 'nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
