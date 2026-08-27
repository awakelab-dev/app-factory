import { useCallback, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { ScheduleWeek } from '../panel-prioridades.types';

export function useSchedule() {
  const [schedule, setSchedule] = useState<ScheduleWeek | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/schedule', { expectedType: 'json' });
      setSchedule(response);
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { schedule, loading, loadSchedule };
}
