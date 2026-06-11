import type {
  MemberDirectoryRow,
  PendingDirectoryRow,
  TeamMemberRequestMatchRecord,
} from './memberDirectory.types';

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

function sortRowsByName<T extends MemberDirectoryRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byLastName = a.lastName.localeCompare(b.lastName);
    if (byLastName !== 0) {
      return byLastName;
    }
    return a.firstName.localeCompare(b.firstName);
  });
}

export function mergeMemberDirectoryRows(...rowGroups: MemberDirectoryRow[][]): MemberDirectoryRow[] {
  const byId = new Map<string, MemberDirectoryRow>();
  rowGroups.flat().forEach((row) => {
    byId.set(row.id, row);
  });
  return sortRowsByName([...byId.values()]);
}

export function buildPendingDirectoryFromRequests(
  requests: TeamMemberRequestMatchRecord[],
  membersById: Map<string, MemberDirectoryRow>,
  membersByPersonId: Map<string, MemberDirectoryRow>
): PendingDirectoryRow[] {
  const requestsByMember = new Map<string, TeamMemberRequestMatchRecord[]>();

  requests.forEach((request) => {
    const memberKey =
      request.subject_member_id ??
      (request.subject_person_id != null ? membersByPersonId.get(request.subject_person_id)?.id : undefined);
    if (memberKey == null) {
      return;
    }
    const existing = requestsByMember.get(memberKey) ?? [];
    existing.push(request);
    requestsByMember.set(memberKey, existing);
  });

  const matchedRows: PendingDirectoryRow[] = [];
  requestsByMember.forEach((memberRequests, memberId) => {
    const member = membersById.get(memberId);
    if (member == null) {
      return;
    }
    memberRequests.sort((left, right) => right.created_at.localeCompare(left.created_at));
    const [latest] = memberRequests;
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

export function matchPendingRequests(
  members: MemberDirectoryRow[],
  requests: TeamMemberRequestMatchRecord[]
): PendingDirectoryRow[] {
  const requestsByMember = new Map<string, TeamMemberRequestMatchRecord[]>();

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
