import { useCallback, useState } from 'react';
import { apiFetch } from '../../lib/api';
import type { PanelTeamMember } from '../panel-prioridades.types';

export function useTeam() {
  const [members, setMembers] = useState<PanelTeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const listMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/team', { expectedType: 'json' });
      setMembers(response || []);
    } catch (err) {
      console.error('Error loading team:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { members, loading, listMembers };
}
