import { HandleSupabaseError } from '@solvera/pace-core/utils';

const MANUAL_PICK_STORAGE_KEY = 'pace:team:comms:manual-pick';

const OPEN_REQUEST_STATUSES = ['pending', 'on_hold'] as const;
const OPEN_REQUEST_TYPES = ['join', 'transfer'] as const;

type MembershipStatus = 'Active' | 'Suspended' | 'Provisional' | 'Lapsed' | 'Resigned' | 'Revoked';
type RequestStatus = (typeof OPEN_REQUEST_STATUSES)[number];
type RequestType = (typeof OPEN_REQUEST_TYPES)[number];

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

interface TeamMemberRequestRecord {
  id: string;
  organisation_id: string;
  subject_member_id: string | null;
  subject_person_id: string | null;
  request_type: RequestType;
  status: RequestStatus;
  created_at: string;
}

export interface MembershipTypeOption {
  id: number;
  name: string;
}

export interface MemberDirectoryRow {
  id: string;
  personId: string;
  membershipNumber: string | null;
  membershipStatus: MembershipStatus;
  membershipTypeId: number | null;
  membershipTypeName: string | null;
  organisationId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string | null;
}

export interface PendingDirectoryRow extends MemberDirectoryRow {
  requestType: RequestType;
  requestedAt: string;
}

export interface ManualPickPayload {
  organisationId: string;
  memberIds: string[];
  updatedAt: number;
}

export interface PickerBannerState {
  variant: 'default' | 'destructive';
  title: string;
  description: string;
  doneEnabled: boolean;
  showEmptyHelper: boolean;
}

type SupabaseLike = {
  from: (table: string) => {
    select: (selection: string) => any;
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

export function getMemberDisplayName(row: Pick<MemberDirectoryRow, 'preferredName' | 'firstName' | 'lastName'>): string {
  const preferred = row.preferredName?.trim();
  if (preferred != null && preferred.length > 0) {
    return `${preferred} ${row.lastName}`.trim();
  }
  return `${row.firstName} ${row.lastName}`.trim();
}

export function formatMembershipNumber(value: string | null): string {
  return value == null || value.length === 0 ? '—' : value;
}

export function formatShortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function filterDirectoryRows<T extends MemberDirectoryRow>(rows: T[], search: string): T[] {
  const normalized = search.trim().toLowerCase();
  if (normalized.length === 0) {
    return rows;
  }

  return rows.filter((row) => {
    const fields = [row.lastName, row.firstName, row.preferredName ?? '', row.email ?? '', row.membershipNumber ?? ''];
    return fields.some((field) => field.toLowerCase().includes(normalized));
  });
}

export function getPickerBannerState(selectedCount: number): PickerBannerState {
  if (selectedCount > 2000) {
    return {
      variant: 'destructive',
      title: 'Selection too large',
      description: 'Reduce selection to at most 2000 members.',
      doneEnabled: false,
      showEmptyHelper: false,
    };
  }

  if (selectedCount > 500) {
    return {
      variant: 'default',
      title: 'Large audience',
      description: `Confirm you intend to message ${selectedCount} members.`,
      doneEnabled: true,
      showEmptyHelper: false,
    };
  }

  if (selectedCount === 0) {
    return {
      variant: 'default',
      title: 'Selecting members for a comms send',
      description: '0 selected',
      doneEnabled: false,
      showEmptyHelper: true,
    };
  }

  return {
    variant: 'default',
    title: 'Selecting members for a comms send',
    description: `${selectedCount} selected`,
    doneEnabled: true,
    showEmptyHelper: false,
  };
}

export function toSelectionRecord(selectedIds: string[]): Record<string, boolean> {
  return selectedIds.reduce<Record<string, boolean>>((accumulator, memberId) => {
    accumulator[memberId] = true;
    return accumulator;
  }, {});
}

export function selectionRecordToIds(selection: Record<string, boolean>): string[] {
  return Object.entries(selection)
    .filter(([, isSelected]) => isSelected)
    .map(([memberId]) => memberId);
}

export function readManualPickPayload(rawPayload: string | null, organisationId: string): string[] {
  if (rawPayload == null) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<ManualPickPayload>;
    if (parsed.organisationId !== organisationId || !Array.isArray(parsed.memberIds)) {
      return [];
    }
    return parsed.memberIds.filter((memberId): memberId is string => typeof memberId === 'string');
  } catch {
    return [];
  }
}

export function buildManualPickPayload(organisationId: string, memberIds: string[]): ManualPickPayload {
  return {
    organisationId,
    memberIds,
    updatedAt: Date.now(),
  };
}

export function getManualPickStorageKey(): string {
  return MANUAL_PICK_STORAGE_KEY;
}

export function matchPendingRequests(
  members: MemberDirectoryRow[],
  requests: TeamMemberRequestRecord[]
): PendingDirectoryRow[] {
  const requestsByMember = new Map<string, TeamMemberRequestRecord[]>();

  requests.forEach((request) => {
    const memberKey = request.subject_member_id ?? request.subject_person_id;
    if (memberKey == null) {
      return;
    }
    const existing = requestsByMember.get(memberKey) ?? [];
    existing.push(request);
    requestsByMember.set(memberKey, existing);
  });

  const matchedRows: PendingDirectoryRow[] = [];

  members.forEach((member) => {
    const byMemberId = requestsByMember.get(member.id) ?? [];
    const byPersonId = requestsByMember.get(member.personId) ?? [];
    const combined = [...byMemberId, ...byPersonId];
    if (combined.length === 0) {
      return;
    }
    combined.sort((left, right) => right.created_at.localeCompare(left.created_at));
    const [latest] = combined;
    if (latest == null) {
      return;
    }

    matchedRows.push({
      ...member,
      requestType: latest.request_type,
      requestedAt: latest.created_at,
    });
  });

  return sortRowsByName(matchedRows);
}

export async function fetchMembershipTypeOptions(
  supabase: SupabaseLike,
  organisationId: string
): Promise<MembershipTypeOption[]> {
  const { data, error } = await supabase
    .from('core_membership_type')
    .select('id, name')
    .eq('organisation_id', organisationId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error != null) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ id: number; name: string }>;
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function fetchMembers(
  supabase: SupabaseLike,
  organisationId: string,
  membershipTypeId: number | null
): Promise<MemberDirectoryRow[]> {
  let query = supabase
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

  if (membershipTypeId != null) {
    query = query.eq('membership_type_id', membershipTypeId);
  }

  const { data, error } = await query;

  if (error != null) {
    throw error;
  }

  return sortRowsByName(((data ?? []) as CoreMemberRecord[]).map(mapCoreMemberRow));
}

export async function fetchPendingMembers(
  supabase: SupabaseLike,
  organisationId: string
): Promise<PendingDirectoryRow[]> {
  const membersQuery = supabase
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

  const requestsQuery = supabase
    .from('team_member_request')
    .select('id, organisation_id, subject_member_id, subject_person_id, request_type, status, created_at')
    .eq('organisation_id', organisationId)
    .in('status', [...OPEN_REQUEST_STATUSES])
    .in('request_type', [...OPEN_REQUEST_TYPES])
    .order('created_at', { ascending: false });

  const [{ data: memberData, error: memberError }, { data: requestData, error: requestError }] = await Promise.all([
    membersQuery,
    requestsQuery,
  ]);

  if (memberError != null) {
    throw memberError;
  }

  if (requestError != null) {
    throw requestError;
  }

  const members = ((memberData ?? []) as CoreMemberRecord[]).map(mapCoreMemberRow);
  const requests = (requestData ?? []) as TeamMemberRequestRecord[];

  return matchPendingRequests(members, requests);
}

export function normaliseSupabaseError(error: unknown, context: 'core_member' | 'team_member_request'): string {
  const result = HandleSupabaseError(error, context);
  return result.message;
}
