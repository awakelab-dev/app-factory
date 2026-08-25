import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTicketRequestSchema, type Department, type HelpTopic } from './mesa-ayuda.types';
import { createTicket, listDepartments, listHelpTopics } from './mesa-ayuda-api';

/**
 * Alta de una petición de soporte. Va tras el login: el nombre y el correo del
 * solicitante los pone el backend a partir del usuario autenticado, así que el
 * formulario solo pide el tema y el problema.
 */
export function NewTicketPage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    departmentId: '',
    topicId: '',
    subject: '',
    description: '',
    priority: 'media' as const
  });

  // Cargar departamentos al montar
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await listDepartments();
        // Un departamento dado de baja sigue existiendo para los tickets
        // antiguos, pero no debe ofrecerse para abrir peticiones nuevas.
        setDepartments(depts.filter((d) => d.isActive));
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

      // Redirigir a vista del ticket después de 2s
      setTimeout(() => {
        navigate(`/mesa-ayuda/tickets/${result.id}`);
      }, 2000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Error al crear ticket');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h2 className="mb-4 text-2xl font-semibold text-green-600">Petición creada</h2>
          <p className="text-gray-700">
            Ya la tenemos. Te llevamos al detalle para que sigas su estado…
          </p>
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

          {departments.length === 0 && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Todavía no hay departamentos configurados, así que no se puede abrir una petición.
              Un administrador de la Mesa de Ayuda tiene que crear al menos un departamento y un
              tema de ayuda desde <strong>Mesa de Ayuda · Administración</strong>.
            </div>
          )}

          {departments.length > 0 && formData.departmentId !== '' && topics.length === 0 && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              Este departamento no tiene todavía ningún tema de ayuda. Elige otro o pide a un
              administrador que dé de alta uno.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
