import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@solvera/pace-core/components';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { coerceEventSummaryList } from '@/lib/events/events.display';
import type { OrgEventSummaryRow } from '@/lib/events/events.types';

type RpcClient = {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export const ORG_EVENTS_QUERY_KEY = 'events';

export function useOrgEventsData(organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as RpcClient | null;
  const backgroundErrorNotifiedRef = useRef(false);

  const eventsQuery = useQuery({
    queryKey: [ORG_EVENTS_QUERY_KEY, organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<OrgEventSummaryRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = await secureSupabase.rpc('app_org_event_summaries', {
        p_organisation_id: organisationId,
      });

      if (error != null) {
        throw error;
      }

      return coerceEventSummaryList(data);
    },
  });

  const loadErrorMessage = useMemo(() => {
    if (!eventsQuery.isError) {
      return null;
    }
    return HandleSupabaseError(eventsQuery.error, 'app_org_event_summaries').message;
  }, [eventsQuery.error, eventsQuery.isError]);

  useEffect(() => {
    const hasStaleData = eventsQuery.data != null && eventsQuery.data.length >= 0;
    const isBackgroundFailure =
      eventsQuery.isError
      && hasStaleData
      && !eventsQuery.isPending
      && !eventsQuery.isLoading;

    if (!isBackgroundFailure) {
      if (!eventsQuery.isError) {
        backgroundErrorNotifiedRef.current = false;
      }
      return;
    }

    if (backgroundErrorNotifiedRef.current) {
      return;
    }

    backgroundErrorNotifiedRef.current = true;
    toast({
      title: 'Could not refresh events',
      description: loadErrorMessage ?? 'An unexpected error occurred.',
      variant: 'destructive',
    });
  }, [
    eventsQuery.data,
    eventsQuery.isError,
    eventsQuery.isLoading,
    eventsQuery.isPending,
    loadErrorMessage,
  ]);

  return {
    events: eventsQuery.data ?? [],
    rawCount: eventsQuery.data?.length ?? 0,
    isLoading: eventsQuery.isLoading,
    isFetching: eventsQuery.isFetching,
    loadErrorMessage,
    refetchEvents: eventsQuery.refetch,
  };
}
