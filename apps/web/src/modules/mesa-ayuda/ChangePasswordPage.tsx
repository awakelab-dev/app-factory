import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Página para cambiar contraseña temporal en primer acceso.
 * Requiere token provisional en sessionStorage.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 12) errors.push('Mínimo 12 caracteres');
    if (!/[A-Z]/.test(pwd)) errors.push('Debe contener mayúscula');
    if (!/\d/.test(pwd)) errors.push('Debe contener número');
    if (!/[!@#$%^&*]/.test(pwd)) errors.push('Debe contener carácter especial');
    return errors;
  };

  const handlePasswordChange = (pwd: string) => {
    setNewPassword(pwd);
    setValidationErrors(validatePassword(pwd));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const errors = validatePassword(newPassword);
    if (errors.length > 0) {
      setError('La contraseña no cumple con los requisitos');
      return;
    }

    setLoading(true);

    try {
      const provisionalToken = sessionStorage.getItem('mesa_ayuda_provisional_token');
      if (!provisionalToken) {
        throw new Error('Token no encontrado. Por favor, inicia sesión de nuevo');
      }

      const response = await fetch('/api/mesa-ayuda/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provisionalToken}`
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al cambiar contraseña');
      }

      const data = await response.json();

      // Limpiar token provisional y guardar sessionToken
      sessionStorage.removeItem('mesa_ayuda_provisional_token');
      localStorage.setItem('mesa_ayuda_session_token', data.sessionToken);

      navigate('/mesa-ayuda/mis-tickets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2" style={{ fontFamily: 'Poppins' }}>
            Cambiar Contraseña
          </h1>
          <p className="text-gray-600">Elige una contraseña segura</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Nueva Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="••••••••"
              />

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {validationErrors.map((err) => (
                    <li key={err} className="text-xs text-red-600">
                      • {err}
                    </li>
                  ))}
                </ul>
              )}

              {/* Success indicators */}
              {newPassword && validationErrors.length === 0 && (
                <p className="mt-2 text-xs text-green-600">✓ Contraseña válida</p>
              )}
            </div>

            {/* Requirements hint */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-gray-700">
                <strong>Requisitos:</strong>
              </p>
              <ul className="text-xs text-gray-600 mt-1 space-y-1">
                <li>Mínimo 12 caracteres</li>
                <li>Al menos 1 mayúscula (A-Z)</li>
                <li>Al menos 1 número (0-9)</li>
                <li>Al menos 1 carácter especial (!@#$%^&*)</li>
              </ul>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || validationErrors.length > 0}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Cambiando contraseña...' : 'Cambiar y Continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
