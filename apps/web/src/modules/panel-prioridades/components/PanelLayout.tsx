import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Barra de pestañas del módulo: las cinco pantallas de `index.tsx` viven bajo
 * una sola entrada del menú del shell (`module.manifest.ts`), así que la
 * navegación entre ellas tiene que estar AQUÍ. Sin esto, cuatro de las cinco
 * rutas solo se abren escribiendo la URL a mano — que es exactamente lo que le
 * pasaba al módulo al llegar a staging (D-058).
 *
 * `end` solo en la raíz (`/panel-prioridades`): sin él, NavLink marca activa la
 * raíz también en las subrutas y se iluminan dos pestañas a la vez (misma
 * lección que el `NavEntry` del shell, `apps/web/src/shell/Layout.tsx`).
 */
const PESTANAS: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/panel-prioridades', label: 'Matriz', end: true },
  { to: '/panel-prioridades/week', label: 'Semana' },
  { to: '/panel-prioridades/delegations', label: 'Delegadas' },
  { to: '/panel-prioridades/metrics', label: 'Indicadores' },
  { to: '/panel-prioridades/team', label: 'Equipo' }
];

export function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav aria-label="Panel de Prioridades" className="flex flex-wrap gap-1 border-b border-awk-blue-700">
        {PESTANAS.map((pestana) => (
          <NavLink
            key={pestana.to}
            to={pestana.to}
            end={pestana.end ?? false}
            className={({ isActive }) =>
              `border-b-2 px-4 py-3 text-sm transition ${
                isActive
                  ? 'border-awk-cyan-400 font-medium text-awk-cyan-300'
                  : 'border-transparent text-awk-blue-300 hover:text-awk-blue-50'
              }`
            }
          >
            {pestana.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
