import { useCallback, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { z } from 'zod';
import { panelTeamMemberSchema, type PanelTeamMember } from '../panel-prioridades.types';

export function useTeam() {
  const [members, setMembers] = useState<PanelTeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const listMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/panel-prioridades/team', z.array(panelTeamMemberSchema));
      setMembers(response);
    } catch (err) {
      console.error('Error loading team:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { members, loading, listMembers };
}
