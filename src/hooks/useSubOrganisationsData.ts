import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError, NormalizeSupabaseError } from '@solvera/pace-core/utils';
import type {
  CreateSubOrganisationInput,
  SubOrganisationMutationError,
  SubOrganisationRow,
  UpdateSubOrganisationInput,
} from '@/lib/settings/subOrganisations.types';

interface SupabaseQueryBuilderLike extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): SupabaseQueryBuilderLike;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilderLike;
  select(selection: string): SupabaseQueryBuilderLike;
  insert(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
  update(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
  single(): Promise<unknown>;
}

interface SupabaseTableLike {
  select(selection: string): SupabaseQueryBuilderLike;
  insert(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
  update(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
}

interface SecureSupabaseLike {
  from(table: string): SupabaseTableLike;
}

interface SubOrganisationRawRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  parent_id: string | null;
}

const SUB_ORGANISATIONS_QUERY_KEY = 'sub-organisations';

function toMutationError(error: unknown): SubOrganisationMutationError {
  const normalized = NormalizeSupabaseError(error);
  return {
    code: normalized.code,
    message: normalized.message,
    raw: error,
  };
}

function mapSubOrganisationRow(row: SubOrganisationRawRow): SubOrganisationRow {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    isActive: row.is_active,
    parentId: row.parent_id,
  };
}

export function useSubOrganisationsData(organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as unknown as SecureSupabaseLike | null;
  const queryClient = useQueryClient();

  const subOrganisationsQuery = useQuery({
    queryKey: [SUB_ORGANISATIONS_QUERY_KEY, organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<SubOrganisationRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_organisations')
        .select('id, name, display_name, description, is_active, parent_id')
        .eq('parent_id', organisationId)
        .order('display_name', { ascending: true })) as { data: SubOrganisationRawRow[] | null; error: unknown };

      if (error != null) {
        throw error;
      }

      return (data ?? []).map(mapSubOrganisationRow);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateSubOrganisationInput) => {
      if (secureSupabase == null) {
        throw new Error('Organisation context is unavailable.');
      }

      const { error } = (await secureSupabase
        .from('core_organisations')
        .insert({
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          parent_id: input.parentId,
        })
        .select('id')
        .single()) as { error: unknown };

      if (error != null) {
        throw toMutationError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [SUB_ORGANISATIONS_QUERY_KEY, organisationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSubOrganisationInput }) => {
      if (secureSupabase == null) {
        throw new Error('Organisation context is unavailable.');
      }

      const { error } = (await secureSupabase
        .from('core_organisations')
        .update({
          display_name: input.displayName,
          description: input.description,
          is_active: input.isActive,
        })
        .eq('id', id)
        .select('id')
        .single()) as { error: unknown };

      if (error != null) {
        throw toMutationError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [SUB_ORGANISATIONS_QUERY_KEY, organisationId] });
    },
  });

  return {
    subOrganisations: subOrganisationsQuery.data ?? [],
    isLoading: subOrganisationsQuery.isLoading,
    loadErrorMessage: subOrganisationsQuery.isError
      ? HandleSupabaseError(subOrganisationsQuery.error, 'core_organisations').message
      : null,
    refetchSubOrganisations: subOrganisationsQuery.refetch,
    createSubOrganisation: createMutation.mutateAsync,
    updateSubOrganisation: updateMutation.mutateAsync,
    createPending: createMutation.isPending,
    updatePending: updateMutation.isPending,
  };
}
