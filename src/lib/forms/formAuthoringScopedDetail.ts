import { HandleSupabaseError } from '@solvera/pace-core/utils';

import { apiErr, apiOk } from '@/lib/apiResult';
import type { ApiResult } from '@/lib/apiResult';
import type { CoreFormDetailRaw, MapDetailToAuthoringResult } from '@/lib/forms/orgForms.types';

/** Discriminated success payload for TM09 scoped form authoring detail fetch. */
export type ScopedAuthoringDetailSnapshot =
  | { kind: 'ineligible' }
  | { kind: 'abort' }
  | { kind: 'missing'; switchedOrganisation: boolean }
  | {
      kind: 'ready';
      authoring: MapDetailToAuthoringResult;
      priorFieldIds: string[];
    };

type FetchScopedDetailFn = (formId: string) => Promise<{
  row: CoreFormDetailRaw | null;
  authoring: MapDetailToAuthoringResult | null;
  priorFieldIds: string[];
}>;

/**
 * Fetches organisation-scoped authoring detail for `/forms/:id` (TM09).
 * Uses shared ApiResult typing; callers own UI (toast/navigate/state).
 */
export async function fetchScopedAuthoringDetailSnapshot(parameters: Readonly<{
  isStale: () => boolean;
  detailEligible: boolean;
  effectiveFormId: string | null;
  switchedOrganisation: boolean;
  fetchFormDetail: FetchScopedDetailFn;
}>): Promise<ApiResult<ScopedAuthoringDetailSnapshot>> {
  await Promise.resolve();

  if (parameters.isStale()) {
    return apiOk({ kind: 'abort' });
  }

  if (!parameters.detailEligible || parameters.effectiveFormId == null) {
    return apiOk({ kind: 'ineligible' });
  }

  const formId = parameters.effectiveFormId;

  try {
    const bundle = await parameters.fetchFormDetail(formId);

    if (parameters.isStale()) {
      return apiOk({ kind: 'abort' });
    }

    if (bundle.authoring == null || bundle.row == null) {
      return apiOk({
        kind: 'missing',
        switchedOrganisation: parameters.switchedOrganisation,
      });
    }

    return apiOk({
      kind: 'ready',
      authoring: bundle.authoring,
      priorFieldIds: bundle.priorFieldIds,
    });
  } catch (error: unknown) {
    return apiErr({
      message: HandleSupabaseError(error, 'core_forms').message,
      cause: error,
      context: 'core_forms',
    });
  }
}
