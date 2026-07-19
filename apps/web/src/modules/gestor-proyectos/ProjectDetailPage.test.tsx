import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { ProjectDetailPage } from './ProjectDetailPage';
import type { GestorProjectDetail, GestorTaskRow } from './gestor-proyectos.types';

const admin: AuthUser = { id: 'u-admin', email: 'a@awakelab.dev', displayName: 'Admin', roles: ['admin'] };
const ejecutor: AuthUser = { id: 'u-1', email: 'b@awakelab.dev', displayName: 'Ejecutor', roles: ['user'] };

const projectFixture: GestorProjectDetail = {
  id: 'p-1',
  name: 'Proyecto Demo',
  description: 'Descripción de prueba',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
  createdById: 'u-admin',
  tasksCount: 2,
  openTasksCount: 2,
  sprints: [
    { id: 's-1', projectId: 'p-1', name: 'Sprint 1', startDate: '2026-07-20', endDate: '2026-07-31', createdAt: '2026-07-18T00:00:00.000Z' }
  ]
};

function buildTask(overrides: Partial<GestorTaskRow>): GestorTaskRow {
  return {
    id: 't-1',
    projectId: 'p-1',
    sprintId: 's-1',
    title: 'Tarea de ejemplo',
    status: 'iniciada',
    dueDate: '2026-07-24',
    assigneeId: 'u-1',
    assigneeName: 'Ejecutor',
    createdById: 'u-admin',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
    subtasks: [],
    comments: [],
    permissions: { canChangeStatus: false, canAddInfo: false, canEditTask: false, canDeleteTask: false },
    ...overrides
  };
}

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(user: AuthUser, tasks: GestorTaskRow[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return ok(user);
      if (url.endsWith('/api/gestor-proyectos/projects/p-1')) return ok(projectFixture);
      if (url.endsWith('/api/gestor-proyectos/sprints/s-1/tasks')) return ok(tasks);
      if (url.endsWith('/api/core/users')) return ok([]);
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    })
  );
}

function renderPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/gestor-proyectos/projects/p-1']}>
        <Routes>
          <Route path="/gestor-proyectos/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.setItem('awk.token', 'token-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('ProjectDetailPage — tablero kanban', () => {
  it('pinta las 5 columnas y la tarjeta de la tarea en su columna', async () => {
    mockApi(admin, [buildTask({ status: 'en_progreso', permissions: { canChangeStatus: true, canAddInfo: true, canEditTask: true, canDeleteTask: true } })]);
    renderPage();

    expect(await screen.findByText('Proyecto Demo')).toBeInTheDocument();
    const column = await screen.findByTestId('kanban-column-en_progreso');
    expect(within(column).getByText('Tarea de ejemplo')).toBeInTheDocument();
  });

  it('una tarjeta que el usuario NO puede mover no es draggable', async () => {
    mockApi(ejecutor, [buildTask({})]); // permissions.canChangeStatus: false por defecto
    renderPage();

    const card = await screen.findByTestId('task-card-t-1');
    expect(card).toHaveAttribute('draggable', 'false');
  });

  it('una tarjeta que el usuario SÍ puede mover es draggable', async () => {
    mockApi(admin, [buildTask({ permissions: { canChangeStatus: true, canAddInfo: true, canEditTask: true, canDeleteTask: true } })]);
    renderPage();

    const card = await screen.findByTestId('task-card-t-1');
    expect(card).toHaveAttribute('draggable', 'true');
  });
});

describe('ProjectDetailPage — modal de tarea', () => {
  it('un ejecutor sin permisos no ve botones de editar/eliminar ni puede añadir subtareas', async () => {
    mockApi(ejecutor, [buildTask({})]);
    renderPage();

    fireEvent.click(await screen.findByTestId('task-card-t-1'));
    const modal = await screen.findByTestId('task-modal');

    expect(within(modal).queryByText('Editar')).not.toBeInTheDocument();
    expect(within(modal).queryByTestId('delete-task-button')).not.toBeInTheDocument();
    expect(within(modal).queryByTestId('new-subtask-input')).not.toBeInTheDocument();
    expect(within(modal).getByTestId('task-status-select')).toBeDisabled();
  });

  it('el admin ve editar/eliminar y puede cambiar el estado desde el modal', async () => {
    mockApi(admin, [
      buildTask({ permissions: { canChangeStatus: true, canAddInfo: true, canEditTask: true, canDeleteTask: true } })
    ]);
    renderPage();

    fireEvent.click(await screen.findByTestId('task-card-t-1'));
    const modal = await screen.findByTestId('task-modal');

    expect(within(modal).getByText('Editar')).toBeInTheDocument();
    expect(within(modal).getByTestId('delete-task-button')).toBeInTheDocument();
    expect(within(modal).getByTestId('task-status-select')).not.toBeDisabled();
  });

  it('un ejecutor editando una tarea auto-asignada NO ve el selector de reasignar (solo admin puede reasignar)', async () => {
    mockApi(ejecutor, [
      buildTask({
        assigneeId: 'u-1',
        createdById: 'u-1',
        permissions: { canChangeStatus: true, canAddInfo: true, canEditTask: true, canDeleteTask: true }
      })
    ]);
    renderPage();

    fireEvent.click(await screen.findByTestId('task-card-t-1'));
    const modal = await screen.findByTestId('task-modal');
    fireEvent.click(within(modal).getByText('Editar'));

    expect(await within(modal).findByTestId('edit-assignee-readonly')).toBeInTheDocument();
    expect(within(modal).queryByTestId('edit-assignee-select')).not.toBeInTheDocument();
  });

  it('el admin editando una tarea SÍ ve el selector de reasignar', async () => {
    mockApi(admin, [
      buildTask({ permissions: { canChangeStatus: true, canAddInfo: true, canEditTask: true, canDeleteTask: true } })
    ]);
    renderPage();

    fireEvent.click(await screen.findByTestId('task-card-t-1'));
    const modal = await screen.findByTestId('task-modal');
    fireEvent.click(within(modal).getByText('Editar'));

    expect(await within(modal).findByTestId('edit-assignee-select')).toBeInTheDocument();
    expect(within(modal).queryByTestId('edit-assignee-readonly')).not.toBeInTheDocument();
  });
});
