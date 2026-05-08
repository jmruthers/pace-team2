/* eslint-disable pace-core-compliance/max-named-exports */
import type {
  AdditionalContactRow,
  ApplicationStatus,
  ContactPermissionType,
  IdentityFormValues,
  LookupOption,
  MemberApplicationRow,
  MemberPhoneRow,
  MemberProfileRecord,
  MembershipStatus,
} from './member360.types';

type BadgeVariant =
  | 'soft-main-normal'
  | 'soft-sec-normal'
  | 'soft-sec-muted'
  | 'soft-acc-normal';

const APPLICATION_STATUS_COPY: Record<Exclude<ApplicationStatus, 'draft'>, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function getDisplayName(firstName: string | null, lastName: string | null, preferredName: string | null): string {
  const preferred = preferredName?.trim();
  const first = firstName?.trim() ?? '';
  const last = lastName?.trim() ?? '';
  if (preferred != null && preferred.length > 0) {
    return `${preferred} ${last}`.trim();
  }
  return `${first} ${last}`.trim() || '—';
}

export function getMemberDisplayName(member: Pick<MemberProfileRecord, 'firstName' | 'lastName' | 'preferredName'>): string {
  return getDisplayName(member.firstName, member.lastName, member.preferredName);
}

export function formatShortDate(value: string | null): string {
  if (value == null || value.trim().length === 0) {
    return '—';
  }

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

export function formatOptionalText(value: string | null): string {
  if (value == null || value.trim().length === 0) {
    return '—';
  }
  return value;
}

export function formatPhoneRows(phones: MemberPhoneRow[]): string {
  if (phones.length === 0) {
    return '—';
  }

  return phones
    .map((phone) => {
      const typeName = formatOptionalText(phone.phoneTypeName);
      const number = formatOptionalText(phone.phoneNumber);
      if (typeName === '—') {
        return number;
      }
      return `${typeName}: ${number}`;
    })
    .join(', ');
}

export function membershipStatusBadgeVariant(status: MembershipStatus): BadgeVariant {
  switch (status) {
    case 'Active':
      return 'soft-main-normal';
    case 'Revoked':
      return 'soft-acc-normal';
    case 'Provisional':
      return 'soft-sec-normal';
    case 'Suspended':
    case 'Lapsed':
    case 'Resigned':
      return 'soft-sec-muted';
    default:
      return 'soft-sec-normal';
  }
}

export function cardActiveBadgeVariant(isActive: boolean): BadgeVariant {
  return isActive ? 'soft-main-normal' : 'soft-sec-muted';
}

export function contactTierLabel(permissionType: ContactPermissionType): string {
  if (permissionType === 'full') {
    return 'Full';
  }
  if (permissionType === 'notify') {
    return 'Notify';
  }
  return 'None';
}

export function contactTierBadgeVariant(permissionType: ContactPermissionType): BadgeVariant {
  return permissionType === 'full' ? 'soft-sec-normal' : 'soft-sec-muted';
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  if (status === 'draft') {
    return 'Draft';
  }
  return APPLICATION_STATUS_COPY[status];
}

export function applicationStatusBadgeVariant(status: ApplicationStatus): BadgeVariant {
  if (status === 'approved') {
    return 'soft-main-normal';
  }
  if (status === 'rejected') {
    return 'soft-acc-normal';
  }
  if (status === 'withdrawn') {
    return 'soft-sec-muted';
  }
  return 'soft-sec-normal';
}

export function toIdentityFormValues(member: MemberProfileRecord): IdentityFormValues {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    preferredName: member.preferredName ?? '',
    email: member.email ?? '',
    dateOfBirth: member.dateOfBirth ?? '',
    genderId: member.genderId == null ? '' : String(member.genderId),
    pronounId: member.pronounId == null ? '' : String(member.pronounId),
    membershipTypeId: member.membershipTypeId == null ? '' : String(member.membershipTypeId),
    membershipNumber: member.membershipNumber ?? '',
    validFrom: member.validFrom ?? '',
    validTo: member.validTo ?? '',
  };
}

export function normalizeOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function lookupContainsId(options: LookupOption[], id: number): boolean {
  return options.some((option) => option.id === id);
}

export function filterContacts(rows: AdditionalContactRow[], query: string): AdditionalContactRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return rows;
  }

  return rows.filter((row) => {
    const searchable = [
      row.firstName ?? '',
      row.lastName ?? '',
      row.preferredName ?? '',
      row.contactTypeName ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function filterCards<T extends { cardIdentifier: string }>(rows: T[], query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return rows;
  }

  return rows.filter((row) => row.cardIdentifier.toLowerCase().includes(normalizedQuery));
}

export function filterApplications(rows: MemberApplicationRow[], query: string): MemberApplicationRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return rows;
  }

  return rows.filter((row) => (row.eventName ?? '').toLowerCase().includes(normalizedQuery));
}
