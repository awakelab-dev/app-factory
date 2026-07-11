import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@awk/ui';
import { useAuth } from '../auth/auth-context';

/**
 * Login de desarrollo (solo email, contra usuarios sembrados). Se sustituirá
 * por el flujo SSO cuando se decida el IdP (ver bloqueo en docs/STATUS.md).
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim());
      navigate('/', { replace: true });
    } catch {
      setError('No se pudo iniciar sesión. ¿El email está sembrado y la API levantada?');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-awk-navy-900 font-sans"
      data-testid="login-page"
    >
      <div className="w-full max-w-sm rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-8">
        <img
          src="https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-oscuro_transparente.png"
          alt="Awakelab"
          className="mx-auto h-10"
        />
        <h1 className="mt-6 text-center text-xl font-semibold text-white">AwkPlatform</h1>
        <p className="mt-1 text-center text-sm text-awk-blue-300">
          Acceso de desarrollo (sin IdP todavía)
        </p>

        <form className="mt-6" onSubmit={(event) => void onSubmit(event)}>
          <label className="block text-sm text-awk-blue-100" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="leonardo.barreto@awakelab.dev"
            className="mt-1 w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-awk-blue-50 placeholder:text-awk-blue-500 focus:border-awk-cyan-500 focus:outline-none"
          />

          {error && (
            <p className="mt-3 text-sm text-red-400" data-testid="login-error">
              {error}
            </p>
          )}

          <Button className="mt-5 w-full" type="submit" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
