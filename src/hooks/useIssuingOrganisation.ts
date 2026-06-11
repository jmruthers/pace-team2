import { useQuery } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import {
  fetchOrganisationName,
  resolveIssuingOrganisationId,
  shouldShowIssuingOrganisationContext,
} from '@/lib/members/issuingOrganisation';

interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

interface UseIssuingOrganisationOptions {
  selectedOrganisationId: string | null;
  /** Organisation used to resolve issuing org (target org or member issuing org). */
  resolveFromOrganisationId: string | null;
  /** When known, skips parent walk and uses this id directly. */
  knownIssuingOrganisationId?: string | null;
}

export function useIssuingOrganisation({
  selectedOrganisationId,
  resolveFromOrganisationId,
  knownIssuingOrganisationId,
}: UseIssuingOrganisationOptions) {
  const secureSupabase = useSecureSupabase() as SupabaseLike | null;

  const issuingOrgIdQuery = useQuery({
    queryKey: ['issuing-org', 'id', knownIssuingOrganisationId, resolveFromOrganisationId],
    enabled:
      secureSupabase != null &&
      knownIssuingOrganisationId == null &&
      resolveFromOrganisationId != null,
    queryFn: async (): Promise<string | null> => {
      if (secureSupabase == null || resolveFromOrganisationId == null) {
        return null;
      }
      const result = await resolveIssuingOrganisationId(secureSupabase, resolveFromOrganisationId);
      if (result.ok === false) {
        throw result.error;
      }
      return result.data;
    },
  });

  const issuingOrganisationId =
    knownIssuingOrganisationId ?? issuingOrgIdQuery.data ?? null;

  const issuingOrgNameQuery = useQuery({
    queryKey: ['issuing-org', 'name', issuingOrganisationId],
    enabled: secureSupabase != null && issuingOrganisationId != null,
    queryFn: async (): Promise<string | null> => {
      if (secureSupabase == null || issuingOrganisationId == null) {
        return null;
      }
      const result = await fetchOrganisationName(secureSupabase, issuingOrganisationId);
      if (result.ok === false) {
        throw result.error;
      }
      return result.data;
    },
  });

  const showIssuingContext = shouldShowIssuingOrganisationContext(
    issuingOrganisationId,
    selectedOrganisationId
  );

  return {
    issuingOrganisationId,
    issuingOrganisationName: issuingOrgNameQuery.data ?? null,
    showIssuingContext,
    issuingOrgLoading: issuingOrgIdQuery.isLoading || issuingOrgNameQuery.isLoading,
  };
}
