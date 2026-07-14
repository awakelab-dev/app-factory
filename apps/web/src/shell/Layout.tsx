import { GraduationCap, LayoutGrid, ShieldCheck, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@awk/ui';
import type { AuthUser } from '@awk/types';
import { useAuth } from '../auth/auth-context';
import { visibleNav } from '../modules/registry';

/**
 * Registro de iconos de sidebar (estilo consola AWS: un icono por app/módulo).
 * Los manifests solo declaran el NOMBRE (string serializable, ver @awk/types);
 * cada módulo nuevo añade su icono aquí. LayoutGrid es el fallback si el
 * manifest no declara icono o declara uno que el shell no reconoce todavía.
 */
const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Sparkles,
  ShieldCheck,
  GraduationCap
};

function NavIcon({ name }: { name?: string }) {
  const Icon = (name && NAV_ICONS[name]) || LayoutGrid;
  return <Icon className="h-4 w-4 shrink-0" />;
}

/**
 * Shell de la plataforma: sidebar con el menú construido desde los
 * module.manifest (filtrado por roles) y el área de contenido con las rutas.
 */
export function Layout({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const nav = visibleNav(user);

  return (
    // h-screen (no min-h-screen) + overflow-hidden: el layout queda anclado
    // al viewport y es <main> el que scrollea su propio contenido — así el
    // sidebar (incluida la tarjeta de usuario/logout al fondo) no se arrastra
    // con el alto de la página cuando el contenido es más largo que la
    // pantalla.
    <div className="flex h-screen overflow-hidden bg-awk-navy-900 font-sans text-awk-blue-50">
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-awk-blue-800 bg-awk-navy-800">
        <div className="shrink-0 border-b border-awk-blue-800 px-6 py-5">
          <img
            src="https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-oscuro_transparente.png"
            alt="Awakelab"
            className="h-8"
          />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" data-testid="shell-nav">
          {nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-awk-blue-700 text-awk-cyan-300'
                    : 'text-awk-blue-100 hover:bg-awk-blue-800'
                }`
              }
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-awk-blue-800 px-6 py-4">
          <p className="truncate text-sm text-awk-blue-100">{user.displayName}</p>
          <p className="truncate text-xs text-awk-blue-400">{user.email}</p>
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-10 py-12">
        <Outlet />
      </main>
    </div>
  );
}
