import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, CoreRole, CoreUser } from '@awk/types';
import { AuthProvider } from '../../auth/auth-context';
import { UsersPage } from './UsersPage';

const adminFixture: AuthUser = {
  id: 'u-admin',
  email: 'admin@awakelab.dev',
  displayName: 'Admin Demo',
  roles: ['admin']
};

const usersFixture: CoreUser[] = [
  {
    id: 'u-admin',
    email: 'admin@awakelab.dev',
    displayName: 'Admin Demo',
    isActive: true,
    roles: ['admin'],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'u-2',
    email: 'sin.roles@awakelab.dev',
    displayName: 'Sin Roles',
    isActive: true,
    roles: [],
    createdAt: '2026-01-02T00:00:00.000Z'
  }
];

// Los dos roles que en D-049 hubo que crear y asignar por SQL a mano.
const rolesFixture: CoreRole[] = [
  { name: 'admin', description: 'Administración de la plataforma', usersCount: 1 },
  { name: 'empleado', description: 'Sembrado automáticamente desde @Roles() en ReservaSalasController', usersCount: 0 },
  { name: 'recepcion', description: 'Sembrado automáticamente desde @Roles() en ReservaSalasController', usersCount: 0 }
];

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(putHandler?: (body: unknown) => Promise<unknown>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/auth/me')) return ok(adminFixture);
    if (url.endsWith('/api/core/users')) return ok(usersFixture);
    if (url.endsWith('/api/core/roles')) return ok(rolesFixture);
    if (url.endsWith('/api/core/users/u-2/roles') && init?.method === 'PUT') {
      if (putHandler) return putHandler(JSON.parse(String(init.body)));
      return ok({ ...usersFixture[1], roles: ['empleado', 'recepcion'] });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
}

function renderPage() {
  return render(
    <AuthProvider>
      <UsersPage />
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

describe('UsersPage (asignación de roles sin SQL — incremento D, bloque 2)', () => {
  it('lista usuarios con sus roles y marca a quien no tiene ninguno', async () => {
    vi.stubGlobal('fetch', mockApi());
    renderPage();
    expect(await screen.findByTestId('users-table')).toBeInTheDocument();
    expect(screen.getByText('Admin Demo')).toBeInTheDocument();
    expect(screen.getByText('sin roles')).toBeInTheDocument();
  });

  it('asigna los roles de un módulo generado y avisa de que hace falta volver a entrar', async () => {
    const fetchMock = mockApi();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    await screen.findByTestId('users-table');

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar roles' })[1]!);
    const editor = await screen.findByTestId('roles-editor-u-2');
    expect(editor).toBeInTheDocument();
    // Sin cambios todavía, no se puede guardar.
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /empleado/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /recepcion/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const notice = await screen.findByTestId('roles-notice');
    expect(notice.textContent).toContain('volver a iniciar sesión');
    // El PUT lleva el conjunto COMPLETO de roles, no un parche.
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({ roles: ['empleado', 'recepcion'] });
    // Y la fila se refresca con lo que devolvió la API.
    await waitFor(() => expect(screen.queryByTestId('roles-editor-u-2')).not.toBeInTheDocument());
    expect(screen.queryByText('sin roles')).not.toBeInTheDocument();
  });

  it('si el rol no existe en la BD, muestra el error de la API y deja el editor abierto', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi(() => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) }))
    );
    renderPage();
    await screen.findByTestId('users-table');
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar roles' })[1]!);
    await screen.findByTestId('roles-editor-u-2');
    fireEvent.click(screen.getByRole('checkbox', { name: /empleado/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByTestId('roles-save-error')).toBeInTheDocument();
    expect(screen.getByTestId('roles-editor-u-2')).toBeInTheDocument();
  });

  it('si la carga falla, lo dice en vez de quedarse en blanco', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).endsWith('/api/auth/me')
          ? ok(adminFixture)
          : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
      )
    );
    renderPage();
    expect(await screen.findByTestId('users-error')).toBeInTheDocument();
  });
});
