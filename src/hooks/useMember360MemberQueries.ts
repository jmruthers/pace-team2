import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { formatPhoneRows } from '@/lib/members/member360.display.format';
import type { ContactDetailData } from '@/lib/members/member360.contact.types';
import { toLookupRows } from '@/lib/members/member360.mappers';
import type {
  SecureSupabaseClientLike,
  SupabaseQueryResult,
} from '@/lib/members/member360.supabase';
import type {
  AdditionalContactRow,
  ApplicationStatus,
  LookupOption,
  MemberApplicationRow,
  MemberCardRow,
  MemberPhoneRow,
  MemberProfileRecord,
} from '@/lib/members/member360.types';

interface UseMember360MemberQueriesOptions {
  memberId: string | undefined;
  organisationId: string | null;
  member: MemberProfileRecord | null | undefined;
  secureSupabase: SecureSupabaseClientLike | null;
}

export function useMember360MemberQueries({
  memberId,
  organisationId,
  member,
  secureSupabase,
}: UseMember360MemberQueriesOptions) {
  const phonesQuery = useQuery({
    queryKey: ['member', memberId, 'phones'],
    enabled: member != null && secureSupabase != null,
    queryFn: async (): Promise<MemberPhoneRow[]> => {
      if (member == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_phone')
        .select('id, person_id, phone_number, core_phone_type(id, name)')
        .eq('person_id', member.personId)) as SupabaseQueryResult<
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
    enabled: member != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<AdditionalContactRow[]> => {
      if (member == null || organisationId == null || secureSupabase == null) {
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
        .eq('person_id', member.personId)
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
    enabled: member != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<MemberApplicationRow[]> => {
      if (member == null || organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('base_application')
        .select('id, event_id, status, core_events!inner(event_id, event_name, event_date)')
        .eq('person_id', member.personId)
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

  return {
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
    fetchContactDetails,
  };
}
