import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PanelPrioritiesTasksService } from './panel-prioridades-tasks.service';
import type { AuthUser } from '@awk/auth';

describe('PanelPrioritiesTasksService', () => {
  let service: PanelPrioritiesTasksService;
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
        PanelPrioritiesTasksService,
        {
          provide: PrismaService,
          useValue: {
            panelTask: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn()
            },
            panelScheduleBlock: {
              deleteMany: jest.fn()
            },
            panelDelegation: {
              deleteMany: jest.fn()
            },
            panelAuditTrail: {
              findMany: jest.fn()
            },
            $transaction: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<PanelPrioritiesTasksService>(PanelPrioritiesTasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listTasks', () => {
    it('should list open tasks for user', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          userId: mockUser.id,
          title: 'Urgente e importante',
          urgent: true,
          important: true,
          quadrant: 1,
          action: 'do',
          dueDate: null,
          estimatedMinutes: 60,
          origin: 'meeting',
          status: 'open',
          detail: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (prisma.panelTask.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const result = await service.listTasks(mockUser);

      expect(result).toHaveLength(1);
      expect(result[0].quadrant).toBe(1);
      expect(result[0].action).toBe('do');
    });

    it('should filter tasks by quadrant', async () => {
      const mockTasks = [
        {
          id: 'task-2',
          userId: mockUser.id,
          title: 'Important not urgent',
          urgent: false,
          important: true,
          quadrant: 2,
          action: 'plan',
          dueDate: null,
          estimatedMinutes: 120,
          origin: 'self',
          status: 'open',
          detail: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (prisma.panelTask.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const result = await service.listTasks(mockUser, { quadrant: 2 });

      expect(result).toHaveLength(1);
      expect(result[0].quadrant).toBe(2);
    });
  });

  describe('createTask', () => {
    it('should create a task in quadrant 1 (urgent + important)', async () => {
      const newTaskData = {
        title: 'Crisis response',
        detail: 'Production bug',
        urgent: true,
        important: true,
        estimatedMinutes: 60,
        origin: 'meeting' as const,
        dueDate: null
      };

      const createdTask = {
        id: 'task-new',
        userId: mockUser.id,
        ...newTaskData,
        quadrant: 1,
        action: 'do',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          panelTask: {
            create: jest.fn().mockResolvedValue(createdTask)
          }
        };
        return callback(tx);
      });

      const result = await service.createTask(mockUser, newTaskData);

      expect(result.quadrant).toBe(1);
      expect(result.action).toBe('do');
    });

    it('should create task in quadrant 4 (not urgent + not important)', async () => {
      const newTaskData = {
        title: 'Delete old emails',
        detail: null,
        urgent: false,
        important: false,
        estimatedMinutes: 30,
        origin: 'self' as const,
        dueDate: null
      };

      const createdTask = {
        id: 'task-new',
        userId: mockUser.id,
        ...newTaskData,
        quadrant: 4,
        action: 'eliminate',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          panelTask: {
            create: jest.fn().mockResolvedValue(createdTask)
          }
        };
        return callback(tx);
      });

      const result = await service.createTask(mockUser, newTaskData);

      expect(result.quadrant).toBe(4);
      expect(result.action).toBe('eliminate');
    });
  });

  describe('getTask', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getTask(mockUser, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user does not own task', async () => {
      const otherUsersTask = {
        id: 'task-1',
        userId: 'other-user',
        title: 'Not yours',
        urgent: true,
        important: true,
        quadrant: 1,
        action: 'do',
        dueDate: null,
        estimatedMinutes: 60,
        origin: 'meeting',
        status: 'open',
        detail: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(otherUsersTask);

      await expect(service.getTask(mockUser, 'task-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeTask', () => {
    it('should mark task as discarded and release blocks', async () => {
      const task = {
        id: 'task-1',
        userId: mockUser.id,
        title: 'Some task',
        urgent: true,
        important: true,
        quadrant: 1,
        action: 'do',
        dueDate: null,
        estimatedMinutes: 60,
        origin: 'meeting',
        status: 'open',
        detail: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(task);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          panelScheduleBlock: {
            deleteMany: jest.fn()
          },
          panelTask: {
            update: jest.fn().mockResolvedValue({ ...task, status: 'discarded' })
          }
        };
        return callback(tx);
      });

      const result = await service.closeTask(mockUser, 'task-1', 'discarded');

      expect(result.status).toBe('discarded');
    });
  });
});
