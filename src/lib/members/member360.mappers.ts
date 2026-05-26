import type { LookupOption, MemberProfileRecord } from '@/lib/members/member360.types';
import type { MemberFetchRaw } from '@/lib/members/member360.supabase';

type JoinedPerson = {
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender_id: number | null;
  pronoun_id: number | null;
  user_id: string | null;
  residential_address_id: string | null;
  postal_address_id: string | null;
  residential_address: { id: string; full_address: string | null } | null;
  postal_address: { id: string; full_address: string | null } | null;
};

function mapCorePersonFields(
  raw: MemberFetchRaw,
  corePerson: JoinedPerson | null,
  genderType: { name: string | null } | null,
  pronounType: { name: string | null } | null,
  residentialAddress: { full_address: string | null } | null,
  postalAddress: { full_address: string | null } | null
): Pick<
  MemberProfileRecord,
  | 'personId'
  | 'firstName'
  | 'lastName'
  | 'preferredName'
  | 'email'
  | 'dateOfBirth'
  | 'genderId'
  | 'genderName'
  | 'pronounId'
  | 'pronounName'
  | 'userId'
  | 'residentialAddressId'
  | 'residentialAddress'
  | 'postalAddressId'
  | 'postalAddress'
> {
  return {
    personId: String(raw.person_id ?? ''),
    firstName: corePerson?.first_name ?? '',
    lastName: corePerson?.last_name ?? '',
    preferredName: corePerson?.preferred_name ?? null,
    email: corePerson?.email ?? null,
    dateOfBirth: corePerson?.date_of_birth ?? null,
    genderId: corePerson?.gender_id ?? null,
    genderName: genderType?.name ?? null,
    pronounId: corePerson?.pronoun_id ?? null,
    pronounName: pronounType?.name ?? null,
    userId: corePerson?.user_id ?? null,
    residentialAddressId: corePerson?.residential_address_id ?? null,
    residentialAddress: residentialAddress?.full_address ?? null,
    postalAddressId: corePerson?.postal_address_id ?? null,
    postalAddress: postalAddress?.full_address ?? null,
  };
}

function mapMembershipFields(
  raw: MemberFetchRaw,
  membershipType: { name: string | null } | null
): Pick<
  MemberProfileRecord,
  | 'membershipTypeId'
  | 'membershipTypeName'
  | 'membershipNumber'
  | 'membershipStatus'
  | 'validFrom'
  | 'validTo'
> {
  return {
    membershipTypeId: (raw.membership_type_id as number | null) ?? null,
    membershipTypeName: membershipType?.name ?? null,
    membershipNumber: (raw.membership_number as string | null) ?? null,
    membershipStatus: (raw.membership_status as MemberProfileRecord['membershipStatus']) ?? 'Provisional',
    validFrom: (raw.valid_from as string | null) ?? null,
    validTo: (raw.valid_to as string | null) ?? null,
  };
}

export function mapMemberRow(raw: MemberFetchRaw): MemberProfileRecord {
  const corePerson = (raw.core_person ?? null) as JoinedPerson | null;
  const membershipType = (raw.core_membership_type ?? null) as { id: number; name: string | null } | null;
  const genderType = (raw.core_gender_type ?? null) as { id: number; name: string | null } | null;
  const pronounType = (raw.core_pronoun_type ?? null) as { id: number; name: string | null } | null;
  const residentialAddress = corePerson?.residential_address ?? null;
  const postalAddress = corePerson?.postal_address ?? null;

  return {
    id: String(raw.id ?? ''),
    organisationId: String(raw.organisation_id ?? ''),
    ...mapCorePersonFields(raw, corePerson, genderType, pronounType, residentialAddress, postalAddress),
    ...mapMembershipFields(raw, membershipType),
  };
}

export function toLookupRows(rows: Array<{ id: number; name: string | null }> | null | undefined): LookupOption[] {
  return (rows ?? [])
    .filter((row) => row.name != null && row.name.trim().length > 0)
    .map((row) => ({ id: row.id, name: row.name ?? '' }));
}

export function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
