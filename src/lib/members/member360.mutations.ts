import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { apiErr, apiOk } from '@/lib/apiResult';
import type { ApiResult } from '@/lib/apiResult';
import { normalizeOptionalString } from '@/lib/members/member360.display.format';
import type { SecureSupabaseClientLike, SupabaseQueryResult } from '@/lib/members/member360.supabase';

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
): Promise<ApiResult<void, Member360MutationError>> {
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
    return apiErr<void, Member360MutationError>(asMutationError(personUpdate.error, 'core_person'));
  }

  const memberUpdate = (await secureSupabase
    .from('core_member')
    .update(memberPayload)
    .eq('id', payload.memberId)
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (memberUpdate.error != null) {
    return apiErr<void, Member360MutationError>(asMutationError(memberUpdate.error, 'core_member'));
  }

  return apiOk<void, Member360MutationError>(undefined);
}

export async function runCardActivationUpdate(
  secureSupabase: SecureSupabaseClientLike,
  payload: { cardId: string; isActive: boolean }
): Promise<ApiResult<void, Member360MutationError>> {
  const result = (await secureSupabase
    .from('core_member_card')
    .update({ is_active: payload.isActive })
    .eq('id', payload.cardId)
    .select()
    .single()) as SupabaseQueryResult<{ id: string } | null>;

  if (result.error != null) {
    return apiErr<void, Member360MutationError>(asMutationError(result.error, 'core_member_card'));
  }

  return apiOk<void, Member360MutationError>(undefined);
}
