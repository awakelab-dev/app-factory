import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PanelPrioritiesKpisService } from './panel-prioridades-kpis.service';
import { PanelPrioritiesScheduleService } from './panel-prioridades-schedule.service';
import type { AuthUser } from '@awk/auth';

describe('PanelPrioritiesKpisService', () => {
  let service: PanelPrioritiesKpisService;
  let prisma: PrismaService;
  let scheduleService: PanelPrioritiesScheduleService;

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
        PanelPrioritiesKpisService,
        {
          provide: PrismaService,
          useValue: {
            panelTask: {
              findMany: jest.fn()
            }
          }
        },
        {
          provide: PanelPrioritiesScheduleService,
          useValue: {
            getWeekTotalMinutes: jest.fn(),
            getMinutesByQuadrant: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<PanelPrioritiesKpisService>(PanelPrioritiesKpisService);
    prisma = module.get<PrismaService>(PrismaService);
    scheduleService = module.get<PanelPrioritiesScheduleService>(PanelPrioritiesScheduleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getKpis', () => {
    it('should calculate KPIs correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          userId: mockUser.id,
          quadrant: 1,
          estimatedMinutes: 60,
          status: 'open',
          dueDate: null
        },
        {
          id: 'task-2',
          userId: mockUser.id,
          quadrant: 2,
          estimatedMinutes: 120,
          status: 'open',
          dueDate: null
        },
        {
          id: 'task-3',
          userId: mockUser.id,
          quadrant: 4,
          estimatedMinutes: 30,
          status: 'open',
          dueDate: null
        }
      ];

      (prisma.panelTask.findMany as jest.Mock).mockResolvedValue(mockTasks);
      (scheduleService.getWeekTotalMinutes as jest.Mock).mockResolvedValue(300);
      (scheduleService.getMinutesByQuadrant as jest.Mock).mockResolvedValue(
        new Map([
          [1, 60],
          [2, 120],
          [3, 0],
          [4, 30]
        ])
      );

      const result = await service.getKpis(mockUser);

      expect(result.openTasksCount).toBe(3);
      expect(result.weekScheduledMinutes).toBe(300);
      expect(result.q2PercentageMinutes).toBe(40); // 120/300 = 40%
      expect(result.overdueTasksCount).toBe(0);
      expect(result.tasksByQuadrant).toHaveLength(4);
    });

    it('should detect "falta_fondo" diagnostic when Q2 < 50%', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          userId: mockUser.id,
          quadrant: 1,
          estimatedMinutes: 60,
          status: 'open',
          dueDate: null
        },
        {
          id: 'task-2',
          userId: mockUser.id,
          quadrant: 2,
          estimatedMinutes: 60,
          status: 'open',
          dueDate: null
        }
      ];

      (prisma.panelTask.findMany as jest.Mock).mockResolvedValue(mockTasks);
      (scheduleService.getWeekTotalMinutes as jest.Mock).mockResolvedValue(200);
      (scheduleService.getMinutesByQuadrant as jest.Mock).mockResolvedValue(
        new Map([
          [1, 140],
          [2, 60],
          [3, 0],
          [4, 0]
        ])
      );

      const result = await service.getKpis(mockUser);

      const faltaFondoDiagnostic = result.diagnostics.find(d => d.type === 'falta_fondo');
      expect(faltaFondoDiagnostic).toBeDefined();
    });

    it('should detect "apagafuegos" diagnostic when Q1 > 40%', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          userId: mockUser.id,
          quadrant: 1,
          estimatedMinutes: 120,
          status: 'open',
          dueDate: null
        }
      ];

      (prisma.panelTask.findMany as jest.Mock).mockResolvedValue(mockTasks);
      (scheduleService.getWeekTotalMinutes as jest.Mock).mockResolvedValue(200);
      (scheduleService.getMinutesByQuadrant as jest.Mock).mockResolvedValue(
        new Map([
          [1, 120],
          [2, 80],
          [3, 0],
          [4, 0]
        ])
      );

      const result = await service.getKpis(mockUser);

      const apagafuegosDiagnostic = result.diagnostics.find(d => d.type === 'apagafuegos');
      expect(apagafuegosDiagnostic).toBeDefined();
    });
  });
});
