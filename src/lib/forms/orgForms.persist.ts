import type { WorkflowFieldDefinition } from '@solvera/pace-core/forms';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

import { apiOk, apiErr } from '@/lib/apiResult';
import type { ApiResult } from '@/lib/apiResult';

import {
  computeFieldsToInsert,
  computeFieldsToUpdate,
  computeRemovedFieldIds,
  mapDefinitionToFieldUpdatePayload,
  mapDefinitionToInsertFieldRow,
} from '@/lib/forms/orgForms.mappers.fields';

/** Minimal client shape used by TM09 field replace mutations. */
export interface OrgFormsSecureClient {
  from(table: string): {
    insert(payload: unknown): Promise<{ error: unknown }>;
    update(patch: Record<string, unknown>): SupabaseMutationPromise;
    delete(): SupabaseMutationPromise;
  };
}

interface SupabaseMutationPromise extends Promise<{ error: unknown }> {
  eq(column: string, value: string | number | boolean | null): SupabaseMutationPromise;
  in(column: string, values: string[]): SupabaseMutationPromise;
}

export async function replaceFormFields(
  sb: OrgFormsSecureClient,
  organisationId: string,
  formId: string,
  priorDbFieldIds: string[],
  fields: WorkflowFieldDefinition[],
): Promise<ApiResult<void>> {
  try {
    const removedIds = computeRemovedFieldIds(priorDbFieldIds, fields);
    if (removedIds.length > 0) {
      const { error } = await sb
        .from('core_form_fields')
        .delete()
        .eq('form_id', formId)
        .eq('organisation_id', organisationId)
        .in('id', removedIds);
      if (error != null) {
        return apiErr({
          message: HandleSupabaseError(error, 'core_form_fields').message,
          cause: error,
          context: 'core_form_fields',
        });
      }
    }

    const toInsert = computeFieldsToInsert(fields);
    if (toInsert.length > 0) {
      const rows = toInsert.map((f) => mapDefinitionToInsertFieldRow(formId, organisationId, f));
      const { error } = await sb.from('core_form_fields').insert(rows);
      if (error != null) {
        return apiErr({
          message: HandleSupabaseError(error, 'core_form_fields').message,
          cause: error,
          context: 'core_form_fields',
        });
      }
    }

    const toUpdate = computeFieldsToUpdate(fields);
    for (const field of toUpdate) {
      const patch = mapDefinitionToFieldUpdatePayload(field);
      const { error } = await sb
        .from('core_form_fields')
        .update(patch)
        .eq('id', field.id)
        .eq('organisation_id', organisationId);
      if (error != null) {
        return apiErr({
          message: HandleSupabaseError(error, 'core_form_fields').message,
          cause: error,
          context: 'core_form_fields',
        });
      }
    }

    return apiOk(undefined);
  } catch (error: unknown) {
    return apiErr({
      message: HandleSupabaseError(error, 'core_form_fields').message,
      cause: error,
      context: 'core_form_fields',
    });
  }
}
