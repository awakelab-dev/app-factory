import { Test, TestingModule } from '@nestjs/testing';
import { PanelPrioritiesController } from './panel-prioridades.controller';
import { PanelPrioritiesTasksService } from './panel-prioridades-tasks.service';
import { PanelPrioritiesScheduleService } from './panel-prioridades-schedule.service';
import { PanelPrioritiesTeamService } from './panel-prioridades-team.service';
import { PanelPrioritiesDelegationsService } from './panel-prioridades-delegations.service';
import { PanelPrioritiesKpisService } from './panel-prioridades-kpis.service';
import type { AuthUser } from '@awk/auth';

describe('PanelPrioritiesController', () => {
  let controller: PanelPrioritiesController;
  let tasksService: PanelPrioritiesTasksService;

  const mockUser: AuthUser = {
    id: 'user-1',
    email: 'antonio@awakelab.dev',
    displayName: 'Antonio Alonso',
    roles: ['panel_admin'],
    isAdmin: false
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PanelPrioritiesController],
      providers: [
        {
          provide: PanelPrioritiesTasksService,
          useValue: {
            listTasks: jest.fn(),
            getTask: jest.fn(),
            createTask: jest.fn(),
            updateTask: jest.fn(),
            closeTask: jest.fn(),
            getTaskHistory: jest.fn()
          }
        },
        {
          provide: PanelPrioritiesScheduleService,
          useValue: {
            getWeekSchedule: jest.fn(),
            reserveBlock: jest.fn(),
            releaseBlock: jest.fn()
          }
        },
        {
          provide: PanelPrioritiesTeamService,
          useValue: {
            listTeamMembers: jest.fn(),
            getTeamMember: jest.fn(),
            addTeamMember: jest.fn(),
            updateTeamMember: jest.fn(),
            removeTeamMember: jest.fn()
          }
        },
        {
          provide: PanelPrioritiesDelegationsService,
          useValue: {
            listDelegations: jest.fn(),
            getDelegation: jest.fn(),
            setDelegation: jest.fn(),
            clearDelegation: jest.fn()
          }
        },
        {
          provide: PanelPrioritiesKpisService,
          useValue: {
            getKpis: jest.fn()
          }
        }
      ]
    }).compile();

    controller = module.get<PanelPrioritiesController>(PanelPrioritiesController);
    tasksService = module.get<PanelPrioritiesTasksService>(PanelPrioritiesTasksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listTasks', () => {
    it('should call tasksService.listTasks', async () => {
      (tasksService.listTasks as jest.Mock).mockResolvedValue([]);

      await controller.listTasks(mockUser);

      expect(tasksService.listTasks).toHaveBeenCalledWith(mockUser, {
        quadrant: undefined,
        status: undefined,
        origin: undefined
      });
    });

    it('should pass filters to service', async () => {
      (tasksService.listTasks as jest.Mock).mockResolvedValue([]);

      await controller.listTasks(mockUser, '2', 'open', 'meeting');

      expect(tasksService.listTasks).toHaveBeenCalledWith(mockUser, {
        quadrant: 2,
        status: 'open',
        origin: 'meeting'
      });
    });
  });

  describe('createTask', () => {
    it('should create a task', async () => {
      const request = {
        title: 'New task',
        urgent: true,
        important: true,
        estimatedMinutes: 60,
        origin: 'meeting' as const
      };

      const created = {
        id: 'task-1',
        userId: mockUser.id,
        ...request,
        quadrant: 1,
        action: 'do',
        status: 'open',
        detail: null,
        dueDate: null,
        overdue: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      (tasksService.createTask as jest.Mock).mockResolvedValue(created);

      const result = await controller.createTask(mockUser, request);

      expect(result.quadrant).toBe(1);
    });
  });

  describe('deleteTask', () => {
    it('should close task as discarded by default', async () => {
      await controller.deleteTask(mockUser, 'task-1');

      expect(tasksService.closeTask).toHaveBeenCalledWith(mockUser, 'task-1', 'discarded');
    });

    it('should close task as done if status=done', async () => {
      await controller.deleteTask(mockUser, 'task-1', 'done');

      expect(tasksService.closeTask).toHaveBeenCalledWith(mockUser, 'task-1', 'done');
    });
  });
});
