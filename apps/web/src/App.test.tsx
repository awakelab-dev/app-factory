import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, HelloResponse } from '@awk/types';
import { App } from './App';

const helloFixture: HelloResponse = {
  service: 'awk-api',
  message: 'Hola desde el test',
  timestamp: new Date('2026-07-11T12:00:00Z').toISOString()
};

const adminFixture: AuthUser = {
  id: 'u-1',
  email: 'leonardo.barreto@awakelab.dev',
  displayName: 'Leonardo Barreto',
  roles: ['admin']
};

const userFixture: AuthUser = { ...adminFixture, id: 'u-2', roles: ['user'] };

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function mockApi(me: AuthUser) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return ok(me);
      if (url.endsWith('/api/hello')) return ok(helloFixture);
      if (url.endsWith('/api/core/users')) return ok([]);
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    })
  );
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('App (shell)', () => {
  it('sin sesión muestra el login', async () => {
    render(<App />);
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });

  it('con sesión construye el menú desde los manifests y entra al primer módulo', async () => {
    localStorage.setItem('awk.token', 'token-test');
    mockApi(adminFixture);
    render(<App />);

    expect(await screen.findByTestId('shell-nav')).toBeInTheDocument();
    // admin ve el módulo demo, el de administración (core-admin) y moodle-insights (sin requiredRoles)
    expect(screen.getByText('Demo Hello')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Moodle Insights')).toBeInTheDocument();
    // el índice redirige al primer ítem visible: la página del módulo hello
    expect(await screen.findByTestId('hello-ok')).toBeInTheDocument();
  });

  it('un usuario sin rol admin no ve el módulo de administración (moodle-insights sí)', async () => {
    localStorage.setItem('awk.token', 'token-test');
    mockApi(userFixture);
    render(<App />);

    expect(await screen.findByTestId('shell-nav')).toBeInTheDocument();
    expect(screen.getByText('Demo Hello')).toBeInTheDocument();
    expect(screen.getByText('Moodle Insights')).toBeInTheDocument();
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
  });

  it('con token inválido (401 en /me) vuelve al login', async () => {
    localStorage.setItem('awk.token', 'caducado');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
    );
    render(<App />);
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(localStorage.getItem('awk.token')).toBeNull();
  });

  it('una ruta pública (D-027, landing de orientador-ia) se ve sin sesión, sin caer al login', async () => {
    window.history.replaceState({}, '', '/orientador-ia');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/orientador-ia/academies')) return ok([]);
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      })
    );
    render(<App />);

    expect(await screen.findByTestId('orientador-candidate-page')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });
});
