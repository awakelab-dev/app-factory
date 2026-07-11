import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HelloResponse } from '@awk/types';
import { App } from './App';

const helloFixture: HelloResponse = {
  service: 'awk-api',
  message: 'Hola desde el test',
  timestamp: new Date('2026-07-11T12:00:00Z').toISOString()
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('muestra la respuesta tipada de la API', async () => {
    mockFetchOnce(helloFixture);
    render(<App />);
    expect(await screen.findByTestId('hello-ok')).toBeInTheDocument();
    expect(screen.getByText('Hola desde el test')).toBeInTheDocument();
  });

  it('muestra error si la respuesta no cumple el contrato', async () => {
    mockFetchOnce({ cualquier: 'cosa' });
    render(<App />);
    expect(await screen.findByTestId('hello-error')).toBeInTheDocument();
  });

  it('muestra error si la API no responde', async () => {
    mockFetchOnce({}, false, 500);
    render(<App />);
    expect(await screen.findByTestId('hello-error')).toBeInTheDocument();
  });
});
