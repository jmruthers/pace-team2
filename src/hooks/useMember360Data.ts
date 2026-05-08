/* eslint-disable complexity, max-lines-per-function */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import type {
  AdditionalContactRow,
  ApplicationStatus,
  ContactDetailData,
  LookupOption,
  MemberApplicationRow,
  MemberCardRow,
  MemberPhoneRow,
  MemberProfileRecord,
} from '@/lib/members/member360.types';
import { formatPhoneRows, lookupContainsId, normalizeOptionalString } from '@/lib/members/member360.display';

type SupabaseQueryResult<T> = { data: T; error: unknown };
type MemberFetchRaw = Record<string, unknown>;

interface SupabaseQueryBuilderLike extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): SupabaseQueryBuilderLike;
  is(column: string, value: null): SupabaseQueryBuilderLike;
  in(column: string, value: string[]): SupabaseQueryBuilderLike;
  neq(column: string, value: string): SupabaseQueryBuilderLike;
  order(column: string, options?: { ascending?: boolean; referencedTable?: string }): SupabaseQueryBuilderLike;
  select(selection?: string): SupabaseQueryBuilderLike;
  maybeSingle(): Promise<unknown>;
  single(): Promise<unknown>;
}

interface SupabaseTableClientLike {
  select(selection: string): SupabaseQueryBuilderLike;
  update(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
}

interface SecureSupabaseClientLike {
  from(table: string): SupabaseTableClientLike;
}

interface UseMember360DataOptions {
  memberId: string | undefined;
  organisationId: string | null;
}

interface SaveIdentityParams {
  member: MemberProfileRecord;
  values: {
    firstName: string;
    lastName: string;
    preferredName: string;
    email: string;
    dateOfBirth: string;
    genderId: string;
    pronounId: string;
    membershipTypeId: string;
    membershipNumber: string;
    validFrom: string;
    validTo: string;
  };
  lookups: {
    genderTypes: LookupOption[];
    pronounTypes: LookupOption[];
    membershipTypes: LookupOption[];
  };
}

export interface Member360MutationError {
  context: 'core_member' | 'core_person' | 'core_member_card';
  message: string;
}

interface IdentitySavePayload {
  memberId: string;
  personId: string;
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  dateOfBirth: string;
  genderId: number | null;
  pronounId: number | null;
  membershipTypeId: number | null;
  membershipNumber: string;
  validFrom: string;
  validTo: string;
}

function asMutationError(error: unknown, context: Member360MutationError['context']): Member360MutationError {
  return {
    context,
    message: HandleSupabaseError(error, context).message,
  };
}

export async function runIdentitySave(
  secureSupabase: SecureSupabaseClientLike,
  payload: IdentitySavePayload
): Promise<void> {
  const personPayload = {
    first_name: payload.firstName.trim(),
    last_name: payload.lastName.trim(),
    preferred_name: normalizeOptionalString(payload.preferredName),
    email: normalizeOptionalString(payload.email),
    date_of_birth: normalizeOptionalString(payload.dateOfBirth),
    gender_id: payload.genderId,
    pronoun_id: payload.pronounId,
  };

  const memberPayload = {
    membership_type_id: payload.membershipTypeId,
    membership_number: normalizeOptionalString(payload.membershipNumber),
    valid_from: normalizeOptionalString(payload.validFrom),
    valid_to: normalizeOptionalString(payload.validTo),
  };

  const personUpdate = (await secureSupabase
    .from('core_person')
    .update(personPayload)
    .eq('id', payload.personId)
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (personUpdate.error != null) {
    throw asMutationError(personUpdate.error, 'core_person');
  }

  const memberUpdate = (await secureSupabase
    .from('core_member')
    .update(memberPayload)
    .eq('id', payload.memberId)
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (memberUpdate.error != null) {
    throw asMutationError(memberUpdate.error, 'core_member');
  }
}

export async function runCardActivationUpdate(
  secureSupabase: SecureSupabaseClientLike,
  payload: { cardId: string; isActive: boolean }
): Promise<void> {
  const result = (await secureSupabase
    .from('core_member_card')
    .update({ is_active: payload.isActive })
    .eq('id', payload.cardId)
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (result.error != null) {
    throw asMutationError(result.error, 'core_member_card');
  }
}

function parseInteger(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toLookupRows(rows: Array<{ id: number; name: string | null }> | null | undefined): LookupOption[] {
  return (rows ?? [])
    .filter((row) => row.name != null && row.name.trim().length > 0)
    .map((row) => ({ id: row.id, name: row.name ?? '' }));
}

function mapMemberRow(raw: MemberFetchRaw): MemberProfileRecord {
  const corePerson = (raw.core_person ?? null) as
    | {
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
      }
    | null;
  const membershipType = (raw.core_membership_type ?? null) as { id: number; name: string | null } | null;
  const genderType = (raw.core_gender_type ?? null) as { id: number; name: string | null } | null;
  const pronounType = (raw.core_pronoun_type ?? null) as { id: number; name: string | null } | null;
  const residentialAddress = (raw.residential_address ?? null) as { id: string; full_address: string | null } | null;
  const postalAddress = (raw.postal_address ?? null) as { id: string; full_address: string | null } | null;

  return {
    id: String(raw.id ?? ''),
    personId: String(raw.person_id ?? ''),
    organisationId: String(raw.organisation_id ?? ''),
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
    membershipTypeId: (raw.membership_type_id as number | null) ?? null,
    membershipTypeName: membershipType?.name ?? null,
    membershipNumber: (raw.membership_number as string | null) ?? null,
    membershipStatus: (raw.membership_status as MemberProfileRecord['membershipStatus']) ?? 'Provisional',
    validFrom: (raw.valid_from as string | null) ?? null,
    validTo: (raw.valid_to as string | null) ?? null,
    residentialAddressId: corePerson?.residential_address_id ?? null,
    residentialAddress: residentialAddress?.full_address ?? null,
    postalAddressId: corePerson?.postal_address_id ?? null,
    postalAddress: postalAddress?.full_address ?? null,
  };
}

export function useMember360Data({ memberId, organisationId }: UseMember360DataOptions) {
  const secureSupabase = useSecureSupabase() as unknown as SecureSupabaseClientLike | null;
  const queryClient = useQueryClient();

  const memberQuery = useQuery({
    queryKey: ['member', memberId, organisationId],
    enabled: memberId != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MemberProfileRecord | null> => {
      if (memberId == null || organisationId == null || secureSupabase == null) {
        return null;
      }

      const { data, error } = (await secureSupabase
        .from('core_member')
        .select(
          [
            'id',
            'person_id',
            'organisation_id',
            'membership_type_id',
            'membership_number',
            'membership_status',
            'valid_from',
            'valid_to',
            'core_person!inner(id, first_name, last_name, preferred_name, email, date_of_birth, gender_id, pronoun_id, user_id, residential_address_id, postal_address_id)',
            'core_membership_type(id, name)',
            'core_gender_type(id, name)',
            'core_pronoun_type(id, name)',
            'residential_address:core_address!core_person_residential_address_id_fkey(id, full_address)',
            'postal_address:core_address!core_person_postal_address_id_fkey(id, full_address)',
          ].join(', ')
        )
        .eq('id', memberId)
        .eq('organisation_id', organisationId)
        .is('deleted_at', null)
        .maybeSingle()) as SupabaseQueryResult<MemberFetchRaw | null>;

      if (error != null) {
        throw error;
      }

      if (data == null) {
        return null;
      }
      return mapMemberRow(data);
    },
  });

  const phonesQuery = useQuery({
    queryKey: ['member', memberId, 'phones'],
    enabled: memberQuery.data != null && secureSupabase != null,
    queryFn: async (): Promise<MemberPhoneRow[]> => {
      if (memberQuery.data == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_phone')
        .select('id, person_id, phone_number, core_phone_type(id, name)')
        .eq('person_id', memberQuery.data.personId)) as SupabaseQueryResult<
          Array<{
            id: string;
            person_id: string;
            phone_number: string | null;
            core_phone_type: { id: number; name: string | null } | null;
          }>
        >;

      if (error != null) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        personId: row.person_id,
        phoneNumber: row.phone_number,
        phoneTypeName: row.core_phone_type?.name ?? null,
      }));
    },
  });

  const contactsQuery = useQuery({
    queryKey: ['member', memberId, 'contacts', organisationId],
    enabled: memberQuery.data != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<AdditionalContactRow[]> => {
      if (memberQuery.data == null || organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_contact')
        .select(
          [
            'id',
            'person_id',
            'contact_person_id',
            'permission_type',
            'core_contact_type(id, name)',
            'contact_person:core_person!core_contact_contact_person_id_fkey(id, first_name, last_name, preferred_name, email, residential_address_id, postal_address_id)',
          ].join(', ')
        )
        .eq('person_id', memberQuery.data.personId)
        .eq('organisation_id', organisationId)) as SupabaseQueryResult<
          Array<{
            id: string;
            person_id: string;
            contact_person_id: string | null;
            permission_type: 'full' | 'notify' | 'none';
            core_contact_type: { id: number; name: string | null } | null;
            contact_person:
              | {
                  id: string;
                  first_name: string | null;
                  last_name: string | null;
                  preferred_name: string | null;
                  email: string | null;
                  residential_address_id: string | null;
                  postal_address_id: string | null;
                }
              | null;
          }>
        >;

      if (error != null) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        personId: row.person_id,
        contactPersonId: row.contact_person_id,
        contactTypeName: row.core_contact_type?.name ?? null,
        permissionType: row.permission_type,
        firstName: row.contact_person?.first_name ?? null,
        lastName: row.contact_person?.last_name ?? null,
        preferredName: row.contact_person?.preferred_name ?? null,
        email: row.contact_person?.email ?? null,
        residentialAddressId: row.contact_person?.residential_address_id ?? null,
        postalAddressId: row.contact_person?.postal_address_id ?? null,
      }));
    },
  });

  const cardsQuery = useQuery({
    queryKey: ['member', memberId, 'cards', organisationId],
    enabled: memberId != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MemberCardRow[]> => {
      if (memberId == null || organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_member_card')
        .select('id, member_id, card_identifier, is_active, created_at')
        .eq('member_id', memberId)
        .eq('organisation_id', organisationId)) as SupabaseQueryResult<
          Array<{
            id: string;
            member_id: string;
            card_identifier: string;
            is_active: boolean;
            created_at: string;
          }>
        >;

      if (error != null) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        memberId: row.member_id,
        cardIdentifier: row.card_identifier,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));
    },
  });

  const applicationsQuery = useQuery({
    queryKey: ['member', memberId, 'applications', organisationId],
    enabled: memberQuery.data != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MemberApplicationRow[]> => {
      if (memberQuery.data == null || organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('base_application')
        .select('id, event_id, status, core_events!inner(event_id, event_name, event_date)')
        .eq('person_id', memberQuery.data.personId)
        .eq('organisation_id', organisationId)
        .neq('status', 'draft')) as SupabaseQueryResult<
          Array<{
            id: string;
            event_id: string;
            status: ApplicationStatus;
            core_events: { event_id: string; event_name: string | null; event_date: string | null } | null;
          }>
        >;

      if (error != null) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        eventId: row.event_id,
        status: row.status,
        eventName: row.core_events?.event_name ?? null,
        eventDate: row.core_events?.event_date ?? null,
      }));
    },
  });

  const genderTypesQuery = useQuery({
    queryKey: ['lookup', 'gender-types'],
    enabled: secureSupabase != null,
    queryFn: async (): Promise<LookupOption[]> => {
      if (secureSupabase == null) {
        return [];
      }
      const { data, error } = (await secureSupabase
        .from('core_gender_type')
        .select('id, name')
        .order('sort_order', { ascending: true })) as SupabaseQueryResult<Array<{ id: number; name: string | null }>>;
      if (error != null) {
        throw error;
      }
      return toLookupRows(data);
    },
  });

  const pronounTypesQuery = useQuery({
    queryKey: ['lookup', 'pronoun-types'],
    enabled: secureSupabase != null,
    queryFn: async (): Promise<LookupOption[]> => {
      if (secureSupabase == null) {
        return [];
      }
      const { data, error } = (await secureSupabase
        .from('core_pronoun_type')
        .select('id, name')
        .order('sort_order', { ascending: true })) as SupabaseQueryResult<Array<{ id: number; name: string | null }>>;
      if (error != null) {
        throw error;
      }
      return toLookupRows(data);
    },
  });

  const membershipTypesQuery = useQuery({
    queryKey: ['lookup', 'membership-types', organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<LookupOption[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }
      const { data, error } = (await secureSupabase
        .from('core_membership_type')
        .select('id, name')
        .eq('organisation_id', organisationId)
        .eq('is_active', true)
        .order('name', { ascending: true })) as SupabaseQueryResult<Array<{ id: number; name: string | null }>>;
      if (error != null) {
        throw error;
      }
      return toLookupRows(data);
    },
  });

  const saveIdentityMutation = useMutation({
    mutationFn: async ({ member, values, lookups }: SaveIdentityParams): Promise<void> => {
      if (secureSupabase == null) {
        throw new Error('Secure client unavailable');
      }

      const genderId = parseInteger(values.genderId);
      if (genderId != null && !lookupContainsId(lookups.genderTypes, genderId)) {
        throw {
          context: 'core_person',
          message: 'Gender is invalid.',
        } as Member360MutationError;
      }

      const pronounId = parseInteger(values.pronounId);
      if (pronounId != null && !lookupContainsId(lookups.pronounTypes, pronounId)) {
        throw {
          context: 'core_person',
          message: 'Pronoun is invalid.',
        } as Member360MutationError;
      }

      const membershipTypeId = parseInteger(values.membershipTypeId);
      if (membershipTypeId != null && !lookupContainsId(lookups.membershipTypes, membershipTypeId)) {
        throw {
          context: 'core_member',
          message: 'Membership type is invalid.',
        } as Member360MutationError;
      }

      await runIdentitySave(secureSupabase, {
        memberId: member.id,
        personId: member.personId,
        firstName: values.firstName,
        lastName: values.lastName,
        preferredName: values.preferredName,
        email: values.email,
        dateOfBirth: values.dateOfBirth,
        genderId,
        pronounId,
        membershipTypeId,
        membershipNumber: values.membershipNumber,
        validFrom: values.validFrom,
        validTo: values.validTo,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, organisationId] });
      await queryClient.invalidateQueries({ queryKey: ['lookup', 'membership-types', organisationId] });
    },
  });

  const cardMutation = useMutation({
    mutationFn: async ({ cardId, isActive }: { cardId: string; isActive: boolean }) => {
      if (secureSupabase == null) {
        throw new Error('Secure client unavailable');
      }
      await runCardActivationUpdate(secureSupabase, { cardId, isActive });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, 'cards', organisationId] });
    },
  });

  const fetchContactDetails = async (contact: AdditionalContactRow): Promise<ContactDetailData> => {
    if (secureSupabase == null || contact.contactPersonId == null) {
      return {
        phonesText: '—',
        residentialAddress: '—',
        postalAddress: '—',
      };
    }

    const phonesResult = (await secureSupabase
      .from('core_phone')
      .select('id, person_id, phone_number, core_phone_type(id, name)')
      .eq('person_id', contact.contactPersonId)) as SupabaseQueryResult<
      Array<{
        id: string;
        person_id: string;
        phone_number: string | null;
        core_phone_type: { id: number; name: string | null } | null;
      }>
    >;

    if (phonesResult.error != null) {
      throw phonesResult.error;
    }

    const phoneRows: MemberPhoneRow[] = (phonesResult.data ?? []).map((row) => ({
      id: row.id,
      personId: row.person_id,
      phoneNumber: row.phone_number,
      phoneTypeName: row.core_phone_type?.name ?? null,
    }));

    const addressIds = [contact.residentialAddressId, contact.postalAddressId].filter(
      (value): value is string => value != null && value.length > 0
    );

    let addressesById = new Map<string, string>();
    if (addressIds.length > 0) {
      const addressesResult = (await secureSupabase
        .from('core_address')
        .select('id, full_address')
        .in('id', addressIds)) as SupabaseQueryResult<Array<{ id: string; full_address: string | null }>>;

      if (addressesResult.error != null) {
        throw addressesResult.error;
      }

      addressesById = new Map((addressesResult.data ?? []).map((row) => [row.id, row.full_address ?? '—']));
    }

    return {
      phonesText: formatPhoneRows(phoneRows),
      residentialAddress:
        (contact.residentialAddressId != null ? addressesById.get(contact.residentialAddressId) : null) ?? '—',
      postalAddress: (contact.postalAddressId != null ? addressesById.get(contact.postalAddressId) : null) ?? '—',
    };
  };

  const memberErrorMessage = useMemo(() => {
    if (!memberQuery.isError) {
      return null;
    }
    return HandleSupabaseError(memberQuery.error, 'core_member').message;
  }, [memberQuery.error, memberQuery.isError]);

  const memberPhonesErrorMessage = useMemo(() => {
    if (!phonesQuery.isError) {
      return null;
    }
    return HandleSupabaseError(phonesQuery.error, 'core_phone').message;
  }, [phonesQuery.error, phonesQuery.isError]);

  const contactsErrorMessage = useMemo(() => {
    if (!contactsQuery.isError) {
      return null;
    }
    return HandleSupabaseError(contactsQuery.error, 'core_contact').message;
  }, [contactsQuery.error, contactsQuery.isError]);

  const cardsErrorMessage = useMemo(() => {
    if (!cardsQuery.isError) {
      return null;
    }
    return HandleSupabaseError(cardsQuery.error, 'core_member_card').message;
  }, [cardsQuery.error, cardsQuery.isError]);

  const applicationsErrorMessage = useMemo(() => {
    if (!applicationsQuery.isError) {
      return null;
    }
    return HandleSupabaseError(applicationsQuery.error, 'base_application').message;
  }, [applicationsQuery.error, applicationsQuery.isError]);

  return {
    member: memberQuery.data ?? null,
    memberLoading: memberQuery.isLoading,
    memberErrorMessage,
    refetchMember: memberQuery.refetch,

    memberPhones: phonesQuery.data ?? [],
    memberPhonesLoading: phonesQuery.isLoading,
    memberPhonesErrorMessage,
    refetchMemberPhones: phonesQuery.refetch,

    contacts: contactsQuery.data ?? [],
    contactsLoading: contactsQuery.isLoading,
    contactsErrorMessage,
    refetchContacts: contactsQuery.refetch,

    cards: cardsQuery.data ?? [],
    cardsLoading: cardsQuery.isLoading,
    cardsErrorMessage,
    refetchCards: cardsQuery.refetch,

    applications: applicationsQuery.data ?? [],
    applicationsLoading: applicationsQuery.isLoading,
    applicationsErrorMessage,
    refetchApplications: applicationsQuery.refetch,

    genderTypes: genderTypesQuery.data ?? [],
    pronounTypes: pronounTypesQuery.data ?? [],
    membershipTypes: membershipTypesQuery.data ?? [],

    saveIdentity: saveIdentityMutation.mutateAsync,
    saveIdentityPending: saveIdentityMutation.isPending,
    deactivateOrReactivateCard: cardMutation.mutateAsync,
    cardMutationPending: cardMutation.isPending,

    fetchContactDetails,
  };
}
