import { useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { CalendarioView } from './CalendarioView';
import { CatalogoSalasView } from './CatalogoSalasView';
import { MisReservasView } from './MisReservasView';

type Vista = 'calendario' | 'mis-reservas' | 'catalogo';

/**
 * Contenedor principal de Reserva de Salas (spec-tecnica.md "Frontend"):
 * UNA sola página con vistas internas conmutadas por estado — mismo shape
 * que el prototipo original (`prototype.html`), a diferencia de
 * `incidencias-aula` que reparte cada rol en su propia ruta. La vista
 * "Catálogo" solo existe para `recepcion` (gate funcional, decisión 4); el
 * backend ya rechaza con 403 cualquier intento de un empleado de escribir
 * en el catálogo — esto es solo UX, no el control de seguridad.
 */
export function ReservaSalasPage() {
  const { user } = useAuth();
  const isRecepcion = user?.roles.includes('recepcion') ?? false;
  const [vista, setVista] = useState<Vista>('calendario');

  if (!user) return null;

  const tabs: { id: Vista; label: string }[] = [
    { id: 'calendario', label: 'Reservar' },
    { id: 'mis-reservas', label: isRecepcion ? 'Todas las reservas' : 'Mis reservas' },
    ...(isRecepcion ? [{ id: 'catalogo' as const, label: 'Salas' }] : [])
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-white">
          Reserva de Salas <span className="text-awk-cyan-400">·</span> {user.displayName}
        </h1>
        <p className="mt-2 text-sm text-awk-blue-300">
          {isRecepcion
            ? 'Gestiona reservas y el catálogo de salas de todo el equipo.'
            : 'Reserva una sala de reunión y consulta tus reservas.'}
        </p>
      </header>

      <nav className="flex gap-1 border-b border-awk-blue-800" data-testid="reserva-salas-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setVista(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              vista === tab.id
                ? 'border-awk-cyan-400 text-white'
                : 'border-transparent text-awk-blue-400 hover:text-awk-blue-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {vista === 'calendario' && <CalendarioView isRecepcion={isRecepcion} currentUserName={user.displayName} />}
      {vista === 'mis-reservas' && <MisReservasView isRecepcion={isRecepcion} />}
      {vista === 'catalogo' && isRecepcion && <CatalogoSalasView />}
    </div>
  );
}
