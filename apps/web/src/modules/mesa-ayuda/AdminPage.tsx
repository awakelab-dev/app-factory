import { useState } from 'react';

/**
 * Página de administración de Mesa de Ayuda: configuración de departamentos,
 * SLAs, temas, agentes, respuestas preformuladas y KB (stub funcional).
 */
export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'slas' | 'topics' | 'agents' | 'kb' | 'external-users'>('departments');

  const tabs = [
    { id: 'departments', label: 'Departamentos' },
    { id: 'slas', label: 'SLAs' },
    { id: 'topics', label: 'Temas' },
    { id: 'agents', label: 'Agentes' },
    { id: 'kb', label: 'Base de Conocimiento' },
    { id: 'external-users', label: 'Usuarios Externos' }
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Administración</h1>
        <p className="text-gray-600">Configuración de Mesa de Ayuda</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => setActiveTab(tab.id as any)}
              className={`border-b-2 py-4 px-1 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="rounded-lg bg-white p-6 shadow">
        {activeTab === 'departments' && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">Departamentos</h2>
            <p className="text-gray-600">Gestión de departamentos de soporte (stub funcional)</p>
            <div className="mt-4 rounded border border-dashed border-gray-300 bg-gray-50 p-8">
              <p className="text-center text-gray-500">
                Formulario de creación/edición de departamentos estará aquí
              </p>
            </div>
          </div>
        )}

        {activeTab === 'slas' && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">SLAs</h2>
            <p className="text-gray-600">Configuración de tiempos de respuesta y resolución (stub funcional)</p>
            <div className="mt-4 rounded border border-dashed border-gray-300 bg-gray-50 p-8">
              <p className="text-center text-gray-500">
                Tabla de SLAs por departamento y prioridad estará aquí
              </p>
            </div>
          </div>
        )}

        {activeTab === 'topics' && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">Temas de Soporte</h2>
            <p className="text-gray-600">Gestión de categorías de soporte (stub funcional)</p>
            <div className="mt-4 rounded border border-dashed border-gray-300 bg-gray-50 p-8">
              <p className="text-center text-gray-500">
                Formulario y listado de temas estará aquí
              </p>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">Agentes</h2>
            <p className="text-gray-600">Asignación de agentes a departamentos (stub funcional)</p>
            <div className="mt-4 rounded border border-dashed border-gray-300 bg-gray-50 p-8">
              <p className="text-center text-gray-500">
                Tabla de agentes asignados estará aquí
              </p>
            </div>
          </div>
        )}

        {activeTab === 'kb' && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">Base de Conocimiento</h2>
            <p className="text-gray-600">Gestión de artículos y respuestas preformuladas (stub funcional)</p>
            <div className="mt-4 rounded border border-dashed border-gray-300 bg-gray-50 p-8">
              <p className="text-center text-gray-500">
                Formulario y listado de KB estará aquí
              </p>
            </div>
          </div>
        )}

        {activeTab === 'external-users' && (
          <div>
            <h2 className="mb-4 text-xl font-bold text-gray-900">Usuarios Externos</h2>
            <p className="text-gray-600">Gestión de solicitantes externos de Mesa de Ayuda (change-2)</p>
            <div className="mt-4 space-y-4">
              <button className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg font-medium transition">
                + Nuevo Usuario Externo
              </button>
              <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-8">
                <p className="text-center text-gray-500">
                  Tabla de usuarios externos con acciones (activar/desactivar, reset de contraseña, auditoría) estará aquí
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
