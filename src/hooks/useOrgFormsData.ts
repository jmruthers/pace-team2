import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useSecureSupabase } from '@solvera/pace-core/rbac';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

import type { WorkflowAuthoringState } from '@solvera/pace-core/forms';

import type {
  CoreFormDetailRaw,
  CoreFormListRowRaw,
  OrgFormsTableRow,
  OrgFormScheduleLimitsInput,
} from '@/lib/forms/orgForms.types';

import {
  mapDetailRowToAuthoring,
  mapDefinitionToInsertFieldRow,
  mapListRowToTableRow,
  mapStateToCoreFormsInsertPayload,
  mapStateToCoreFormsUpdatePayload,
} from '@/lib/forms/orgForms.mappers';
import { replaceFormFields } from '@/lib/forms/orgForms.persist';
import type { OrgFormsSecureClient } from '@/lib/forms/orgForms.persist';

/** Result of fetching `core_form_responses` count before delete (TM09 BR-I). */
export type OrgFormsResponseCountOutcome =
  | { ok: true; count: number }
  | { ok: false; error: unknown };
/** Matches PostgREST query builder chaining used by TEAM hooks. */
interface SupabaseQueryBuilderLike extends PromiseLike<unknown> {
  eq(column: string, value: string | number | boolean | null): SupabaseQueryBuilderLike;
  is(column: string, value: null): SupabaseQueryBuilderLike;
  in(column: string, values: string[]): SupabaseQueryBuilderLike;
  select(selection: string, options?: { count?: 'exact'; head?: boolean }): SupabaseQueryBuilderLike;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilderLike;
  maybeSingle(): Promise<unknown>;
  single(): Promise<unknown>;
}

interface SupabaseTableLike {
  select(
    selection: string,
    options?: { count?: 'exact'; head?: boolean },
  ): SupabaseQueryBuilderLike;
  insert(payload: unknown): SupabaseQueryBuilderLike;
  update(payload: Record<string, unknown>): SupabaseQueryBuilderLike;
  delete(): SupabaseQueryBuilderLike;
}

interface SecureSupabaseLike {
  from(table: string): SupabaseTableLike;
}

/** §7 TM09 list select */
export const CORE_FORMS_LIST_SELECT =
  'id, name, slug, description, workflow_type, status, access_mode, is_active, is_primary_entrypoint, opens_at, closes_at, max_submissions, confirmation_message, is_required, updated_at';

/** §7 TM09 detail select */
export const CORE_FORMS_DETAIL_SELECT =
  'id, name, slug, description, workflow_type, status, access_mode, is_active, is_primary_entrypoint, organisation_id, opens_at, closes_at, max_submissions, confirmation_message, is_required, workflow_config, title, updated_at, fields:core_form_fields(id, field_key, field_label, field_type, sort_order, is_required, is_active, display_options)';

export function useOrgFormsData(organisationId: string | null) {
  const secureSupabase = useSecureSupabase() as unknown as SecureSupabaseLike | null;
  const queryClient = useQueryClient();
  const prevOrganisationRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const next = organisationId ?? null;
    if (prevOrganisationRef.current === undefined) {
      prevOrganisationRef.current = next;
      return;
    }
    if (prevOrganisationRef.current !== next) {
      prevOrganisationRef.current = next;
      void queryClient.invalidateQueries({ queryKey: ['forms'], exact: false });
    }
  }, [organisationId, queryClient]);

  const formsListQuery = useQuery({
    queryKey: ['forms', 'list', organisationId],
    enabled: organisationId != null && secureSupabase != null,
    queryFn: async (): Promise<OrgFormsTableRow[]> => {
      if (organisationId == null || secureSupabase == null) {
        return [];
      }

      const { data, error } = (await secureSupabase
        .from('core_forms')
        .select(CORE_FORMS_LIST_SELECT)
        .eq('organisation_id', organisationId)
        .is('event_id', null)
        .order('updated_at', { ascending: false })) as {
        data: CoreFormListRowRaw[] | null;
        error: unknown;
      };

      if (error != null) {
        throw error;
      }

      return (data ?? []).map(mapListRowToTableRow);
    },
  });

  const fetchFormDetail = useCallback(
    async (
      formId: string,
    ): Promise<{ row: CoreFormDetailRaw | null; authoring: ReturnType<typeof mapDetailRowToAuthoring> | null; priorFieldIds: string[] }> => {
      if (organisationId == null || secureSupabase == null) {
        return { row: null, authoring: null, priorFieldIds: [] };
      }

      const { data, error } = (await secureSupabase
        .from('core_forms')
        .select(CORE_FORMS_DETAIL_SELECT)
        .eq('id', formId)
        .eq('organisation_id', organisationId)
        .is('event_id', null)
        .maybeSingle()) as { data: CoreFormDetailRaw | null; error: unknown };

      if (error != null) {
        throw error;
      }

      if (data == null) {
        return { row: null, authoring: null, priorFieldIds: [] };
      }

      const authoring = mapDetailRowToAuthoring(data);
      const ids = data.fields?.map((f) => f.id) ?? [];
      return { row: data, authoring, priorFieldIds: ids };
    },
    [organisationId, secureSupabase],
  );

  const fetchResponseCount = useCallback(
    async (formId: string): Promise<OrgFormsResponseCountOutcome> => {
      if (organisationId == null || secureSupabase == null) {
        return { ok: false, error: new Error('No organisation selected.') };
      }

      try {
        const { error, count } = (await secureSupabase
          .from('core_form_responses')
          .select('id', { count: 'exact', head: true })
          .eq('form_id', formId)
          .eq('organisation_id', organisationId)) as {
          error: unknown;
          count: number | null;
        };

        if (error != null) {
          return { ok: false, error };
        }

        return { ok: true, count: count ?? 0 };
      } catch (error: unknown) {
        return { ok: false, error };
      }
    },
    [organisationId, secureSupabase],
  );

  const createMutation = useMutation({
    mutationFn: async (input: {
      state: WorkflowAuthoringState;
      scheduleLimits: OrgFormScheduleLimitsInput;
    }) => {
      if (organisationId == null || secureSupabase == null) {
        throw new Error('No organisation selected.');
      }

      const insertPayload = mapStateToCoreFormsInsertPayload(
        organisationId,
        input.state,
        input.scheduleLimits,
      );

      const insertResult = await secureSupabase
        .from('core_forms')
        .insert(insertPayload as unknown)
        .select('id')
        .single();

      const { data, error } = insertResult as { data: { id: string } | null; error: unknown };

      if (error != null) {
        throw error;
      }

      if (data == null || data.id === '') {
        throw new Error('Insert returned no row id.');
      }

      const formId = data.id;

      if (input.state.fields.length > 0) {
        const rows = input.state.fields.map((f) => mapDefinitionToInsertFieldRow(formId, organisationId, f));
        const rowsResult = (await secureSupabase.from('core_form_fields').insert(rows)) as { error: unknown };
        if (rowsResult.error != null) {
          await secureSupabase
            .from('core_forms')
            .delete()
            .eq('id', formId)
            .eq('organisation_id', organisationId);
          throw rowsResult.error;
        }
      }

      return formId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forms', 'list', organisationId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      formId: string;
      state: WorkflowAuthoringState;
      scheduleLimits: OrgFormScheduleLimitsInput;
      priorDbFieldIds: string[];
    }) => {
      if (organisationId == null || secureSupabase == null) {
        throw new Error('No organisation selected.');
      }

      const patch = mapStateToCoreFormsUpdatePayload(input.state, input.scheduleLimits);

      const { error } = (await secureSupabase
        .from('core_forms')
        .update(patch as unknown as Record<string, unknown>)
        .eq('id', input.formId)
        .eq('organisation_id', organisationId)
        .select('id')
        .single()) as { error: unknown };

      if (error != null) {
        throw error;
      }

      const fieldSyncResult = await replaceFormFields(
        secureSupabase as unknown as OrgFormsSecureClient,
        organisationId,
        input.formId,
        input.priorDbFieldIds,
        input.state.fields,
      );
      if (fieldSyncResult.ok === false) {
        throw fieldSyncResult.error.cause ?? fieldSyncResult.error;
      }
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['forms', 'list', organisationId] });
      void queryClient.invalidateQueries({
        queryKey: ['forms', 'detail', variables.formId, organisationId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { formId: string }) => {
      if (organisationId == null || secureSupabase == null) {
        throw new Error('No organisation selected.');
      }

      const { data, error } = (await secureSupabase
        .from('core_forms')
        .delete()
        .eq('id', input.formId)
        .eq('organisation_id', organisationId)
        .select('id,name')
        .single()) as { data: { id: string; name: string } | null; error: unknown };

      if (error != null) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forms', 'list', organisationId] });
    },
  });

  const loadErrorMessage =
    formsListQuery.error != null ? HandleSupabaseError(formsListQuery.error, 'core_forms').message : null;

  return {
    tableRows: formsListQuery.data ?? [],
    rawCount: formsListQuery.data?.length ?? 0,
    isLoading: formsListQuery.isLoading || formsListQuery.isPending,
    loadErrorMessage,
    refetchFormsList: () => formsListQuery.refetch(),
    fetchFormDetail,
    fetchResponseCount,
    createFormAsync: createMutation.mutateAsync.bind(createMutation),
    createPending: createMutation.isPending,
    updateFormAsync: updateMutation.mutateAsync.bind(updateMutation),
    updatePending: updateMutation.isPending,
    deleteFormAsync: deleteMutation.mutateAsync.bind(deleteMutation),
    deletePending: deleteMutation.isPending,
    queryClient,
  };
}
