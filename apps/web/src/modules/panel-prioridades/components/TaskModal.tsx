import { useState, useEffect } from 'react';
import { Button } from '@awk/ui';
import type { PanelTask, CreatePanelTaskRequest, PanelTeamMember, PanelTaskOrigin } from '../panel-prioridades.types';

interface TaskModalProps {
  task?: PanelTask | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onCreateTask: (data: CreatePanelTaskRequest) => Promise<PanelTask | void>;
  onUpdateTask: (id: string, data: Partial<CreatePanelTaskRequest>) => Promise<PanelTask | void>;
  teamMembers: PanelTeamMember[];
}

const ORIGIN_OPTIONS: Array<{ value: PanelTaskOrigin; label: string }> = [
  { value: 'meeting', label: 'Reunión' },
  { value: 'email', label: 'Correo' },
  { value: 'chat', label: 'Chat' },
  { value: 'self', label: 'Iniciativa propia' },
  { value: 'direction', label: 'Dirección' }
];

const ESTIMATED_MINUTES_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240];

export function TaskModal({
  task,
  open,
  onClose,
  onSave,
  onCreateTask,
  onUpdateTask,
  teamMembers
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [origin, setOrigin] = useState<PanelTaskOrigin>('self');
  const [delegatedToName, setDelegatedToName] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task && open) {
      setTitle(task.title);
      setDetail(task.detail || '');
      setUrgent(task.urgent);
      setImportant(task.important);
      if (task.dueDate) {
        const d = typeof task.dueDate === 'string' ? new Date(task.dueDate) : task.dueDate;
        setDueDate(d.toISOString().split('T')[0] ?? '');
      } else {
        setDueDate('');
      }
      setEstimatedMinutes(task.estimatedMinutes);
      setOrigin(task.origin);
      if (task.quadrant === 3) {
        setDelegatedToName(null);
        setFollowUpDate('');
      }
    } else if (open) {
      setTitle('');
      setDetail('');
      setUrgent(false);
      setImportant(false);
      setDueDate('');
      setEstimatedMinutes(30);
      setOrigin('self');
      setDelegatedToName(null);
      setFollowUpDate('');
    }
    setError(null);
  }, [task, open]);

  const quadrant = urgent && important ? 1 : !urgent && important ? 2 : urgent && !important ? 3 : 4;

  const getQuadrantLabel = () => {
    const labels = ['', 'Hacer (Urgente + Importante)', 'Planificar (Importante)', 'Delegar (Urgente)', 'Eliminar'];
    return labels[quadrant];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('El título es obligatorio');
      return;
    }
    if (!urgent && !important) {
      setError('Selecciona al menos Urgencia o Importancia');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title,
        detail: detail || null,
        urgent,
        important,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        estimatedMinutes,
        origin,
        delegatedToName: quadrant === 3 ? delegatedToName : undefined,
        followUpDate: quadrant === 3 && followUpDate ? new Date(followUpDate).toISOString() : undefined
      };

      if (task) {
        await onUpdateTask(task.id, payload);
      } else {
        await onCreateTask(payload as CreatePanelTaskRequest);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-awk-navy-800 rounded-lg border border-awk-blue-700 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
        <div className="px-6 py-4 border-b border-awk-blue-700">
          <h2 className="text-lg font-semibold text-white">{task ? 'Editar tarea' : 'Nueva tarea'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-awk-blue-100 mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Resumen de la tarea"
              maxLength={200}
              className="w-full rounded-lg border border-awk-blue-600 bg-awk-blue-900/30 px-3 py-2 text-sm text-awk-blue-50 placeholder-awk-blue-500"
            />
          </div>

          {/* Detalle */}
          <div>
            <label className="block text-sm font-medium text-awk-blue-100 mb-1">Detalle</label>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="Más detalles (opcional)"
              maxLength={1000}
              rows={2}
              className="w-full rounded-lg border border-awk-blue-600 bg-awk-blue-900/30 px-3 py-2 text-sm text-awk-blue-50 placeholder-awk-blue-500 resize-none"
            />
          </div>

          {/* Urgencia e Importancia */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={urgent}
                onChange={e => setUrgent(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-awk-blue-100">Urgencia</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={important}
                onChange={e => setImportant(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-awk-blue-100">Importancia</span>
            </label>
          </div>

          {/* Cuadrante calculado */}
          <p className="text-xs text-awk-blue-400">Cuadrante: {getQuadrantLabel()}</p>

          {/* Fecha límite */}
          <div>
            <label className="block text-sm font-medium text-awk-blue-100 mb-1">Fecha límite</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-awk-blue-600 bg-awk-blue-900/30 px-3 py-2 text-sm text-awk-blue-50"
            />
          </div>

          {/* Dedicación estimada */}
          <div>
            <label className="block text-sm font-medium text-awk-blue-100 mb-1">Dedicación *</label>
            <select
              value={String(estimatedMinutes)}
              onChange={v => setEstimatedMinutes(parseInt(v.target.value))}
              className="w-full rounded-lg border border-awk-blue-600 bg-awk-blue-900/30 px-3 py-2 text-sm text-awk-blue-50"
            >
              {ESTIMATED_MINUTES_OPTIONS.map(m => (
                <option key={m} value={m}>
                  {m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}
                </option>
              ))}
            </select>
          </div>

          {/* Origen */}
          <div>
            <label className="block text-sm font-medium text-awk-blue-100 mb-1">Origen *</label>
            <select
              value={origin}
              onChange={v => setOrigin(v.target.value as PanelTaskOrigin)}
              className="w-full rounded-lg border border-awk-blue-600 bg-awk-blue-900/30 px-3 py-2 text-sm text-awk-blue-50"
            >
              {ORIGIN_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Q3: Responsable + Seguimiento */}
          {quadrant === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-awk-blue-100 mb-1">
                  Responsable (opcional)
                </label>
                <select
                  value={delegatedToName || ''}
                  onChange={v => setDelegatedToName(v.target.value || null)}
                  className="w-full rounded-lg border border-awk-blue-600 bg-awk-blue-900/30 px-3 py-2 text-sm text-awk-blue-50"
                >
                  <option value="">Sin asignar</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-awk-blue-100 mb-1">
                  Fecha de seguimiento (opcional)
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-full rounded-lg border border-awk-blue-600 bg-awk-blue-900/30 px-3 py-2 text-sm text-awk-blue-50"
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Botones */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
