import type { MemberRoleRow, MemberRolesMemberRecord } from './memberRoles.types';

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function toLocalDate(dateValue: string): Date {
  return new Date(`${dateValue}T00:00:00`);
}

export function getMemberRolesDisplayName(member: MemberRolesMemberRecord): string {
  const preferredName = member.preferredName?.trim() ?? '';
  const firstName = member.firstName.trim();
  const lastName = member.lastName.trim();
  if (preferredName.length > 0) {
    return `${preferredName} ${lastName}`.trim();
  }
  return `${firstName} ${lastName}`.trim();
}

export function formatRoleDate(dateValue: string | null): string {
  if (dateValue == null || dateValue.trim().length === 0) {
    return '—';
  }
  return shortDateFormatter.format(toLocalDate(dateValue));
}

export function getRoleStatusLabel(role: MemberRoleRow): 'Active' | 'Ended' {
  return role.endDate == null ? 'Active' : 'Ended';
}

export function getRoleStatusVariant(role: MemberRoleRow): 'soft-main-normal' | 'soft-sec-normal' {
  return role.endDate == null ? 'soft-main-normal' : 'soft-sec-normal';
}

export function roleMatchesSearch(role: MemberRoleRow, searchValue: string): boolean {
  const normalizedSearch = searchValue.trim().toLowerCase();
  if (normalizedSearch.length === 0) {
    return true;
  }
  const roleName = role.roleName ?? '';
  return roleName.toLowerCase().includes(normalizedSearch);
}

export function toDateOnlyValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isUniqueConstraintRace(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false;
  }
  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const aggregateMessage = [candidate.code, candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return aggregateMessage.includes('core_member_role_active_unique');
}
