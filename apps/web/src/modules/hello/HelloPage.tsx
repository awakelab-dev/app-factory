import { useCallback, useEffect, useState } from 'react';
import { helloResponseSchema, type HelloResponse } from '@awk/types';
import { Button } from '@awk/ui';
import { apiFetch } from '../../lib/api';

type HelloState =
  | { status: 'loading' }
  | { status: 'ok'; data: HelloResponse }
  | { status: 'error'; detail: string };

/** Demo de Fase 0: el mismo schema Zod valida la respuesta en api y web. */
export function HelloPage() {
  const [hello, setHello] = useState<HelloState>({ status: 'loading' });

  const fetchHello = useCallback(async () => {
    setHello({ status: 'loading' });
    try {
      const data = await apiFetch('/api/hello', helloResponseSchema);
      setHello({ status: 'ok', data });
    } catch (err) {
      setHello({ status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    void fetchHello();
  }, [fetchHello]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold text-white">
        Demo Hello <span className="text-awk-cyan-400">·</span> contrato tipado
      </h1>
      <p className="mt-2 text-awk-blue-300">
        Respuesta del backend validada con el schema compartido de{' '}
        <code className="text-awk-cyan-100">@awk/types</code>.
      </p>

      <section className="mt-8 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-6">
        {hello.status === 'loading' && <p className="text-awk-blue-300">Llamando a la API…</p>}

        {hello.status === 'ok' && (
          <div data-testid="hello-ok">
            <p className="text-lg text-awk-cyan-300">{hello.data.message}</p>
            <p className="mt-2 text-sm text-awk-blue-300">
              {hello.data.service} · {new Date(hello.data.timestamp).toLocaleString('es-ES')}
            </p>
          </div>
        )}

        {hello.status === 'error' && (
          <p className="text-red-400" data-testid="hello-error">
            Sin respuesta de la API ({hello.detail}). ¿Está levantada? <code>pnpm dev</code> en{' '}
            <code>apps/api</code>.
          </p>
        )}

        <Button className="mt-6" onClick={() => void fetchHello()}>
          Reintentar
        </Button>
      </section>
    </div>
  );
}
