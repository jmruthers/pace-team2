import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError, NormalizeSupabaseError } from '@solvera/pace-core/utils';
import type {
  MembershipTypeMutationError,
  MembershipTypeMutationInput,
  MembershipTypeRow,
} from '@/lib/settings/membershipTypes.types';

interface SupabaseQueryBuilderLike extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): SupabaseQueryBuilderLike;
  in(column: string, values: Array<number | string>): SupabaseQueryBuilderLike;
  is(column: string, value: null): SupabaseQueryBuilderLike;
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

interface MembershipTypeRawRow {
  id: number;
  name: string;
  min_age: number | null;
  max_age: number | null;
  is_active: boolean;
  organisation_id: string;
}

interface MemberCountRawRow {
  membership_type_id: number | null;
}

const MEMBERSHIP_TYPES_QUERY_KEY = 'membership-types';

function toMutationError(error: unknown): MembershipTypeMutationError {
  const normalized = NormalizeSupabaseError(error);
  return {
    code: normalized.code,
    message: normalized.message,
    raw: error,
  };
}

function mapMembershipTypeRow(
  row: MembershipTypeRawRow,
  membersCountByTypeId: Map<number, number>
): MembershipTypeRow {
  return {
    id: row.id,
    name: row.name,
    minAge: row.min_age,
    maxAge: row.max_age,
    isActive: row.is_active,
    organisationId: row.organisation_id,
    membersCount: membersCountByTypeId.get(row.id) ?? 0,
  };
}

export function useMembershipTypesData(organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as unknown as SecureSupabaseLike | null;
  const queryClient = useQueryClient();

  const membershipTypesQuery = useQuery({
    queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MembershipTypeRawRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }
      const { data, error } = (await secureSupabase
        .from('core_membership_type')
        .select('id, name, min_age, max_age, is_active, organisation_id')
        .eq('organisation_id', organisationId)
        .order('name', { ascending: true })) as { data: MembershipTypeRawRow[] | null; error: unknown };

      if (error != null) {
        throw error;
      }

      return data ?? [];
    },
  });

  const membersCountQuery = useQuery({
    queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId, 'members-count'],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<Map<number, number>> => {
      if (organisationId == null || secureSupabase == null) {
        return new Map<number, number>();
      }

      const { data, error } = (await secureSupabase
        .from('core_member')
        .select('membership_type_id')
        .eq('organisation_id', organisationId)
        .is('deleted_at', null)) as { data: MemberCountRawRow[] | null; error: unknown };

      if (error != null) {
        throw error;
      }

      const counts = new Map<number, number>();
      (data ?? []).forEach((row) => {
        if (row.membership_type_id == null) {
          return;
        }
        counts.set(row.membership_type_id, (counts.get(row.membership_type_id) ?? 0) + 1);
      });
      return counts;
    },
  });

  const membershipTypes = useMemo(() => {
    const rows = membershipTypesQuery.data ?? [];
    const counts = membersCountQuery.data ?? new Map<number, number>();
    return rows.map((row) => mapMembershipTypeRow(row, counts));
  }, [membershipTypesQuery.data, membersCountQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (input: MembershipTypeMutationInput) => {
      if (organisationId == null || secureSupabase == null) {
        throw new Error('Organisation is not selected.');
      }

      const { error } = (await secureSupabase
        .from('core_membership_type')
        .insert({
          name: input.name,
          min_age: input.minAge,
          max_age: input.maxAge,
          is_active: input.isActive,
          organisation_id: organisationId,
        })
        .select('id')
        .single()) as { error: unknown };

      if (error != null) {
        throw toMutationError(error);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId] }),
        queryClient.invalidateQueries({ queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId, 'members-count'] }),
        queryClient.invalidateQueries({ queryKey: ['lookup', 'membership-types', organisationId] }),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: number; input: MembershipTypeMutationInput }) => {
      if (organisationId == null || secureSupabase == null) {
        throw new Error('Organisation is not selected.');
      }

      const { error } = (await secureSupabase
        .from('core_membership_type')
        .update({
          name: input.name,
          min_age: input.minAge,
          max_age: input.maxAge,
          is_active: input.isActive,
        })
        .eq('id', id)
        .eq('organisation_id', organisationId)
        .select('id')
        .single()) as { error: unknown };

      if (error != null) {
        throw toMutationError(error);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId] }),
        queryClient.invalidateQueries({ queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId, 'members-count'] }),
        queryClient.invalidateQueries({ queryKey: ['lookup', 'membership-types', organisationId] }),
      ]);
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      if (organisationId == null || secureSupabase == null) {
        throw new Error('Organisation is not selected.');
      }

      const { error } = (await secureSupabase
        .from('core_membership_type')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('organisation_id', organisationId)
        .select('id')
        .single()) as { error: unknown };

      if (error != null) {
        throw toMutationError(error);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId] }),
        queryClient.invalidateQueries({ queryKey: [MEMBERSHIP_TYPES_QUERY_KEY, organisationId, 'members-count'] }),
        queryClient.invalidateQueries({ queryKey: ['lookup', 'membership-types', organisationId] }),
      ]);
    },
  });

  const loadErrorMessage = useMemo(() => {
    if (membershipTypesQuery.isError) {
      return HandleSupabaseError(membershipTypesQuery.error, 'core_membership_type').message;
    }
    if (membersCountQuery.isError) {
      return HandleSupabaseError(membersCountQuery.error, 'core_member').message;
    }
    return null;
  }, [membershipTypesQuery.error, membershipTypesQuery.isError, membersCountQuery.error, membersCountQuery.isError]);

  return {
    membershipTypes,
    isLoading: membershipTypesQuery.isLoading || membersCountQuery.isLoading,
    loadErrorMessage,
    refetchMembershipTypes: membershipTypesQuery.refetch,
    refetchMembersCount: membersCountQuery.refetch,
    createMembershipType: createMutation.mutateAsync,
    updateMembershipType: updateMutation.mutateAsync,
    setMembershipTypeActive: setActiveMutation.mutateAsync,
    createPending: createMutation.isPending,
    updatePending: updateMutation.isPending,
    setActivePending: setActiveMutation.isPending,
  };
}
