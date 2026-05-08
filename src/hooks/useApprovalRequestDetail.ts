import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';
import { mapFormResponseEntries, mapRequestRow } from '@/lib/approvals/approvals.mappers';
import type { ApprovalFormResponseEntry, ApprovalRequestRow } from '@/lib/approvals/approvals.types';

interface QueryBuilder extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): QueryBuilder;
  single(): Promise<unknown>;
  maybeSingle(): Promise<unknown>;
}

interface SupabaseLike {
  from: (table: string) => {
    select: (selection: string) => QueryBuilder;
  };
}

const REQUEST_SELECT = [
  'id',
  'organisation_id',
  'request_type',
  'status',
  'created_at',
  'resolved_at',
  'target_organisation_id',
  'source_organisation_id',
  'membership_type_id',
  'applicant_member_number',
  'review_notes',
  'subject_person:core_person!subject_person_id(id, first_name, last_name, preferred_name, email)',
  'subject_member:core_member!subject_member_id(id, deleted_at)',
  'membership_type:core_membership_type(id, name)',
  'source_org:core_organisations!source_organisation_id(id, name)',
  'resolver_person:core_person!team_member_request_resolved_by_fkey(id, first_name, last_name, preferred_name)',
].join(', ');

const FORM_RESPONSE_SELECT = [
  'id',
  'form_id',
  'workflow_subject_type',
  'workflow_subject_id',
  'values:core_form_response_values(id, field_key, value_text, value_number, value_boolean, value_date, value_uuid)',
  'form:core_forms(id, fields:core_form_fields(field_key, label, sort_order))',
].join(', ');

export function useApprovalRequestDetail(requestId: string | undefined, organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as SupabaseLike | null;

  const requestQuery = useQuery({
    queryKey: ['approvals', 'request', requestId, organisationId],
    enabled: requestId != null && organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<ApprovalRequestRow | null> => {
      if (requestId == null || organisationId == null || secureSupabase == null) {
        return null;
      }
      const { data, error } = (await secureSupabase
        .from('team_member_request')
        .select(REQUEST_SELECT)
        .eq('id', requestId)
        .eq('organisation_id', organisationId)
        .maybeSingle()) as { data: Record<string, unknown> | null; error: unknown };

      if (error != null) {
        throw error;
      }
      if (data == null) {
        return null;
      }
      return mapRequestRow(data);
    },
  });

  const formResponseQuery = useQuery({
    queryKey: ['approvals', 'form-responses', requestId],
    enabled: requestId != null && secureSupabase != null,
    queryFn: async (): Promise<ApprovalFormResponseEntry[]> => {
      if (requestId == null || secureSupabase == null) {
        return [];
      }
      const { data, error } = (await secureSupabase
        .from('core_form_responses')
        .select(FORM_RESPONSE_SELECT)
        .eq('workflow_subject_type', 'team_member_request')
        .eq('workflow_subject_id', requestId)
        .maybeSingle()) as { data: Record<string, unknown> | null; error: unknown };

      if (error != null) {
        throw error;
      }
      return mapFormResponseEntries(data);
    },
  });

  const requestErrorMessage = useMemo(() => {
    if (!requestQuery.isError) {
      return null;
    }
    return HandleSupabaseError(requestQuery.error, 'team_member_request').message;
  }, [requestQuery.error, requestQuery.isError]);

  const formResponseErrorMessage = useMemo(() => {
    if (!formResponseQuery.isError) {
      return null;
    }
    return HandleSupabaseError(formResponseQuery.error, 'core_form_responses').message;
  }, [formResponseQuery.error, formResponseQuery.isError]);

  return {
    request: requestQuery.data ?? null,
    requestLoading: requestQuery.isLoading,
    requestErrorMessage,
    refetchRequest: requestQuery.refetch,
    formResponses: formResponseQuery.data ?? [],
    formResponsesLoading: formResponseQuery.isLoading,
    formResponseErrorMessage,
    refetchFormResponses: formResponseQuery.refetch,
  };
}
