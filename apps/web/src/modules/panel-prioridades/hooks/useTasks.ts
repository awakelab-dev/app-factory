import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { z } from 'zod';
import { panelTaskSchema, type PanelTask } from '../panel-prioridades.types';

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

  return { tasks, loading, error, listTasks };
}
