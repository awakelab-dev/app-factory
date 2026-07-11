import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@awk/ui';
import type { AuthUser } from '@awk/types';
import { useAuth } from '../auth/auth-context';
import { visibleNav } from '../modules/registry';

/**
 * Shell de la plataforma: sidebar con el menú construido desde los
 * module.manifest (filtrado por roles) y el área de contenido con las rutas.
 */
export function Layout({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const nav = visibleNav(user);

  return (
    <div className="flex min-h-screen bg-awk-navy-900 font-sans text-awk-blue-50">
      <aside className="flex w-64 flex-col border-r border-awk-blue-800 bg-awk-navy-800">
        <div className="border-b border-awk-blue-800 px-6 py-5">
          <img
            src="https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-oscuro_transparente.png"
            alt="Awakelab"
            className="h-8"
          />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" data-testid="shell-nav">
          {nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-awk-blue-700 text-awk-cyan-300'
                    : 'text-awk-blue-100 hover:bg-awk-blue-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-awk-blue-800 px-6 py-4">
          <p className="truncate text-sm text-awk-blue-100">{user.displayName}</p>
          <p className="truncate text-xs text-awk-blue-400">{user.email}</p>
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 px-10 py-12">
        <Outlet />
      </main>
    </div>
  );
}
