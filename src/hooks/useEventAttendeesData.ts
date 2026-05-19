import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@solvera/pace-core/components';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { coerceEventAttendeeList, headerFromAttendeeRows } from '@/lib/events/events.display';
import type { OrgEventAttendeeRow, OrgEventHeader } from '@/lib/events/events.types';
import { ORG_EVENTS_QUERY_KEY } from '@/hooks/useOrgEventsData';

type RpcClient = {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

function otherOrgHadAttendeesForEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  eventId: string,
  organisationId: string,
): boolean {
  return queryClient
    .getQueriesData<OrgEventAttendeeRow[]>({ queryKey: [ORG_EVENTS_QUERY_KEY] })
    .some(([queryKey, data]) => {
      const keyOrgId = queryKey[1];
      const keyEventId = queryKey[2];
      const keySuffix = queryKey[3];
      return (
        keySuffix === 'attendees'
        && keyEventId === eventId
        && typeof keyOrgId === 'string'
        && keyOrgId !== organisationId
        && data != null
        && data.length > 0
      );
    });
}

export function useEventAttendeesData(organisationId: string | null, eventId: string | undefined) {
  const queryClient = useQueryClient();
  const secureSupabase = useSecureSupabase() as RpcClient | null;
  const backgroundErrorNotifiedRef = useRef(false);

  const attendeesQuery = useQuery({
    queryKey: [ORG_EVENTS_QUERY_KEY, organisationId, eventId, 'attendees'],
    enabled: organisationId != null && eventId != null && eventId.length > 0 && secureSupabase != null,
    queryFn: async (): Promise<OrgEventAttendeeRow[]> => {
      if (organisationId == null || eventId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = await secureSupabase.rpc('app_org_event_attendees', {
        p_organisation_id: organisationId,
        p_event_id: eventId,
      });

      if (error != null) {
        throw error;
      }

      return coerceEventAttendeeList(data);
    },
  });

  const loadErrorMessage = useMemo(() => {
    if (!attendeesQuery.isError) {
      return null;
    }
    return HandleSupabaseError(attendeesQuery.error, 'app_org_event_attendees').message;
  }, [attendeesQuery.error, attendeesQuery.isError]);

  const header: OrgEventHeader | null = useMemo(
    () => headerFromAttendeeRows(attendeesQuery.data ?? []),
    [attendeesQuery.data],
  );

  const attendees = attendeesQuery.data ?? [];

  const showOrgMismatch = useMemo(() => {
    if (
      !attendeesQuery.isSuccess
      || attendees.length > 0
      || organisationId == null
      || eventId == null
    ) {
      return false;
    }

    return otherOrgHadAttendeesForEvent(queryClient, eventId, organisationId);
  }, [
    attendeesQuery.isSuccess,
    attendees.length,
    organisationId,
    eventId,
    queryClient,
  ]);

  useEffect(() => {
    const hasStaleData = attendeesQuery.data != null;
    const isBackgroundFailure =
      attendeesQuery.isError
      && hasStaleData
      && !attendeesQuery.isPending
      && !attendeesQuery.isLoading;

    if (!isBackgroundFailure) {
      if (!attendeesQuery.isError) {
        backgroundErrorNotifiedRef.current = false;
      }
      return;
    }

    if (backgroundErrorNotifiedRef.current) {
      return;
    }

    backgroundErrorNotifiedRef.current = true;
    toast({
      title: 'Could not refresh event',
      description: loadErrorMessage ?? 'An unexpected error occurred.',
      variant: 'destructive',
    });
  }, [
    attendeesQuery.data,
    attendeesQuery.isError,
    attendeesQuery.isLoading,
    attendeesQuery.isPending,
    loadErrorMessage,
  ]);

  return {
    attendees,
    rawCount: attendees.length,
    header,
    isLoading: attendeesQuery.isLoading,
    isFetching: attendeesQuery.isFetching,
    isSuccess: attendeesQuery.isSuccess,
    showOrgMismatch,
    loadErrorMessage,
    refetchAttendees: attendeesQuery.refetch,
  };
}
