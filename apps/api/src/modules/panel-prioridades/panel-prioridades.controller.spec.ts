import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import { PanelPrioridadesController } from './panel-prioridades.controller';
import { PanelPrioridadesService } from './panel-prioridades.service';

describe('PanelPrioridadesController', () => {
  let controller: PanelPrioridadesController;
  let service: PanelPrioridadesService;

  const mockUser: AuthUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    displayName: 'Test User',
    roles: ['panel_admin']
  };

  beforeEach(async () => {
    const mockService = {
      listTasks: vi.fn(),
      createTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      getTaskHistory: vi.fn(),
      getScheduleGrid: vi.fn(),
      toggleScheduleBlock: vi.fn(),
      getTeam: vi.fn(),
      addTeamMember: vi.fn(),
      updateTeamMember: vi.fn(),
      deleteTeamMember: vi.fn(),
      setDelegation: vi.fn(),
      getKPIs: vi.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PanelPrioridadesController],
      providers: [
        {
          provide: PanelPrioridadesService,
          useValue: mockService
        }
      ]
    }).compile();

    controller = module.get<PanelPrioridadesController>(PanelPrioridadesController);
    service = module.get<PanelPrioridadesService>(PanelPrioridadesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listTasks', () => {
    it('should list all tasks without filters', async () => {
      const mockTasks = {
        tasks: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            userId: mockUser.id,
            title: 'Task 1',
            detail: null,
            urgent: true,
            important: true,
            quadrant: 1,
            action: 'do',
            dueDate: null,
            estimatedMinutes: 60,
            origin: 'meeting',
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date(),
            overdue: false
          }
        ],
        total: 1
      };

      vi.spyOn(service, 'listTasks').mockResolvedValue(mockTasks);

      const result = await controller.listTasks(mockUser);
      expect(result).toEqual(mockTasks);
      expect(service.listTasks).toHaveBeenCalledWith(mockUser, {
        quadrant: undefined,
        status: undefined,
        origin: undefined
      });
    });

    it('should list tasks with quadrant filter', async () => {
      const mockTasks = { tasks: [], total: 0 };

      vi.spyOn(service, 'listTasks').mockResolvedValue(mockTasks);

      await controller.listTasks(mockUser, '1');
      expect(service.listTasks).toHaveBeenCalledWith(mockUser, {
        quadrant: 1,
        status: undefined,
        origin: undefined
      });
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const createBody = {
        title: 'New Task',
        detail: 'Task description',
        urgent: true,
        important: true,
        estimatedMinutes: 90,
        origin: 'meeting'
      };

      const createdTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        userId: mockUser.id,
        title: 'New Task',
        detail: 'Task description',
        urgent: true,
        important: true,
        quadrant: 1,
        action: 'do',
        dueDate: null,
        estimatedMinutes: 90,
        origin: 'meeting',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.spyOn(service, 'createTask').mockResolvedValue(createdTask);

      const result = await controller.createTask(mockUser, createBody);
      expect(result).toEqual(createdTask);
      expect(service.createTask).toHaveBeenCalledWith(mockUser, createBody);
    });
  });

  describe('updateTask', () => {
    it('should update a task', async () => {
      const taskId = '550e8400-e29b-41d4-a716-446655440001';
      const updateBody = {
        title: 'Updated Task',
        urgent: false
      };

      const updatedTask = {
        id: taskId,
        userId: mockUser.id,
        title: 'Updated Task',
        detail: null,
        urgent: false,
        important: true,
        quadrant: 2,
        action: 'plan',
        dueDate: null,
        estimatedMinutes: 60,
        origin: 'meeting',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.spyOn(service, 'updateTask').mockResolvedValue(updatedTask);

      const result = await controller.updateTask(mockUser, taskId, updateBody);
      expect(result).toEqual(updatedTask);
      expect(service.updateTask).toHaveBeenCalledWith(mockUser, taskId, updateBody);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const taskId = '550e8400-e29b-41d4-a716-446655440001';

      vi.spyOn(service, 'deleteTask').mockResolvedValue(undefined);

      await controller.deleteTask(mockUser, taskId);
      expect(service.deleteTask).toHaveBeenCalledWith(mockUser, taskId);
    });
  });

  describe('getScheduleGrid', () => {
    it('should return schedule grid', async () => {
      const mockGrid = {
        blocks: [
          {
            dayOfWeek: 0,
            hour: 9,
            taskId: '550e8400-e29b-41d4-a716-446655440001',
            taskTitle: 'Task 1'
          }
        ]
      };

      vi.spyOn(service, 'getScheduleGrid').mockResolvedValue(mockGrid);

      const result = await controller.getScheduleGrid(mockUser);
      expect(result).toEqual(mockGrid);
      expect(service.getScheduleGrid).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('getTeam', () => {
    it('should return team members', async () => {
      const mockTeam = {
        team: [
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            userId: mockUser.id,
            addedByUserId: mockUser.id,
            name: 'Team Member 1',
            email: 'member@example.com',
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      vi.spyOn(service, 'getTeam').mockResolvedValue(mockTeam);

      const result = await controller.getTeam(mockUser);
      expect(result).toEqual(mockTeam);
      expect(service.getTeam).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('getKPIs', () => {
    it('should return KPIs', async () => {
      const mockKPIs = {
        totalOpen: 5,
        totalHoursScheduled: 20,
        percentageQ2: 60,
        overdueCount: 1,
        delegationsWithoutResponsible: 0,
        tasksByQuadrant: { q1: 1, q2: 2, q3: 1, q4: 1 },
        hoursByQuadrant: { q1: 4, q2: 12, q3: 4, q4: 0 },
        diagnostics: [
          {
            key: 'well_oriented_week',
            message: 'Semana bien orientada.',
            severity: 'info'
          }
        ]
      };

      vi.spyOn(service, 'getKPIs').mockResolvedValue(mockKPIs);

      const result = await controller.getKPIs(mockUser);
      expect(result).toEqual(mockKPIs);
      expect(service.getKPIs).toHaveBeenCalledWith(mockUser);
    });
  });
});
