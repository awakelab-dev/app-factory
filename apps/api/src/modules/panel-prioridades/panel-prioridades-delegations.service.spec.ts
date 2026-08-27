import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PanelPrioritiesDelegationsService } from './panel-prioridades-delegations.service';
import type { AuthUser } from '@awk/auth';

describe('PanelPrioritiesDelegationsService', () => {
  let service: PanelPrioritiesDelegationsService;
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
        PanelPrioritiesDelegationsService,
        {
          provide: PrismaService,
          useValue: {
            panelTask: {
              findUnique: jest.fn()
            },
            panelDelegation: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              deleteMany: jest.fn()
            }
          }
        }
      ]
    }).compile();

    service = module.get<PanelPrioritiesDelegationsService>(
      PanelPrioritiesDelegationsService
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setDelegation', () => {
    it('should reject delegation for non-Q3 tasks', async () => {
      const q1Task = {
        id: 'task-1',
        userId: mockUser.id,
        quadrant: 1,
        action: 'do'
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(q1Task);

      await expect(
        service.setDelegation(mockUser, 'task-1', 'Marta', new Date())
      ).rejects.toThrow(BadRequestException);
    });

    it('should create delegation for Q3 task', async () => {
      const q3Task = {
        id: 'task-1',
        userId: mockUser.id,
        quadrant: 3,
        action: 'delegate'
      };

      const delegation = {
        id: 'deleg-1',
        taskId: 'task-1',
        userId: mockUser.id,
        delegatedToName: 'Marta',
        followUpDate: new Date('2026-09-15'),
        task: q3Task
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(q3Task);
      (prisma.panelDelegation.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.panelDelegation.create as jest.Mock).mockResolvedValue(delegation);

      const result = await service.setDelegation(
        mockUser,
        'task-1',
        'Marta',
        new Date('2026-09-15')
      );

      expect(result.delegatedToName).toBe('Marta');
    });

    it('should allow null delegatedToName (no assignee required)', async () => {
      const q3Task = {
        id: 'task-1',
        userId: mockUser.id,
        quadrant: 3,
        action: 'delegate'
      };

      const delegation = {
        id: 'deleg-1',
        taskId: 'task-1',
        userId: mockUser.id,
        delegatedToName: null,
        followUpDate: null,
        task: q3Task
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(q3Task);
      (prisma.panelDelegation.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.panelDelegation.create as jest.Mock).mockResolvedValue(delegation);

      const result = await service.setDelegation(mockUser, 'task-1', null);

      expect(result.delegatedToName).toBeNull();
    });
  });

  describe('listDelegations', () => {
    it('should list all delegations for user ordered by followUpDate', async () => {
      const delegations = [
        {
          id: 'deleg-1',
          taskId: 'task-1',
          delegatedToName: 'Marta',
          followUpDate: new Date('2026-09-15'),
          task: { title: 'Urgent task' }
        }
      ];

      (prisma.panelDelegation.findMany as jest.Mock).mockResolvedValue(delegations);

      const result = await service.listDelegations(mockUser);

      expect(result).toHaveLength(1);
      expect((prisma.panelDelegation.findMany as jest.Mock)).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        include: { task: true },
        orderBy: { followUpDate: 'asc' }
      });
    });
  });

  describe('clearDelegation', () => {
    it('should delete a delegation', async () => {
      const task = {
        id: 'task-1',
        userId: mockUser.id
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(task);
      (prisma.panelDelegation.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.clearDelegation(mockUser, 'task-1');

      expect(prisma.panelDelegation.deleteMany).toHaveBeenCalledWith({
        where: { taskId: 'task-1' }
      });
    });
  });
});
