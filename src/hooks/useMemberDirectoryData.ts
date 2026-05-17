import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { useActiveOrganisationMembershipTypes } from '@/hooks/useActiveOrganisationMembershipTypes';
import type {
  MemberDirectoryRow,
  MembershipStatus,
  PendingDirectoryRow,
  TeamMemberRequestMatchRecord,
} from '../lib/members/memberDirectory.types';
import { matchPendingRequests } from '../lib/members/memberDirectory.display';

const OPEN_REQUEST_STATUSES = ['pending', 'on_hold'] as const;
const OPEN_REQUEST_TYPES = ['join', 'transfer'] as const;

interface PersonRecord {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
}

interface MembershipTypeRecord {
  id: number;
  name: string | null;
}

interface CoreMemberRecord {
  id: string;
  person_id: string;
  membership_number: string | null;
  membership_status: MembershipStatus;
  membership_type_id: number | null;
  organisation_id: string;
  core_person: PersonRecord | PersonRecord[] | null;
  core_membership_type: MembershipTypeRecord | MembershipTypeRecord[] | null;
}

type QueryBuilder = {
  eq: (column: string, value: string | number | boolean | null) => QueryBuilder;
  is: (column: string, value: null) => QueryBuilder;
  in: (column: string, values: readonly string[]) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean; referencedTable?: string }) => QueryBuilder;
  then: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ) => Promise<TResult1 | TResult2>;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (selection: string) => QueryBuilder;
  };
};

function asArray<T>(value: T | T[] | null): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null) {
    return [];
  }
  return [value];
}

function resolvePerson(value: CoreMemberRecord['core_person']): PersonRecord {
  const [person] = asArray(value);
  return {
    id: person?.id ?? '',
    first_name: person?.first_name ?? '',
    last_name: person?.last_name ?? '',
    preferred_name: person?.preferred_name ?? null,
    email: person?.email ?? null,
  };
}

function resolveMembershipType(value: CoreMemberRecord['core_membership_type']): MembershipTypeRecord | null {
  const [membershipType] = asArray(value);
  if (membershipType == null) {
    return null;
  }
  return {
    id: membershipType.id,
    name: membershipType.name,
  };
}

function mapCoreMemberRow(record: CoreMemberRecord): MemberDirectoryRow {
  const person = resolvePerson(record.core_person);
  const membershipType = resolveMembershipType(record.core_membership_type);

  return {
    id: record.id,
    personId: record.person_id,
    membershipNumber: record.membership_number,
    membershipStatus: record.membership_status,
    membershipTypeId: record.membership_type_id,
    membershipTypeName: membershipType?.name ?? null,
    organisationId: record.organisation_id,
    firstName: person.first_name ?? '',
    lastName: person.last_name ?? '',
    preferredName: person.preferred_name,
    email: person.email,
  };
}

function sortRowsByName<T extends MemberDirectoryRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byLastName = a.lastName.localeCompare(b.lastName);
    if (byLastName !== 0) {
      return byLastName;
    }
    return a.firstName.localeCompare(b.firstName);
  });
}

export function useMemberDirectoryData(
  organisationId: string | null,
  membershipTypeFilter: number | null
) {
  const secureSupabase = useSecureSupabase() as SupabaseLike | null;
  const { memberTypes } = useActiveOrganisationMembershipTypes(organisationId);

  const membersQuery = useQuery({
    queryKey: ['members', 'active', organisationId, membershipTypeFilter ?? 'all'],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MemberDirectoryRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      let query = secureSupabase
        .from('core_member')
        .select(
          [
            'id',
            'person_id',
            'membership_number',
            'membership_status',
            'membership_type_id',
            'organisation_id',
            'core_person!inner(id, first_name, last_name, preferred_name, email)',
            'core_membership_type(id, name)',
          ].join(', ')
        )
        .eq('organisation_id', organisationId)
        .is('deleted_at', null)
        .in('membership_status', ['Active', 'Suspended'])
        .order('last_name', { ascending: true, referencedTable: 'core_person' })
        .order('first_name', { ascending: true, referencedTable: 'core_person' });

      if (membershipTypeFilter != null) {
        query = query.eq('membership_type_id', membershipTypeFilter);
      }

      const { data, error } = (await query) as {
          data: CoreMemberRecord[];
          error: unknown;
        };

      if (error != null) {
        throw error;
      }

      return sortRowsByName((data ?? []).map(mapCoreMemberRow));
    },
  });

  const pendingQuery = useQuery({
    queryKey: ['members', 'pending', organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<PendingDirectoryRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const membersPromise = secureSupabase
        .from('core_member')
        .select(
          [
            'id',
            'person_id',
            'membership_number',
            'membership_status',
            'membership_type_id',
            'organisation_id',
            'core_person!inner(id, first_name, last_name, preferred_name, email)',
            'core_membership_type(id, name)',
          ].join(', ')
        )
        .eq('organisation_id', organisationId)
        .is('deleted_at', null)
        .eq('membership_status', 'Provisional')
        .order('last_name', { ascending: true, referencedTable: 'core_person' })
        .order('first_name', { ascending: true, referencedTable: 'core_person' });

      const requestsPromise = secureSupabase
        .from('team_member_request')
        .select('id, organisation_id, subject_member_id, subject_person_id, request_type, status, created_at')
        .eq('organisation_id', organisationId)
        .in('status', [...OPEN_REQUEST_STATUSES])
        .in('request_type', [...OPEN_REQUEST_TYPES])
        .order('created_at', { ascending: false });

      const [{ data: memberData, error: memberError }, { data: requestData, error: requestError }] = (await Promise.all([
        membersPromise,
        requestsPromise,
      ])) as [
        { data: CoreMemberRecord[]; error: unknown },
        { data: TeamMemberRequestMatchRecord[]; error: unknown },
      ];

      if (memberError != null) {
        throw memberError;
      }
      if (requestError != null) {
        throw requestError;
      }

      return matchPendingRequests((memberData ?? []).map(mapCoreMemberRow), requestData ?? []);
    },
  });

  const membersErrorMessage = useMemo(() => {
    if (!membersQuery.isError) {
      return null;
    }
    return HandleSupabaseError(membersQuery.error, 'core_member').message;
  }, [membersQuery.error, membersQuery.isError]);

  const pendingErrorMessage = useMemo(() => {
    if (!pendingQuery.isError) {
      return null;
    }
    return HandleSupabaseError(pendingQuery.error, 'team_member_request').message;
  }, [pendingQuery.error, pendingQuery.isError]);

  return {
    memberTypes,
    members: membersQuery.data ?? [],
    pendingMembers: pendingQuery.data ?? [],
    membersLoading: membersQuery.isLoading,
    pendingLoading: pendingQuery.isLoading,
    membersErrorMessage,
    pendingErrorMessage,
    refetchMembers: membersQuery.refetch,
    refetchPending: pendingQuery.refetch,
  };
}
