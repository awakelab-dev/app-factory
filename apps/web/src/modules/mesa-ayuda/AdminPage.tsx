import { useCallback, useEffect, useState } from 'react';
import { Button } from '@awk/ui';
import type { Department, HelpTopic, SLA, TicketPriority } from './mesa-ayuda.types';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  listHelpTopics,
  createHelpTopic,
  listSLAs,
  createSLA
} from './mesa-ayuda-api';

/**
 * Administración de Mesa de Ayuda: los catálogos que hacen falta para que se
 * pueda abrir un ticket (departamentos y temas de ayuda) y los plazos de
 * servicio.
 *
 * El tema de ayuda es obligatorio al abrir una petición y cuelga de un
 * departamento, así que con las tablas vacías el módulo no se puede usar: es
 * lo primero que hay que rellenar en un entorno nuevo.
 */

type Pestana = 'departamentos' | 'temas' | 'slas' | 'agentes' | 'kb';

const PESTANAS: ReadonlyArray<{ id: Pestana; label: string }> = [
  { id: 'departamentos', label: 'Departamentos' },
  { id: 'temas', label: 'Temas de ayuda' },
  { id: 'slas', label: 'Plazos de servicio' },
  { id: 'agentes', label: 'Agentes' },
  { id: 'kb', label: 'Base de conocimiento' }
];

const PRIORIDADES: ReadonlyArray<TicketPriority> = ['baja', 'media', 'alta', 'urgente'];

const INPUT =
  'mt-1 w-full rounded-lg border border-awk-blue-700 bg-awk-navy-900 px-3 py-2 text-sm text-awk-blue-50';
const ETIQUETA = 'text-sm text-awk-blue-100';

/** Minutos a algo legible: "45 min", "2 h", "3 d". */
function duracion(minutos: number): string {
  if (minutos % 1440 === 0) return `${minutos / 1440} d`;
  if (minutos % 60 === 0) return `${minutos / 60} h`;
  return `${minutos} min`;
}

export function AdminPage() {
  const [pestana, setPestana] = useState<Pestana>('departamentos');

  const [departamentos, setDepartamentos] = useState<Department[]>([]);
  const [temas, setTemas] = useState<HelpTopic[]>([]);
  const [slas, setSlas] = useState<SLA[]>([]);

  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setError(null);
    try {
      const [deps, tps] = await Promise.all([listDepartments(), listHelpTopics()]);
      setDepartamentos(deps);
      setTemas(tps);
      try {
        setSlas(await listSLAs());
      } catch {
        // Listar plazos es solo para administradores del módulo; si no llega,
        // no es motivo para dejar la pantalla entera sin datos.
        setSlas([]);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message ?? 'No se pudieron cargar los catálogos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      await recargar();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message ?? 'La operación no se pudo completar');
    } finally {
      setOcupado(false);
    }
  }

  const nombreDepartamento = (id: string) => departamentos.find((d) => d.id === id)?.name ?? '—';

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-3xl font-bold text-awk-blue-50">Mesa de Ayuda · configuración</h1>
      <p className="mt-2 text-awk-blue-300">
        Departamentos, temas de ayuda y plazos de servicio. Sin al menos un departamento y un tema,
        nadie puede abrir una petición.
      </p>

      <nav className="mt-8 flex flex-wrap gap-1 border-b border-awk-blue-700">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={`border-b-2 px-4 py-3 text-sm transition ${
              pestana === p.id
                ? 'border-awk-cyan-400 font-medium text-awk-cyan-300'
                : 'border-transparent text-awk-blue-300 hover:text-awk-blue-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="mt-8 text-awk-blue-300">Cargando…</p>
      ) : (
        <div className="mt-6">
          {pestana === 'departamentos' && (
            <Departamentos
              departamentos={departamentos}
              ocupado={ocupado}
              onCrear={(datos) => ejecutar(() => createDepartment(datos))}
              onEditar={(id, datos) => ejecutar(() => updateDepartment(id, datos))}
            />
          )}

          {pestana === 'temas' && (
            <Temas
              temas={temas}
              departamentos={departamentos}
              ocupado={ocupado}
              nombreDepartamento={nombreDepartamento}
              onCrear={(datos) => ejecutar(() => createHelpTopic(datos))}
            />
          )}

          {pestana === 'slas' && (
            <Slas
              slas={slas}
              departamentos={departamentos}
              ocupado={ocupado}
              nombreDepartamento={nombreDepartamento}
              onCrear={(datos) => ejecutar(() => createSLA(datos))}
            />
          )}

          {(pestana === 'agentes' || pestana === 'kb') && (
            <p className="rounded-xl border border-dashed border-awk-blue-700 p-8 text-center text-sm text-awk-blue-300">
              {pestana === 'agentes'
                ? 'La asignación de agentes a departamentos todavía no tiene pantalla propia. Los roles de la plataforma se reparten desde Administración · Usuarios.'
                : 'La edición de artículos de la base de conocimiento todavía no tiene pantalla propia.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Departamentos                                                              */
/* -------------------------------------------------------------------------- */

function Departamentos({
  departamentos,
  ocupado,
  onCrear,
  onEditar
}: {
  departamentos: Department[];
  ocupado: boolean;
  onCrear: (datos: { name: string; description?: string }) => void;
  onEditar: (
    id: string,
    datos: { name?: string; description?: string | null; isActive?: boolean }
  ) => void;
}) {
  const [nuevo, setNuevo] = useState<{ name: string; description: string } | null>(null);
  const [editando, setEditando] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-awk-blue-50">Departamentos</h2>
        {!nuevo && (
          <Button size="sm" onClick={() => setNuevo({ name: '', description: '' })} disabled={ocupado}>
            Nuevo departamento
          </Button>
        )}
      </div>

      {nuevo && (
        <div className="mt-4 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={ETIQUETA}>
              Nombre
              <input
                type="text"
                className={INPUT}
                value={nuevo.name}
                onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })}
                placeholder="Soporte TI"
                maxLength={100}
              />
            </label>
            <label className={ETIQUETA}>
              Descripción
              <input
                type="text"
                className={INPUT}
                value={nuevo.description}
                onChange={(e) => setNuevo({ ...nuevo, description: e.target.value })}
                placeholder="Accesos, equipos y red del personal interno"
                maxLength={500}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              disabled={ocupado || nuevo.name.trim().length === 0}
              onClick={() => {
                onCrear({
                  name: nuevo.name.trim(),
                  description: nuevo.description.trim() || undefined
                });
                setNuevo(null);
              }}
            >
              {ocupado ? 'Guardando…' : 'Crear'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNuevo(null)} disabled={ocupado}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-awk-blue-700">
        <div className="overflow-x-auto">
          <table className="w-full bg-awk-navy-800 text-left text-sm">
            <thead>
              <tr className="border-b border-awk-blue-700 text-awk-blue-300">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="w-full px-4 py-3 font-medium">Descripción</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-medium">Estado</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-medium sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {departamentos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-awk-blue-300">
                    Todavía no hay departamentos. Crea el primero para poder dar de alta temas de
                    ayuda.
                  </td>
                </tr>
              )}
              {departamentos.map((d) => {
                const enEdicion = editando?.id === d.id;
                return (
                  <tr key={d.id} className="border-b border-awk-blue-800 align-top last:border-0">
                    <td className="px-4 py-3 text-awk-blue-50">
                      {enEdicion ? (
                        <input
                          type="text"
                          className={INPUT}
                          value={editando.name}
                          onChange={(e) => setEditando({ ...editando, name: e.target.value })}
                          maxLength={100}
                        />
                      ) : (
                        d.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-awk-blue-300">
                      {enEdicion ? (
                        <input
                          type="text"
                          className={INPUT}
                          value={editando.description}
                          onChange={(e) => setEditando({ ...editando, description: e.target.value })}
                          maxLength={500}
                        />
                      ) : (
                        d.description || '—'
                      )}
                    </td>
                    <td className="w-px whitespace-nowrap px-4 py-3">
                      <span className={d.isActive ? 'text-awk-cyan-400' : 'text-awk-blue-400'}>
                        {d.isActive ? 'activo' : 'inactivo'}
                      </span>
                    </td>
                    <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                      {enEdicion ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={ocupado || editando.name.trim().length === 0}
                            onClick={() => {
                              onEditar(d.id, {
                                name: editando.name.trim(),
                                description: editando.description.trim() || null
                              });
                              setEditando(null);
                            }}
                          >
                            Guardar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditando(null)}
                            disabled={ocupado}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={ocupado}
                            onClick={() =>
                              setEditando({
                                id: d.id,
                                name: d.name,
                                description: d.description ?? ''
                              })
                            }
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={ocupado}
                            onClick={() => onEditar(d.id, { isActive: !d.isActive })}
                          >
                            {d.isActive ? 'Desactivar' : 'Reactivar'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Temas de ayuda                                                             */
/* -------------------------------------------------------------------------- */

function Temas({
  temas,
  departamentos,
  ocupado,
  nombreDepartamento,
  onCrear
}: {
  temas: HelpTopic[];
  departamentos: Department[];
  ocupado: boolean;
  nombreDepartamento: (id: string) => string;
  onCrear: (datos: {
    departmentId: string;
    name: string;
    description?: string;
    displayOrder: number;
  }) => void;
}) {
  const activos = departamentos.filter((d) => d.isActive);
  const [nuevo, setNuevo] = useState<{
    departmentId: string;
    name: string;
    description: string;
    displayOrder: string;
  } | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-awk-blue-50">Temas de ayuda</h2>
        {!nuevo && activos.length > 0 && (
          <Button
            size="sm"
            disabled={ocupado}
            onClick={() =>
              setNuevo({
                departmentId: activos[0]?.id ?? '',
                name: '',
                description: '',
                displayOrder: '0'
              })
            }
          >
            Nuevo tema
          </Button>
        )}
      </div>

      {activos.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-awk-blue-700 p-8 text-center text-sm text-awk-blue-300">
          Necesitas al menos un departamento activo antes de crear temas de ayuda.
        </p>
      )}

      {nuevo && (
        <div className="mt-4 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={ETIQUETA}>
              Departamento que lo atiende
              <select
                className={INPUT}
                value={nuevo.departmentId}
                onChange={(e) => setNuevo({ ...nuevo, departmentId: e.target.value })}
              >
                {activos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={ETIQUETA}>
              Nombre
              <input
                type="text"
                className={INPUT}
                value={nuevo.name}
                onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })}
                placeholder="Incidencia: acceso y contraseñas"
                maxLength={100}
              />
            </label>
            <label className={ETIQUETA}>
              Descripción
              <input
                type="text"
                className={INPUT}
                value={nuevo.description}
                onChange={(e) => setNuevo({ ...nuevo, description: e.target.value })}
                maxLength={500}
              />
            </label>
            <label className={ETIQUETA}>
              Orden en el desplegable
              <input
                type="number"
                min={0}
                className={INPUT}
                value={nuevo.displayOrder}
                onChange={(e) => setNuevo({ ...nuevo, displayOrder: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              disabled={ocupado || nuevo.name.trim().length === 0}
              onClick={() => {
                onCrear({
                  departmentId: nuevo.departmentId,
                  name: nuevo.name.trim(),
                  description: nuevo.description.trim() || undefined,
                  displayOrder: Number(nuevo.displayOrder) || 0
                });
                setNuevo(null);
              }}
            >
              {ocupado ? 'Guardando…' : 'Crear'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNuevo(null)} disabled={ocupado}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-awk-blue-700">
        <div className="overflow-x-auto">
          <table className="w-full bg-awk-navy-800 text-left text-sm">
            <thead>
              <tr className="border-b border-awk-blue-700 text-awk-blue-300">
                <th className="px-4 py-3 font-medium">Tema</th>
                <th className="w-full px-4 py-3 font-medium">Descripción</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-medium">Departamento</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-medium">Orden</th>
              </tr>
            </thead>
            <tbody>
              {temas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-awk-blue-300">
                    Todavía no hay temas de ayuda. Hasta que exista uno, el formulario de nueva
                    petición no se puede completar.
                  </td>
                </tr>
              )}
              {temas.map((t) => (
                <tr key={t.id} className="border-b border-awk-blue-800 align-top last:border-0">
                  <td className="px-4 py-3 text-awk-blue-50">{t.name}</td>
                  <td className="px-4 py-3 text-awk-blue-300">{t.description || '—'}</td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-awk-cyan-300">
                    {nombreDepartamento(t.departmentId)}
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-awk-blue-300">
                    {t.displayOrder}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Plazos de servicio (SLA)                                                   */
/* -------------------------------------------------------------------------- */

function Slas({
  slas,
  departamentos,
  ocupado,
  nombreDepartamento,
  onCrear
}: {
  slas: SLA[];
  departamentos: Department[];
  ocupado: boolean;
  nombreDepartamento: (id: string) => string;
  onCrear: (datos: {
    departmentId: string;
    priority: TicketPriority;
    responseTimeMinutes: number;
    resolutionTimeMinutes: number;
  }) => void;
}) {
  const activos = departamentos.filter((d) => d.isActive);
  const [nuevo, setNuevo] = useState<{
    departmentId: string;
    priority: TicketPriority;
    respuesta: string;
    resolucion: string;
  } | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-awk-blue-50">Plazos de servicio</h2>
        {!nuevo && activos.length > 0 && (
          <Button
            size="sm"
            disabled={ocupado}
            onClick={() =>
              setNuevo({
                departmentId: activos[0]?.id ?? '',
                priority: 'media',
                respuesta: '480',
                resolucion: '2880'
              })
            }
          >
            Nuevo plazo
          </Button>
        )}
      </div>

      <p className="mt-2 text-sm text-awk-blue-300">
        Un plazo por departamento y prioridad. Es lo que fija la fecha de vencimiento de cada
        ticket; sin plazo configurado, el ticket se abre sin vencimiento.
      </p>

      {activos.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-awk-blue-700 p-8 text-center text-sm text-awk-blue-300">
          Necesitas al menos un departamento activo para configurar plazos.
        </p>
      )}

      {nuevo && (
        <div className="mt-4 rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={ETIQUETA}>
              Departamento
              <select
                className={INPUT}
                value={nuevo.departmentId}
                onChange={(e) => setNuevo({ ...nuevo, departmentId: e.target.value })}
              >
                {activos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={ETIQUETA}>
              Prioridad
              <select
                className={INPUT}
                value={nuevo.priority}
                onChange={(e) => setNuevo({ ...nuevo, priority: e.target.value as TicketPriority })}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className={ETIQUETA}>
              Primera respuesta (minutos)
              <input
                type="number"
                min={1}
                className={INPUT}
                value={nuevo.respuesta}
                onChange={(e) => setNuevo({ ...nuevo, respuesta: e.target.value })}
              />
            </label>
            <label className={ETIQUETA}>
              Resolución (minutos)
              <input
                type="number"
                min={1}
                className={INPUT}
                value={nuevo.resolucion}
                onChange={(e) => setNuevo({ ...nuevo, resolucion: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              disabled={
                ocupado ||
                !(Number(nuevo.respuesta) > 0) ||
                !(Number(nuevo.resolucion) > Number(nuevo.respuesta))
              }
              onClick={() => {
                onCrear({
                  departmentId: nuevo.departmentId,
                  priority: nuevo.priority,
                  responseTimeMinutes: Number(nuevo.respuesta),
                  resolutionTimeMinutes: Number(nuevo.resolucion)
                });
                setNuevo(null);
              }}
            >
              {ocupado ? 'Guardando…' : 'Crear'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNuevo(null)} disabled={ocupado}>
              Cancelar
            </Button>
          </div>
          <p className="mt-3 text-xs text-awk-blue-400">
            La resolución tiene que ser mayor que la primera respuesta: la base de datos lo obliga.
          </p>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-awk-blue-700">
        <div className="overflow-x-auto">
          <table className="w-full bg-awk-navy-800 text-left text-sm">
            <thead>
              <tr className="border-b border-awk-blue-700 text-awk-blue-300">
                <th className="w-full px-4 py-3 font-medium">Departamento</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-medium">Prioridad</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-medium">Primera respuesta</th>
                <th className="w-px whitespace-nowrap px-4 py-3 font-medium">Resolución</th>
              </tr>
            </thead>
            <tbody>
              {slas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-awk-blue-300">
                    Sin plazos configurados. Los tickets se abrirán sin fecha de vencimiento.
                  </td>
                </tr>
              )}
              {slas.map((s) => (
                <tr key={s.id} className="border-b border-awk-blue-800 last:border-0">
                  <td className="px-4 py-3 text-awk-blue-50">
                    {nombreDepartamento(s.departmentId)}
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-awk-cyan-300">
                    {s.priority}
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-awk-blue-300">
                    {duracion(s.responseTimeMinutes)}
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-awk-blue-300">
                    {duracion(s.resolutionTimeMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
