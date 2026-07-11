import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/auth-context';
import { accessibleModules, visibleNav } from './modules/registry';
import { Layout } from './shell/Layout';
import { LoginPage } from './shell/LoginPage';

function AppRoutes() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-awk-navy-900 font-sans text-awk-blue-300">
        Cargando sesión…
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  // Menú y rutas salen de los module.manifest, filtrados por los roles del usuario.
  const registrations = accessibleModules(user);
  const home = visibleNav(user)[0]?.path;

  return (
    <Routes>
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
        <Route path="*" element={<Navigate to={home ?? '/'} replace />} />
      </Route>
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
