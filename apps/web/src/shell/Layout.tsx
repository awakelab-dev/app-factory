import {
  ChevronDown,
  ChevronRight,
  Compass,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@awk/ui';
import type { AuthUser, NavItem } from '@awk/types';
import { useAuth } from '../auth/auth-context';
import { visibleNavGroups, type NavGroup } from '../modules/registry';

/** Módulos "de sistema": van al final del sidebar, tras un separador
 * (pedido de Leonardo 2026-07-19) — Fábrica penúltima, Administración última
 * (el orden entre ellos lo da el registry). */
const SYSTEM_MODULE_IDS = new Set(['factory-console', 'core-admin']);

/**
 * Registro de iconos de sidebar (estilo consola AWS: un icono por app/módulo).
 * Los manifests solo declaran el NOMBRE (string serializable, ver @awk/types);
 * cada módulo nuevo añade su icono aquí. LayoutGrid es el fallback si el
 * manifest no declara icono o declara uno que el shell no reconoce todavía.
 */
const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Compass,
  Timer,
  ListTodo,
  LayoutDashboard,
  TrendingUp,
  Settings
};

function NavIcon({ name }: { name?: string }) {
  const Icon = (name && NAV_ICONS[name]) || LayoutGrid;
  return <Icon className="h-4 w-4 shrink-0" />;
}

function SidebarGroup({
  group,
  collapsed,
  onToggle
}: {
  group: NavGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <div className="pt-3 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between rounded px-3 pb-1 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-awk-blue-400 transition-colors hover:text-awk-cyan-300"
      >
        {group.moduleName}
        <Chevron className="h-3.5 w-3.5 shrink-0" />
      </button>
      {!collapsed && (
        <div className="space-y-1">
          {group.items.map((item) => (
            <NavEntry key={item.path} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavEntry({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      // end en las rutas raíz de módulo (/focus-flow): sin esto, NavLink
      // marca activa la raíz también en las subrutas (/focus-flow/tasks) y
      // se iluminan dos ítems del grupo a la vez.
      end={item.path.split('/').filter(Boolean).length === 1}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive ? 'bg-awk-blue-700 text-awk-cyan-300' : 'text-awk-blue-100 hover:bg-awk-blue-800'
        }`
      }
    >
      <NavIcon name={item.icon} />
      {item.label}
    </NavLink>
  );
}

/**
 * Shell de la plataforma: sidebar con el menú construido desde los
 * module.manifest (filtrado por roles) y el área de contenido con las rutas.
 */
export function Layout({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const navGroups = visibleNavGroups(user);
  const projectGroups = navGroups.filter((group) => !SYSTEM_MODULE_IDS.has(group.moduleId));
  const systemGroups = navGroups.filter((group) => SYSTEM_MODULE_IDS.has(group.moduleId));
  // Colapso por módulo, todo desplegado por defecto (solo estado de UI en
  // memoria: se reinicia al recargar, deliberadamente sin persistencia).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (moduleId: string) =>
    setCollapsed((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));

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

        {/* Ítems agrupados por módulo (pedido de Leonardo 2026-07-19): cada
            módulo lleva SIEMPRE su nombre como cabecera colapsable (aunque
            redunde con su único ítem — preferible a que parezca de otra
            jerarquía), todos desplegados por defecto. Los módulos de sistema
            (Fábrica, Administración) van al final tras un separador. */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" data-testid="shell-nav">
          {projectGroups.map((group) => (
            <SidebarGroup
              key={group.moduleId}
              group={group}
              collapsed={Boolean(collapsed[group.moduleId])}
              onToggle={() => toggleGroup(group.moduleId)}
            />
          ))}
          {systemGroups.length > 0 && <div className="my-3 border-t border-awk-blue-800" aria-hidden="true" />}
          {systemGroups.map((group) => (
            <SidebarGroup
              key={group.moduleId}
              group={group}
              collapsed={Boolean(collapsed[group.moduleId])}
              onToggle={() => toggleGroup(group.moduleId)}
            />
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
