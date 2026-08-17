import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/auth-context';
import { accessibleModules, homePathFor, publicModuleRoutes } from './modules/registry';
import { Layout } from './shell/Layout';
import { LoginPage } from './shell/LoginPage';

/**
 * Rutas públicas (D-027): cualquier módulo puede declarar `publicRoutes` en su
 * ModuleRegistration para exponer pantallas sin login (p.ej. la landing de
 * candidato de orientador-ia). Se calculan una sola vez y se inyectan en las
 * tres ramas de abajo (loading/anónimo/autenticado) para que coincidan
 * SIEMPRE, sin importar el estado de la sesión — la asunción "todo detrás de
 * RBAC" (D-011) sigue siendo el default para cualquier módulo que no declare
 * rutas públicas explícitamente.
 */
function publicRouteElements() {
  return publicModuleRoutes().map((route) => (
    <Route key={route.path} path={route.path} element={route.element} />
  ));
}

function AppRoutes() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <Routes>
        {publicRouteElements()}
        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center bg-awk-navy-900 font-sans text-awk-blue-300">
              Cargando sesión…
            </div>
          }
        />
      </Routes>
    );
  }

  if (!user) {
    return (
      <Routes>
        {publicRouteElements()}
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Menú y rutas salen de los module.manifest, filtrados por los roles del usuario.
  const registrations = accessibleModules(user);
  // Portada declarada en el registry (no "el primer ítem del menú"): con el
  // descubrimiento automático de módulos, eso último cambiaría solo en cuanto
  // la Fábrica generase un módulo que ordenase antes alfabéticamente.
  const home = homePathFor(user);

  return (
    <Routes>
      {publicRouteElements()}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout user={user} />}>
        {registrations.flatMap((mod) =>
          mod.routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))
        )}
        <Route
          index
          element={
            home ? (
              <Navigate to={home} replace />
            ) : (
              <p className="text-awk-blue-300">No tienes módulos asignados todavía.</p>
            )
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={home ?? '/'} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
