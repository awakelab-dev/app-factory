import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { z } from 'zod';
import { scheduleWeekSchema, type ScheduleWeek } from '../panel-prioridades.types';

export function useSchedule() {
  const [schedule, setSchedule] = useState<ScheduleWeek | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/schedule', scheduleWeekSchema);
      setSchedule(response);
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reserveBlock = useCallback(
    async (taskId: string, day: number, hour: number) => {
      try {
        await apiFetch(
          `/api/panel-prioridades/schedule/${taskId}/${day}/${hour}`,
          z.object({ success: z.boolean() }),
          { method: 'POST' }
        );
        await loadSchedule();
      } catch (err) {
        console.error('Error reserving block:', err);
        throw err;
      }
    },
    [loadSchedule]
  );

  const releaseBlock = useCallback(
    async (day: number, hour: number) => {
      try {
        await apiFetch(
          `/api/panel-prioridades/schedule/${day}/${hour}`,
          z.void(),
          { method: 'DELETE' }
        );
        await loadSchedule();
      } catch (err) {
        console.error('Error releasing block:', err);
        throw err;
      }
    },
    [loadSchedule]
  );

  const releaseAllBlocksForTask = useCallback(
    async (taskId: string) => {
      if (!schedule) return;
      const blocks: Array<{ day: number; hour: number }> = [];
      schedule.forEach(dayData => {
        dayData.blocks.forEach(block => {
          if (block.taskId === taskId) {
            blocks.push({ day: dayData.day, hour: block.hour });
          }
        });
      });
      await Promise.all(blocks.map(b => releaseBlock(b.day, b.hour)));
    },
    [schedule, releaseBlock]
  );

  return { schedule, loading, loadSchedule, reserveBlock, releaseBlock, releaseAllBlocksForTask };
}
