import { useQuery } from '@tanstack/react-query';
import { isOk } from '@solvera/pace-core/types';
import { useSecureSupabase } from '@solvera/pace-core/rbac';

import {
  fetchTeamReportTemplatesPanelRows,
  reportsTemplatesPanelQueryKey,
} from '@/lib/reports/teamReporting.templatesPanel';
import type { TeamReportingSecureClient } from '@/lib/reports/teamReporting.supabaseTypes';

/** React Query loader for TEAM report templates table (organisation-scoped TM11 §7 key family). */
export function useTeamReportTemplatesPanelQuery(organisationId: string, currentUserId: string) {
  const secureSupabase = useSecureSupabase() as TeamReportingSecureClient | null;

  return useQuery({
    queryKey: reportsTemplatesPanelQueryKey(organisationId),
    enabled: organisationId !== '' && secureSupabase != null,
    queryFn: async () => {
      if (secureSupabase == null) {
        throw new Error('Reporting client is not available.');
      }
      const result = await fetchTeamReportTemplatesPanelRows(
        secureSupabase,
        organisationId,
        currentUserId,
      );
      if (!isOk(result)) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 0,
  });
}
