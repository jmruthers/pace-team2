import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';

import { createTeamReportingExecutionAdapter } from '@/lib/reports/teamReporting.execution';
import { createTeamReportingMetadataProvider } from '@/lib/reports/teamReporting.metadata';
import { createTeamReportingTemplateStore } from '@/lib/reports/teamReporting.templates';
import type { TeamReportingSecureClient } from '@/lib/reports/teamReporting.supabaseTypes';

export function useTeamReportingAdapters(organisationId: string | null, userId: string | null) {
  const secureSupabase = useSecureSupabase() as unknown as TeamReportingSecureClient | null;
  const queryClient = useQueryClient();
  const prevOrganisationRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const next = organisationId ?? null;
    if (prevOrganisationRef.current === undefined) {
      prevOrganisationRef.current = next;
      return;
    }
    if (prevOrganisationRef.current !== next) {
      prevOrganisationRef.current = next;
      void queryClient.invalidateQueries({ queryKey: ['reports'], exact: false });
    }
  }, [organisationId, queryClient]);

  const getClient = useCallback((): TeamReportingSecureClient | null => {
    if (organisationId == null) return null;
    return secureSupabase;
  }, [organisationId, secureSupabase]);

  const metadataProvider = useMemo(
    () => createTeamReportingMetadataProvider(getClient),
    [getClient],
  );

  const templateStore = useMemo(() => {
    if (organisationId == null || userId == null) {
      return null;
    }
    return createTeamReportingTemplateStore({
      getClient,
      organisationId,
      userId,
    });
  }, [getClient, organisationId, userId]);

  const baseExecutionAdapter = useMemo(
    () => createTeamReportingExecutionAdapter(getClient),
    [getClient],
  );

  return { metadataProvider, templateStore, baseExecutionAdapter };
}
