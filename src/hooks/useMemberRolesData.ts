import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { isMemberAccessibleInOrganisation } from '@/lib/members/memberOrgAccess';
import { apiErr, apiOk } from '@/lib/apiResult';
import type { ApiResult, ApiError } from '@/lib/apiResult';
import type {
  AddMemberRolePayload,
  EditMemberRolePayload,
  EndMemberRolePayload,
  MemberRoleRow,
  MemberRolesMemberRecord,
  MemberRoleTypeOption,
} from '@/lib/members/memberRoles.types';

type SupabaseQueryResult<T> = { data: T; error: unknown };

interface SupabaseQueryBuilderLike extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): SupabaseQueryBuilderLike;
  is(column: string, value: null): SupabaseQueryBuilderLike;
  order(column: string, options?: { ascending?: boolean; referencedTable?: string }): SupabaseQueryBuilderLike;
  select(selection?: string): SupabaseQueryBuilderLike;
  insert(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
  update(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
  maybeSingle(): Promise<unknown>;
  single(): Promise<unknown>;
}

interface SupabaseTableClientLike {
  select(selection: string): SupabaseQueryBuilderLike;
  insert(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
  update(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
}

interface SecureSupabaseClientLike {
  from(table: string): SupabaseTableClientLike;
}

interface UseMemberRolesDataOptions {
  memberId: string | undefined;
  organisationId: string | null;
}

interface RoleJoinRow {
  id: number;
  name: string | null;
}

export interface MemberRolesMutationError {
  message: string;
  isActiveDuplicate: boolean;
}

interface MemberRolesApiError extends ApiError {
  context: 'core_member_role';
}

export function isActiveDuplicateRoleError(error: unknown): boolean {
  const aggregateMessage = String(JSON.stringify(error)).toLowerCase();
  return aggregateMessage.includes('core_member_role_active_unique');
}

export async function runAddMemberRole(
  secureSupabase: SecureSupabaseClientLike,
  payload: AddMemberRolePayload
): Promise<ApiResult<void, MemberRolesApiError>> {
  const result = (await secureSupabase
    .from('core_member_role')
    .insert({
      member_id: payload.memberId,
      role_id: payload.roleId,
      organisation_id: payload.organisationId,
      start_date: payload.startDate,
      title: payload.title?.trim() ? payload.title.trim() : null,
    })
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (result.error != null) {
    return apiErr<void, MemberRolesApiError>({
      context: 'core_member_role',
      message: HandleSupabaseError(result.error, 'core_member_role').message,
      cause: result.error,
    });
  }

  return apiOk<void, MemberRolesApiError>(undefined);
}

export async function runEndMemberRole(
  secureSupabase: SecureSupabaseClientLike,
  payload: EndMemberRolePayload
): Promise<ApiResult<void, MemberRolesApiError>> {
  const result = (await secureSupabase
    .from('core_member_role')
    .update({ end_date: payload.endDate })
    .eq('id', payload.roleEntryId)
    .eq('organisation_id', payload.organisationId)
    .is('end_date', null)
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (result.error != null) {
    return apiErr<void, MemberRolesApiError>({
      context: 'core_member_role',
      message: HandleSupabaseError(result.error, 'core_member_role').message,
      cause: result.error,
    });
  }

  return apiOk<void, MemberRolesApiError>(undefined);
}

export async function runEditMemberRole(
  secureSupabase: SecureSupabaseClientLike,
  payload: EditMemberRolePayload
): Promise<ApiResult<void, MemberRolesApiError>> {
  const result = (await secureSupabase
    .from('core_member_role')
    .update({
      role_id: payload.roleId,
      title: payload.title?.trim() ? payload.title.trim() : null,
    })
    .eq('id', payload.roleEntryId)
    .eq('organisation_id', payload.organisationId)
    .is('end_date', null)
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (result.error != null) {
    return apiErr<void, MemberRolesApiError>({
      context: 'core_member_role',
      message: HandleSupabaseError(result.error, 'core_member_role').message,
      cause: result.error,
    });
  }

  return apiOk<void, MemberRolesApiError>(undefined);
}

function mapMemberRow(
  raw: {
    id: string;
    organisation_id: string;
    membership_type_id: number | null;
    core_person: {
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
    } | null;
  } | null
): MemberRolesMemberRecord | null {
  if (raw == null) {
    return null;
  }
  return {
    id: raw.id,
    organisationId: raw.organisation_id,
    membershipTypeId: raw.membership_type_id,
    firstName: raw.core_person?.first_name ?? '',
    lastName: raw.core_person?.last_name ?? '',
    preferredName: raw.core_person?.preferred_name ?? null,
  };
}

function mapRoleRows(
  rows: Array<{
    id: string;
    member_id: string;
    role_id: number;
    organisation_id: string;
    start_date: string;
    end_date: string | null;
    title: string | null;
    core_role_type: RoleJoinRow | RoleJoinRow[] | null;
  }> | null
): MemberRoleRow[] {
  return (rows ?? []).map((row) => {
    const roleType = Array.isArray(row.core_role_type) ? row.core_role_type[0] : row.core_role_type;
    return {
      id: row.id,
      memberId: row.member_id,
      roleId: row.role_id,
      organisationId: row.organisation_id,
      startDate: row.start_date,
      endDate: row.end_date,
      roleName: roleType?.name ?? null,
      title: row.title,
    };
  });
}

function mapRoleTypeRows(
  rows: Array<{ id: number; name: string | null; membership_type_id: number | null }> | null
): MemberRoleTypeOption[] {
  return (rows ?? [])
    .filter((row) => row.name != null && row.name.trim().length > 0)
    .map((row) => ({
      id: row.id,
      name: row.name ?? '',
      membershipTypeId: row.membership_type_id,
    }));
}

export function useMemberRolesData({ memberId, organisationId }: UseMemberRolesDataOptions) {
  const secureSupabase = useSecureSupabase() as unknown as SecureSupabaseClientLike | null;
  const queryClient = useQueryClient();

  const memberQuery = useQuery({
    queryKey: ['member', memberId, organisationId],
    enabled: memberId != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MemberRolesMemberRecord | null> => {
      if (memberId == null || organisationId == null || secureSupabase == null) {
        return null;
      }

      const { data, error } = (await secureSupabase
        .from('core_member')
        .select('id, organisation_id, membership_type_id, core_person!inner(first_name, last_name, preferred_name)')
        .eq('id', memberId)
        .is('deleted_at', null)
        .maybeSingle()) as SupabaseQueryResult<{
          id: string;
          organisation_id: string;
          membership_type_id: number | null;
          core_person: {
            first_name: string | null;
            last_name: string | null;
            preferred_name: string | null;
          } | null;
        } | null>;

      if (error != null) {
        throw error;
      }

      return mapMemberRow(data);
    },
  });

  const placementQuery = useQuery({
    queryKey: ['member', memberId, 'placement', organisationId],
    enabled: memberId != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<boolean> => {
      if (memberId == null || organisationId == null || secureSupabase == null) {
        return false;
      }

      const { data, error } = (await secureSupabase
        .from('core_member_role')
        .select('id')
        .eq('member_id', memberId)
        .eq('organisation_id', organisationId)
        .is('end_date', null)
        .maybeSingle()) as SupabaseQueryResult<{ id: string } | null>;

      if (error != null) {
        throw error;
      }

      return data != null;
    },
  });

  const memberAccessibleInSelectedOrg = useMemo(() => {
    if (memberQuery.data == null || organisationId == null) {
      return false;
    }
    return isMemberAccessibleInOrganisation(
      memberQuery.data.organisationId,
      organisationId,
      placementQuery.data === true
    );
  }, [memberQuery.data, organisationId, placementQuery.data]);

  const rolesQuery = useQuery({
    queryKey: ['member', memberId, 'roles', organisationId],
    enabled:
      memberId != null &&
      organisationId != null &&
      secureSupabase != null &&
      memberAccessibleInSelectedOrg,
    queryFn: async (): Promise<MemberRoleRow[]> => {
      if (memberId == null || organisationId == null || secureSupabase == null) {
        return [];
      }
      const { data, error } = (await secureSupabase
        .from('core_member_role')
        .select('id, member_id, role_id, organisation_id, start_date, end_date, title, core_role_type(id, name)')
        .eq('member_id', memberId)
        .eq('organisation_id', organisationId)
        .order('start_date', { ascending: false })) as SupabaseQueryResult<Array<{
          id: string;
          member_id: string;
          role_id: number;
          organisation_id: string;
          start_date: string;
          end_date: string | null;
          title: string | null;
          core_role_type: RoleJoinRow | RoleJoinRow[] | null;
        }> | null>;

      if (error != null) {
        throw error;
      }
      return mapRoleRows(data);
    },
  });

  const roleTypesQuery = useQuery({
    queryKey: ['lookup', 'role-types', organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MemberRoleTypeOption[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_role_type')
        .select('id, name, membership_type_id')
        .eq('organisation_id', organisationId)
        .order('name', { ascending: true })) as SupabaseQueryResult<
          Array<{ id: number; name: string | null; membership_type_id: number | null }> | null
        >;

      if (error != null) {
        throw error;
      }
      return mapRoleTypeRows(data);
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async (payload: AddMemberRolePayload): Promise<void> => {
      if (secureSupabase == null) {
        throw new Error('Secure client unavailable');
      }
      const result = await runAddMemberRole(secureSupabase, payload);
      if (result.ok === false) {
        throw result.error.cause ?? result.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, 'roles', organisationId] });
    },
  });

  const editRoleMutation = useMutation({
    mutationFn: async (payload: EditMemberRolePayload): Promise<void> => {
      if (secureSupabase == null) {
        throw new Error('Secure client unavailable');
      }
      const result = await runEditMemberRole(secureSupabase, payload);
      if (result.ok === false) {
        throw result.error.cause ?? result.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, 'roles', organisationId] });
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, 'placement', organisationId] });
    },
  });

  const endRoleMutation = useMutation({
    mutationFn: async (payload: EndMemberRolePayload): Promise<void> => {
      if (secureSupabase == null) {
        throw new Error('Secure client unavailable');
      }
      const result = await runEndMemberRole(secureSupabase, payload);
      if (result.ok === false) {
        throw result.error.cause ?? result.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, 'roles', organisationId] });
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, 'placement', organisationId] });
    },
  });

  const editRoleErrorMessage = useMemo(() => {
    if (!editRoleMutation.isError) {
      return null;
    }
    return HandleSupabaseError(editRoleMutation.error, 'core_member_role').message;
  }, [editRoleMutation.error, editRoleMutation.isError]);

  const memberErrorMessage = useMemo(() => {
    if (!memberQuery.isError) {
      return null;
    }
    return HandleSupabaseError(memberQuery.error, 'core_member').message;
  }, [memberQuery.error, memberQuery.isError]);

  const rolesErrorMessage = useMemo(() => {
    if (!rolesQuery.isError) {
      return null;
    }
    return HandleSupabaseError(rolesQuery.error, 'core_member_role').message;
  }, [rolesQuery.error, rolesQuery.isError]);

  const addRoleError = useMemo((): MemberRolesMutationError | null => {
    if (!addRoleMutation.isError) {
      return null;
    }
    const normalized = HandleSupabaseError(addRoleMutation.error, 'core_member_role').message;
    const isActiveDuplicate = isActiveDuplicateRoleError(addRoleMutation.error);
    return {
      message: normalized,
      isActiveDuplicate,
    };
  }, [addRoleMutation.error, addRoleMutation.isError]);

  const endRoleErrorMessage = useMemo(() => {
    if (!endRoleMutation.isError) {
      return null;
    }
    return HandleSupabaseError(endRoleMutation.error, 'core_member_role').message;
  }, [endRoleMutation.error, endRoleMutation.isError]);

  return {
    member: memberQuery.data ?? null,
    memberAccessibleInSelectedOrg,
    memberLoading: memberQuery.isLoading || placementQuery.isLoading,
    memberErrorMessage,
    refetchMember: memberQuery.refetch,

    roles: rolesQuery.data ?? [],
    rolesLoading: rolesQuery.isLoading,
    rolesErrorMessage,
    refetchRoles: rolesQuery.refetch,

    roleTypes: roleTypesQuery.data ?? [],
    roleTypesLoading: roleTypesQuery.isLoading,
    roleTypesErrorMessage: roleTypesQuery.isError ? HandleSupabaseError(roleTypesQuery.error, 'core_role_type').message : null,
    refetchRoleTypes: roleTypesQuery.refetch,

    addRole: addRoleMutation.mutateAsync,
    addRolePending: addRoleMutation.isPending,
    addRoleError,
    resetAddRole: addRoleMutation.reset,

    editRole: editRoleMutation.mutateAsync,
    editRolePending: editRoleMutation.isPending,
    editRoleErrorMessage,
    resetEditRole: editRoleMutation.reset,

    endRole: endRoleMutation.mutateAsync,
    endRolePending: endRoleMutation.isPending,
    endRoleErrorMessage,
    resetEndRole: endRoleMutation.reset,
  };
}
