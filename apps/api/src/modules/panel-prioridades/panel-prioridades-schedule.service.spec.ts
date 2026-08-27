import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PanelPrioritiesScheduleService } from './panel-prioridades-schedule.service';
import type { AuthUser } from '@awk/auth';

describe('PanelPrioritiesScheduleService', () => {
  let service: PanelPrioritiesScheduleService;
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
        PanelPrioritiesScheduleService,
        {
          provide: PrismaService,
          useValue: {
            panelScheduleBlock: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              deleteMany: jest.fn()
            },
            panelTask: {
              findUnique: jest.fn()
            }
          }
        }
      ]
    }).compile();

    service = module.get<PanelPrioritiesScheduleService>(PanelPrioritiesScheduleService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWeekSchedule', () => {
    it('should return a 5-day schedule (Monday to Friday)', async () => {
      (prisma.panelScheduleBlock.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getWeekSchedule(mockUser);

      expect(result).toHaveLength(5); // 5 days
      result.forEach((daySchedule, index) => {
        expect(daySchedule.day).toBe(index);
        expect(daySchedule.blocks).toHaveLength(10); // 8-17 = 10 hours
      });
    });

    it('should show occupied blocks with task titles', async () => {
      const mockBlocks = [
        {
          id: 'block-1',
          userId: mockUser.id,
          taskId: 'task-1',
          dayOfWeek: 0,
          hour: 8,
          task: { title: 'Morning review' }
        }
      ];

      (prisma.panelScheduleBlock.findMany as jest.Mock).mockResolvedValue(mockBlocks);

      const result = await service.getWeekSchedule(mockUser);

      const mondayBlock = result[0].blocks[0];
      expect(mondayBlock.taskId).toBe('task-1');
      expect(mondayBlock.taskTitle).toBe('Morning review');
    });
  });

  describe('reserveBlock', () => {
    it('should reject Q4 (eliminate) tasks', async () => {
      const q4Task = {
        id: 'task-1',
        userId: mockUser.id,
        quadrant: 4,
        action: 'eliminate'
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(q4Task);

      await expect(service.reserveBlock(mockUser, 'task-1', 0, 8)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should allow Q1, Q2, Q3 tasks', async () => {
      const q2Task = {
        id: 'task-1',
        userId: mockUser.id,
        quadrant: 2,
        action: 'plan'
      };

      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(q2Task);
      (prisma.panelScheduleBlock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.panelScheduleBlock.create as jest.Mock).mockResolvedValue({});

      await service.reserveBlock(mockUser, 'task-1', 0, 8);

      expect(prisma.panelScheduleBlock.create).toHaveBeenCalled();
    });

    it('should reject invalid day (< 0 or > 4)', async () => {
      const q2Task = { id: 'task-1', userId: mockUser.id, quadrant: 2 };
      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(q2Task);

      await expect(service.reserveBlock(mockUser, 'task-1', 5, 8)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject invalid hour (< 8 or > 17)', async () => {
      const q2Task = { id: 'task-1', userId: mockUser.id, quadrant: 2 };
      (prisma.panelTask.findUnique as jest.Mock).mockResolvedValue(q2Task);

      await expect(service.reserveBlock(mockUser, 'task-1', 0, 7)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('releaseBlock', () => {
    it('should delete a block', async () => {
      (prisma.panelScheduleBlock.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.releaseBlock(mockUser, 0, 8);

      expect(prisma.panelScheduleBlock.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, dayOfWeek: 0, hour: 8 }
      });
    });
  });

  describe('getWeekTotalMinutes', () => {
    it('should sum minutes from all blocks', async () => {
      const mockBlocks = [
        { task: { estimatedMinutes: 60 } },
        { task: { estimatedMinutes: 90 } }
      ];

      (prisma.panelScheduleBlock.findMany as jest.Mock).mockResolvedValue(mockBlocks);

      const result = await service.getWeekTotalMinutes(mockUser);

      expect(result).toBe(150);
    });

    it('should default to 60 minutes if task is missing', async () => {
      const mockBlocks = [{ task: null }];

      (prisma.panelScheduleBlock.findMany as jest.Mock).mockResolvedValue(mockBlocks);

      const result = await service.getWeekTotalMinutes(mockUser);

      expect(result).toBe(60);
    });
  });

  describe('getMinutesByQuadrant', () => {
    it('should return minutes broken down by quadrant', async () => {
      const mockBlocks = [
        { task: { quadrant: 1, estimatedMinutes: 60 } },
        { task: { quadrant: 2, estimatedMinutes: 120 } },
        { task: { quadrant: 2, estimatedMinutes: 60 } }
      ];

      (prisma.panelScheduleBlock.findMany as jest.Mock).mockResolvedValue(mockBlocks);

      const result = await service.getMinutesByQuadrant(mockUser);

      expect(result.get(1)).toBe(60);
      expect(result.get(2)).toBe(180);
      expect(result.get(3)).toBe(0);
      expect(result.get(4)).toBe(0);
    });
  });
});
