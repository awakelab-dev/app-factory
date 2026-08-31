import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { z } from 'zod';
import {
  panelTaskSchema,
  type PanelTask,
  type CreatePanelTaskRequest,
  type UpdatePanelTaskRequest
} from '../panel-prioridades.types';

export function useTasks() {
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listTasks = useCallback(async (filters?: { quadrant?: number; status?: string; origin?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (filters?.quadrant) query.append('quadrant', String(filters.quadrant));
      if (filters?.status) query.append('status', filters.status);
      if (filters?.origin) query.append('origin', filters.origin);

      const response = await apiFetch(
        `/api/panel-prioridades/tasks?${query.toString()}`,
        z.array(panelTaskSchema)
      );
      setTasks(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (data: CreatePanelTaskRequest) => {
    try {
      setError(null);
      const response = await apiFetch(
        '/api/panel-prioridades/tasks',
        panelTaskSchema,
        {
          method: 'POST',
          body: JSON.stringify(data)
        }
      );
      setTasks(prev => [...prev, response]);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear tarea';
      setError(message);
      throw err;
    }
  }, []);

  const updateTask = useCallback(async (id: string, data: UpdatePanelTaskRequest) => {
    try {
      setError(null);
      const response = await apiFetch(
        `/api/panel-prioridades/tasks/${id}`,
        panelTaskSchema,
        {
          method: 'PUT',
          body: JSON.stringify(data)
        }
      );
      setTasks(prev => prev.map(t => (t.id === id ? response : t)));
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar tarea';
      setError(message);
      throw err;
    }
  }, []);

  const closeTask = useCallback(async (id: string, status: 'done' | 'discarded') => {
    try {
      setError(null);
      await apiFetch(
        `/api/panel-prioridades/tasks/${id}?status=${status}`,
        z.void(),
        {
          method: 'DELETE'
        }
      );
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cerrar tarea';
      setError(message);
      throw err;
    }
  }, []);

  const setDelegation = useCallback(async (
    id: string,
    delegatedToName: string | null,
    followUpDate: Date | null
  ) => {
    try {
      setError(null);
      await apiFetch(
        `/api/panel-prioridades/tasks/${id}/delegate`,
        z.void(),
        {
          method: 'PUT',
          body: JSON.stringify({ delegatedToName, followUpDate: followUpDate?.toISOString() ?? null })
        }
      );
      // Re-fetch para sincronizar
      await listTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al delegar tarea';
      setError(message);
      throw err;
    }
  }, [listTasks]);

  return { tasks, loading, error, listTasks, createTask, updateTask, closeTask, setDelegation };
}
