import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { mapRequestRow } from '@/lib/approvals/approvals.mappers';
import type { ApprovalRequestRow, ApprovalRequestTypeFilter } from '@/lib/approvals/approvals.types';

const OPEN_STATUSES = ['pending', 'on_hold'] as const;
const CLOSED_STATUSES = ['approved', 'rejected', 'withdrawn'] as const;
const REQUEST_TYPES = ['join', 'transfer'] as const;

interface QueryBuilder extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): QueryBuilder;
  in(column: string, values: readonly string[]): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
}

interface SupabaseLike {
  from: (table: string) => {
    select: (selection: string, options?: { count?: 'exact'; head?: boolean }) => QueryBuilder;
  };
}

function applyRequestTypeFilter(query: QueryBuilder, requestTypeFilter: ApprovalRequestTypeFilter): QueryBuilder {
  if (requestTypeFilter === 'all') {
    return query.in('request_type', [...REQUEST_TYPES]);
  }
  return query.eq('request_type', requestTypeFilter);
}

export function applyOpenFilters(query: QueryBuilder, organisationId: string, requestTypeFilter: ApprovalRequestTypeFilter): QueryBuilder {
  const withType = applyRequestTypeFilter(query.eq('organisation_id', organisationId).in('status', [...OPEN_STATUSES]), requestTypeFilter);
  return withType.order('created_at', { ascending: true });
}

export function applyClosedFilters(query: QueryBuilder, organisationId: string, requestTypeFilter: ApprovalRequestTypeFilter): QueryBuilder {
  const withType = applyRequestTypeFilter(query.eq('organisation_id', organisationId).in('status', [...CLOSED_STATUSES]), requestTypeFilter);
  return withType.order('resolved_at', { ascending: false });
}

export function applyOpenCountFilters(query: QueryBuilder, organisationId: string): QueryBuilder {
  return query
    .eq('organisation_id', organisationId)
    .eq('status', 'pending')
    .in('request_type', [...REQUEST_TYPES]);
}

const REQUEST_SELECT = [
  'id',
  'organisation_id',
  'request_type',
  'status',
  'created_at',
  'resolved_at',
  'target_organisation_id',
  'source_organisation_id',
  'membership_type_id',
  'applicant_member_number',
  'review_notes',
  'subject_person:core_person!subject_person_id(id, first_name, last_name, preferred_name, email)',
  'subject_member:core_member!subject_member_id(id, deleted_at)',
  'membership_type:core_membership_type(id, name)',
  'source_org:core_organisations!source_organisation_id(id, name)',
  'resolver_person:core_person!team_member_request_resolved_by_fkey(id, first_name, last_name, preferred_name)',
].join(', ');

export function useApprovalsData(organisationId: string | null, requestTypeFilter: ApprovalRequestTypeFilter) {
  const secureSupabase = useSecureSupabase() as SupabaseLike | null;

  const openListQuery = useQuery({
    queryKey: ['approvals', 'open', organisationId, requestTypeFilter],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<ApprovalRequestRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }
      const { data, error } = (await applyOpenFilters(
        secureSupabase.from('team_member_request').select(REQUEST_SELECT),
        organisationId,
        requestTypeFilter
      )) as { data: Record<string, unknown>[] | null; error: unknown };

      if (error != null) {
        throw error;
      }
      return (data ?? []).map(mapRequestRow);
    },
  });

  const closedListQuery = useQuery({
    queryKey: ['approvals', 'closed', organisationId, requestTypeFilter],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<ApprovalRequestRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }
      const { data, error } = (await applyClosedFilters(
        secureSupabase.from('team_member_request').select(REQUEST_SELECT),
        organisationId,
        requestTypeFilter
      )) as { data: Record<string, unknown>[] | null; error: unknown };

      if (error != null) {
        throw error;
      }
      return (data ?? []).map(mapRequestRow);
    },
  });

  const openCountQuery = useQuery({
    queryKey: ['approvals', 'open-count', organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<{ count: number }> => {
      if (organisationId == null || secureSupabase == null) {
        return { count: 0 };
      }
      const { count, error } = (await applyOpenCountFilters(
        secureSupabase.from('team_member_request').select('id', { count: 'exact', head: true }),
        organisationId
      )) as { count: number | null; error: unknown };

      if (error != null) {
        throw error;
      }
      return { count: count ?? 0 };
    },
  });

  const openErrorMessage = useMemo(() => {
    if (!openListQuery.isError) {
      return null;
    }
    return HandleSupabaseError(openListQuery.error, 'team_member_request').message;
  }, [openListQuery.error, openListQuery.isError]);

  const closedErrorMessage = useMemo(() => {
    if (!closedListQuery.isError) {
      return null;
    }
    return HandleSupabaseError(closedListQuery.error, 'team_member_request').message;
  }, [closedListQuery.error, closedListQuery.isError]);

  return {
    openRequests: openListQuery.data ?? [],
    closedRequests: closedListQuery.data ?? [],
    openCount: openCountQuery.data?.count ?? 0,
    openLoading: openListQuery.isLoading,
    closedLoading: closedListQuery.isLoading,
    openCountLoading: openCountQuery.isLoading,
    openErrorMessage,
    closedErrorMessage,
    refetchOpen: openListQuery.refetch,
    refetchClosed: closedListQuery.refetch,
    refetchOpenCount: openCountQuery.refetch,
  };
}
