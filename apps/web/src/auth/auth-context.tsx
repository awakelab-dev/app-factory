import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '@awk/types';
import { authUserSchema, devLoginResponseSchema } from '@awk/types';
import { apiFetch, getToken, setToken } from '../lib/api';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** dev-login por email (temporal hasta que haya IdP, ver STATUS del repo). */
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // Al cargar: si hay token guardado, revalidar contra la API.
  useEffect(() => {
    if (!getToken()) {
      setStatus('anonymous');
      return;
    }
    apiFetch('/api/auth/me', authUserSchema)
      .then((me) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        setToken(null);
        setStatus('anonymous');
      });
  }, []);

  const login = useCallback(async (email: string) => {
    const session = await apiFetch('/api/auth/dev-login', devLoginResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    setToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
