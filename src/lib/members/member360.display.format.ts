import type {
  IdentityFormValues,
  LookupOption,
  MemberPhoneRow,
  MemberProfileRecord,
} from './member360.types';

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
