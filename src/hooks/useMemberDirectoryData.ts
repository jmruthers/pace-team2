import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { useActiveOrganisationMembershipTypes } from '@/hooks/useActiveOrganisationMembershipTypes';
import {
  buildPendingDirectoryFromRequests,
  mergeMemberDirectoryRows,
} from '../lib/members/memberDirectory.display';
import type {
  MemberDirectoryRow,
  MembershipStatus,
  PendingDirectoryRow,
  TeamMemberRequestMatchRecord,
} from '../lib/members/memberDirectory.types';

const OPEN_REQUEST_STATUSES = ['pending', 'on_hold'] as const;
const OPEN_REQUEST_TYPES = ['join', 'transfer'] as const;

const MEMBER_SELECT_FIELDS = [
  'id',
  'person_id',
  'membership_number',
  'membership_status',
  'membership_type_id',
  'organisation_id',
  'core_person!inner(id, first_name, last_name, preferred_name, email)',
  'core_membership_type(id, name)',
].join(', ');

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

function indexMembersByIdAndPerson(rows: MemberDirectoryRow[]): {
  membersById: Map<string, MemberDirectoryRow>;
  membersByPersonId: Map<string, MemberDirectoryRow>;
} {
  const membersById = new Map<string, MemberDirectoryRow>();
  const membersByPersonId = new Map<string, MemberDirectoryRow>();
  rows.forEach((row) => {
    membersById.set(row.id, row);
    membersByPersonId.set(row.personId, row);
  });
  return { membersById, membersByPersonId };
}

async function fetchActiveMembersForOrganisation(
  secureSupabase: SupabaseLike,
  organisationId: string,
  membershipTypeFilter: number | null
): Promise<MemberDirectoryRow[]> {
  let flatOrgQuery = secureSupabase
    .from('core_member')
    .select(MEMBER_SELECT_FIELDS)
    .eq('organisation_id', organisationId)
    .is('deleted_at', null)
    .in('membership_status', ['Active', 'Suspended'])
    .order('last_name', { ascending: true, referencedTable: 'core_person' })
    .order('first_name', { ascending: true, referencedTable: 'core_person' });

  let placementQuery = secureSupabase
    .from('core_member')
    .select(`${MEMBER_SELECT_FIELDS}, core_member_role!inner(organisation_id, end_date)`)
    .eq('core_member_role.organisation_id', organisationId)
    .is('core_member_role.end_date', null)
    .is('deleted_at', null)
    .in('membership_status', ['Active', 'Suspended'])
    .order('last_name', { ascending: true, referencedTable: 'core_person' })
    .order('first_name', { ascending: true, referencedTable: 'core_person' });

  if (membershipTypeFilter != null) {
    flatOrgQuery = flatOrgQuery.eq('membership_type_id', membershipTypeFilter);
    placementQuery = placementQuery.eq('membership_type_id', membershipTypeFilter);
  }

  const [flatOrgResult, placementResult] = (await Promise.all([flatOrgQuery, placementQuery])) as [
    { data: CoreMemberRecord[]; error: unknown },
    { data: CoreMemberRecord[]; error: unknown },
  ];

  if (flatOrgResult.error != null) {
    throw flatOrgResult.error;
  }
  if (placementResult.error != null) {
    throw placementResult.error;
  }

  return mergeMemberDirectoryRows(
    (flatOrgResult.data ?? []).map(mapCoreMemberRow),
    (placementResult.data ?? []).map(mapCoreMemberRow)
  );
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

      return fetchActiveMembersForOrganisation(secureSupabase, organisationId, membershipTypeFilter);
    },
  });

  const pendingQuery = useQuery({
    queryKey: ['members', 'pending', organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<PendingDirectoryRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data: requestData, error: requestError } = (await secureSupabase
        .from('team_member_request')
        .select('id, organisation_id, subject_member_id, subject_person_id, request_type, status, created_at')
        .eq('organisation_id', organisationId)
        .in('status', [...OPEN_REQUEST_STATUSES])
        .in('request_type', [...OPEN_REQUEST_TYPES])
        .order('created_at', { ascending: false })) as {
        data: TeamMemberRequestMatchRecord[];
        error: unknown;
      };

      if (requestError != null) {
        throw requestError;
      }

      const requests = requestData ?? [];
      const memberIds = [
        ...new Set(
          requests
            .map((request) => request.subject_member_id)
            .filter((id): id is string => id != null)
        ),
      ];

      if (memberIds.length === 0) {
        return [];
      }

      const { data: memberData, error: memberError } = (await secureSupabase
        .from('core_member')
        .select(MEMBER_SELECT_FIELDS)
        .in('id', memberIds)
        .is('deleted_at', null)) as {
        data: CoreMemberRecord[];
        error: unknown;
      };

      if (memberError != null) {
        throw memberError;
      }

      const members = (memberData ?? []).map(mapCoreMemberRow);
      const { membersById, membersByPersonId } = indexMembersByIdAndPerson(members);

      return buildPendingDirectoryFromRequests(requests, membersById, membersByPersonId);
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
