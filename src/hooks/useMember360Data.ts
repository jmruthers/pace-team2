import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { lookupContainsId } from '@/lib/members/member360.display.format';
import { mapMemberRow, parseInteger } from '@/lib/members/member360.mappers';
import {
  runCardActivationUpdate,
  runIdentitySave,
  type Member360MutationError,
} from '@/lib/members/member360.mutations';
import type {
  MemberFetchRaw,
  SecureSupabaseClientLike,
  SupabaseQueryResult,
} from '@/lib/members/member360.supabase';
import type { LookupOption, MemberProfileRecord } from '@/lib/members/member360.types';
import { useMember360MemberQueries } from '@/hooks/useMember360MemberQueries';

export type { Member360MutationError } from '@/lib/members/member360.mutations';
export { runCardActivationUpdate, runIdentitySave } from '@/lib/members/member360.mutations';

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

  const memberLists = useMember360MemberQueries({
    memberId,
    organisationId,
    member: memberQuery.data,
    secureSupabase,
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

      const result = await runIdentitySave(secureSupabase, {
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
      if (result.ok === false) {
        throw result.error;
      }
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
      const result = await runCardActivationUpdate(secureSupabase, { cardId, isActive });
      if (result.ok === false) {
        throw result.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['member', memberId, 'cards', organisationId] });
    },
  });

  const memberErrorMessage = useMemo(() => {
    if (!memberQuery.isError) {
      return null;
    }
    return HandleSupabaseError(memberQuery.error, 'core_member').message;
  }, [memberQuery.error, memberQuery.isError]);

  return {
    member: memberQuery.data ?? null,
    memberLoading: memberQuery.isLoading,
    memberErrorMessage,
    refetchMember: memberQuery.refetch,
    ...memberLists,
    saveIdentity: saveIdentityMutation.mutateAsync,
    saveIdentityPending: saveIdentityMutation.isPending,
    deactivateOrReactivateCard: cardMutation.mutateAsync,
    cardMutationPending: cardMutation.isPending,
  };
}
