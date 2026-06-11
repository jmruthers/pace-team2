import { HandleSupabaseError } from '@solvera/pace-core/utils';

import { apiErr, apiOk, type ApiResult } from '@/lib/apiResult';

interface OrganisationParentRow {
  id: string;
  parent_id: string | null;
}

interface OrganisationNameRow {
  id: string;
  name: string | null;
  display_name: string | null;
}

interface SupabaseOrganisationClientLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<unknown>;
      };
    };
  };
}

function asQueryResult(result: unknown): { data: unknown; error: unknown } {
  if (result != null && typeof result === 'object' && 'data' in result && 'error' in result) {
    return result as { data: unknown; error: unknown };
  }
  return { data: null, error: result };
}

export function pickOrganisationDisplayName(row: OrganisationNameRow | null): string | null {
  if (row == null) {
    return null;
  }
  const displayName = row.display_name?.trim() ?? '';
  if (displayName.length > 0) {
    return displayName;
  }
  const name = row.name?.trim() ?? '';
  return name.length > 0 ? name : null;
}

/**
 * Walks parent_id to the root org — mirrors pace_private.resolve_issuing_organisation_id for flat orgs.
 * Missing rows fall back to the input organisation id with ok: true.
 */
export async function resolveIssuingOrganisationId(
  supabase: SupabaseOrganisationClientLike,
  organisationId: string
): Promise<ApiResult<string>> {
  let currentId = organisationId;
  const visited = new Set<string>();

  for (let depth = 0; depth < 64; depth += 1) {
    if (visited.has(currentId)) {
      return apiOk(organisationId);
    }
    visited.add(currentId);

    const { data, error } = asQueryResult(
      await supabase.from('core_organisations').select('id, parent_id').eq('id', currentId).maybeSingle()
    );

    if (error != null) {
      return apiErr({
        context: 'core_organisations',
        message: HandleSupabaseError(error, 'core_organisations').message,
        cause: error,
      });
    }

    if (data == null) {
      return apiOk(organisationId);
    }

    const row = data as OrganisationParentRow;
    if (row.parent_id == null) {
      return apiOk(row.id);
    }
    currentId = row.parent_id;
  }

  return apiOk(organisationId);
}

export async function fetchOrganisationName(
  supabase: SupabaseOrganisationClientLike,
  organisationId: string
): Promise<ApiResult<string | null>> {
  const { data, error } = asQueryResult(
    await supabase
      .from('core_organisations')
      .select('id, name, display_name')
      .eq('id', organisationId)
      .maybeSingle()
  );

  if (error != null) {
    return apiErr({
      context: 'core_organisations',
      message: HandleSupabaseError(error, 'core_organisations').message,
      cause: error,
    });
  }

  return apiOk(pickOrganisationDisplayName(data as OrganisationNameRow | null));
}

export function shouldShowIssuingOrganisationContext(
  issuingOrganisationId: string | null,
  selectedOrganisationId: string | null
): boolean {
  if (issuingOrganisationId == null || selectedOrganisationId == null) {
    return false;
  }
  return issuingOrganisationId !== selectedOrganisationId;
}
