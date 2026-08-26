import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicketRequestSchema, type Department, type HelpTopic } from './mesa-ayuda.types';
import { createTicket, listDepartments, listHelpTopics } from './mesa-ayuda-api';

/**
 * Página pública para crear un nuevo ticket de soporte (sin login).
 * El solicitante proporciona email, nombre, tema y descripción.
 * Recibe un sessionToken para ver su ticket sin login.
 */
export function NewTicketPage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    departmentId: '',
    topicId: '',
    subject: '',
    requestorEmail: '',
    requestorName: '',
    description: '',
    priority: 'media' as const
  });

  // Cargar departamentos al montar
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await listDepartments();
        setDepartments(depts);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {
        setError('Error al cargar departamentos');
      }
    };
    loadDepartments();
  }, []);

  // Cargar temas cuando cambia el departamento
  useEffect(() => {
    if (formData.departmentId) {
      const loadTopics = async () => {
        try {
          const topicsList = await listHelpTopics(formData.departmentId);
          setTopics(topicsList);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_err) {
          setError('Error al cargar temas');
        }
      };
      loadTopics();
    }
  }, [formData.departmentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar con Zod
      const validData = createTicketRequestSchema.parse(formData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createTicket(validData as any);

      setSuccess(true);
      setSessionToken(result.sessionToken);

      // Redirigir a vista del ticket después de 2s
      setTimeout(() => {
        navigate(`/mesa-ayuda/tickets/${result.id}?sessionToken=${result.sessionToken}`);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Error al crear ticket');
    } finally {
      setLoading(false);
    }
  };

  if (success && sessionToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h2 className="mb-4 text-2xl font-semibold text-green-600">Ticket Creado Exitosamente</h2>
          <p className="mb-4 text-gray-700">
            Tu ticket ha sido creado. Te estamos redirigiendo a la página de detalles...
          </p>
          <p className="text-sm text-gray-500">Guarda tu token de sesión para referencias futuras:</p>
          <code className="mt-2 block rounded bg-gray-100 p-2 text-xs text-gray-800">{sessionToken}</code>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Crear Nuevo Ticket</h1>
          <p className="mb-6 text-gray-600">
            Describe tu problema y nos pondremos en contacto lo antes posible.
          </p>

          {error && <div className="mb-4 rounded bg-red-100 p-4 text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Datos del solicitante */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                <input
                  type="text"
                  name="requestorName"
                  value={formData.requestorName}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  name="requestorEmail"
                  value={formData.requestorEmail}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  required
                />
              </div>
            </div>

            {/* Categorización */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Departamento *</label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  required
                >
                  <option value="">Selecciona un departamento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tema *</label>
                <select
                  name="topicId"
                  value={formData.topicId}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                  required
                  disabled={!formData.departmentId}
                >
                  <option value="">Selecciona un tema</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Prioridad</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            {/* Asunto */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Asunto *</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                maxLength={300}
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                rows={6}
                required
              />
            </div>

            {/* Botones */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded bg-blue-600 py-2 px-4 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Ticket'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 rounded border border-gray-300 py-2 px-4 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
