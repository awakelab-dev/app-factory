import { useCallback, useEffect, useState } from 'react';
import { helloResponseSchema, type HelloResponse } from '@awk/types';
import { Button } from '@awk/ui';

type HelloState =
  | { status: 'loading' }
  | { status: 'ok'; data: HelloResponse }
  | { status: 'error'; detail: string };

export function App() {
  const [hello, setHello] = useState<HelloState>({ status: 'loading' });

  const fetchHello = useCallback(async () => {
    setHello({ status: 'loading' });
    try {
      const res = await fetch('/api/hello');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // El mismo schema Zod que valida la respuesta en la API la valida aquí:
      // contrato tipado end-to-end, sin `any` por el camino.
      const data = helloResponseSchema.parse(await res.json());
      setHello({ status: 'ok', data });
    } catch (err) {
      setHello({ status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    void fetchHello();
  }, [fetchHello]);

  return (
    <div className="min-h-screen bg-awk-navy-900 font-sans text-awk-blue-50">
      <header className="border-b border-awk-blue-800 px-8 py-5">
        <img
          src="https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-oscuro_transparente.png"
          alt="Awakelab"
          className="h-10"
        />
      </header>

      <main className="mx-auto max-w-2xl px-8 py-16">
        <h1 className="text-3xl font-semibold text-white">
          AwkPlatform <span className="text-awk-cyan-400">·</span> Fase 0
        </h1>
        <p className="mt-2 text-awk-blue-300">
          Shell de la plataforma modular. Abajo, la respuesta del backend validada con el contrato
          compartido de <code className="text-awk-cyan-100">@awk/types</code>.
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
      </main>
    </div>
  );
}
