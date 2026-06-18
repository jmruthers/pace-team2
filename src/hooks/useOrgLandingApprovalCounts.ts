import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { apiErr, apiOk, type ApiResult } from '@/lib/apiResult';

interface QueryBuilder extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): QueryBuilder;
  in(column: string, values: readonly string[]): QueryBuilder;
}

interface SupabaseLike {
  from: (table: string) => {
    select: (selection: string, options?: { count?: 'exact'; head?: boolean }) => QueryBuilder;
  };
}

export interface OrgApprovalAttention {
  organisationId: string;
  count: number;
}

const OPEN_REQUEST_TYPES = ['join', 'transfer'] as const;

async function fetchPendingApprovalCount(
  secureSupabase: SupabaseLike,
  organisationId: string,
): Promise<ApiResult<number>> {
  const { count, error } = (await secureSupabase
    .from('team_member_request')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', organisationId)
    .eq('status', 'pending')
    .in('request_type', [...OPEN_REQUEST_TYPES])) as { count: number | null; error: unknown };

  if (error != null) {
    return apiErr({ message: HandleSupabaseError(error, 'team_member_request').message });
  }

  return apiOk(count ?? 0);
}

export function useOrgLandingApprovalCounts(organisationIds: string[]): OrgApprovalAttention[] {
  const secureSupabase = useSecureSupabase() as SupabaseLike | null;

  const queries = useQueries({
    queries: organisationIds.map((organisationId) => ({
      queryKey: ['approvals', 'landing-count', organisationId],
      enabled: secureSupabase != null && organisationId.length > 0,
      queryFn: async (): Promise<OrgApprovalAttention> => {
        if (secureSupabase == null) {
          return { organisationId, count: 0 };
        }
        const result = await fetchPendingApprovalCount(secureSupabase, organisationId);
        if (!result.ok) {
          return { organisationId, count: 0 };
        }
        return { organisationId, count: result.data };
      },
    })),
  });

  return useMemo(() => {
    return queries
      .map((query) => query.data)
      .filter((entry): entry is OrgApprovalAttention => entry != null && entry.count > 0);
  }, [queries]);
}
