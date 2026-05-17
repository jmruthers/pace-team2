import { useQuery } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import type { MembershipTypeOption } from '@/lib/members/memberDirectory.types';

type QueryBuilder = {
  eq: (column: string, value: string | number | boolean | null) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  then: <TResult1 = unknown>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null
  ) => Promise<TResult1>;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (selection: string) => QueryBuilder;
  };
};

/** Active membership types for organisation (shared query key across directory + comms chips). */
export function useActiveOrganisationMembershipTypes(organisationId: string | null): {
  memberTypes: MembershipTypeOption[];
  isLoading: boolean;
} {
  const secureSupabase = useSecureSupabase() as SupabaseLike | null;

  const memberTypesQuery = useQuery({
    queryKey: ['membership-types', organisationId, 'active-only'],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MembershipTypeOption[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_membership_type')
        .select('id, name')
        .eq('organisation_id', organisationId)
        .eq('is_active', true)
        .order('name', { ascending: true })) as {
        data: Array<{ id: number; name: string }>;
        error: unknown;
      };

      if (error != null) {
        throw error;
      }

      return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
    },
  });

  return {
    memberTypes: memberTypesQuery.data ?? [],
    isLoading: memberTypesQuery.isLoading,
  };
}
