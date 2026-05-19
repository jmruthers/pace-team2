import type { ApiResult } from '@solvera/pace-core/types';
import { createErrorResult, createSuccessResult, isOk } from '@solvera/pace-core/types';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

import type { TeamReportingSecureClient } from './teamReporting.supabaseTypes';

export interface OwnerPersonEmbed {
  preferred_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface RawTemplatePanelRow extends Record<string, unknown> {
  id: string;
  name: string | null;
  updated_at: string | null;
  created_at: string;
  created_by: string;
  is_private: boolean;
  app_id: string | null;
  domain_id: string | null;
  owner?: OwnerPersonEmbed | OwnerPersonEmbed[] | null;
}

export interface ReportsTemplatePanelRow extends Record<string, unknown> {
  id: string;
  nameDisplay: string;
  is_private: boolean;
  created_by: string;
  modifiedIso: string;
  modifiedLabel: string;
  ownerDisplay: string;
}

const PANEL_SELECT =
  'id, name, updated_at, created_at, created_by, is_private, app_id, domain_id';

const PERSON_BY_USER_SELECT = 'user_id, preferred_name, first_name, last_name';

interface CorePersonByUserRow extends OwnerPersonEmbed {
  user_id: string;
}

/** created_by references auth.users; resolve display names via core_person.user_id. */
async function fetchOwnerPersonsByAuthUserId(
  client: TeamReportingSecureClient,
  authUserIds: string[],
): Promise<ApiResult<Map<string, OwnerPersonEmbed>>> {
  const uniqueIds = [...new Set(authUserIds.filter((id) => id.length > 0))];
  if (uniqueIds.length === 0) {
    return createSuccessResult(new Map());
  }

  const { data, error } = await client
    .from('core_person')
    .select(PERSON_BY_USER_SELECT)
    .in('user_id', uniqueIds);

  if (error != null) {
    const message = HandleSupabaseError(error, 'core_person').message;
    return createErrorResult('SUPABASE_ERROR', message);
  }

  const map = new Map<string, OwnerPersonEmbed>();
  for (const row of (data ?? []) as CorePersonByUserRow[]) {
    if (typeof row.user_id !== 'string' || row.user_id.length === 0) continue;
    map.set(row.user_id, {
      preferred_name: row.preferred_name,
      first_name: row.first_name,
      last_name: row.last_name,
    });
  }
  return createSuccessResult(map);
}

function formatPersonName(person: OwnerPersonEmbed | null): string {
  if (person == null) return '—';
  const preferred =
    typeof person.preferred_name === 'string' && person.preferred_name.trim().length > 0
      ? person.preferred_name.trim()
      : '';
  const first =
    typeof person.first_name === 'string' && person.first_name.trim().length > 0
      ? person.first_name.trim()
      : '';
  const last =
    typeof person.last_name === 'string' && person.last_name.trim().length > 0 ? person.last_name.trim() : '';
  const combined = `${first}${first && last ? ' ' : ''}${last}`.trim();
  const base = preferred.length > 0 ? preferred : combined;
  return base.length > 0 ? base : '—';
}

function formatModifiedLabel(isoInput: string): { iso: string; label: string } {
  const date = Date.parse(isoInput);
  const iso = isoInput.length > 0 ? isoInput : new Date(0).toISOString();
  const label = Number.isFinite(date)
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(date))
    : isoInput;
  return { iso, label };
}

export function mapRawTemplatePanelRow(
  raw: RawTemplatePanelRow,
  currentUserId: string,
  ownerPerson?: OwnerPersonEmbed | null,
): ReportsTemplatePanelRow | null {
  if (raw.app_id == null || raw.domain_id == null) return null;

  const nameDisplay =
    typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : 'Untitled template';
  const ownerName = formatPersonName(ownerPerson ?? null);
  const ownerDisplay =
    raw.created_by === currentUserId ? 'You' : ownerName === '—' ? 'Unknown' : ownerName;
  const effectiveStamp = raw.updated_at ?? raw.created_at;
  const { iso, label } = formatModifiedLabel(effectiveStamp);

  return {
    id: raw.id,
    nameDisplay,
    is_private: raw.is_private === true,
    created_by: raw.created_by,
    modifiedIso: iso,
    modifiedLabel: label,
    ownerDisplay,
  };
}

/** BR-TEMPLATE-LIST: org + app + domain server filter; skips orphan rows client-side for defence in depth. */
export async function fetchTeamReportTemplatesPanelRows(
  client: TeamReportingSecureClient,
  organisationId: string,
  currentUserId: string,
): Promise<ApiResult<ReportsTemplatePanelRow[]>> {
  const { data, error } = await client
    .from('core_report_template')
    .select(PANEL_SELECT)
    .eq('organisation_id', organisationId)
    .eq('app_id', 'team')
    .eq('domain_id', 'participant')
    .order('updated_at', { ascending: false });

  if (error != null) {
    const message = HandleSupabaseError(error, 'core_report_template').message;
    return createErrorResult('SUPABASE_ERROR', message);
  }

  const rows = (data ?? []) as RawTemplatePanelRow[];

  const ownersResult = await fetchOwnerPersonsByAuthUserId(
    client,
    rows.map((row) => row.created_by),
  );
  if (!isOk(ownersResult)) {
    return createErrorResult('SUPABASE_ERROR', ownersResult.error.message);
  }
  const ownersByUserId = ownersResult.data;

  const mapped = rows
    .map((r) => mapRawTemplatePanelRow(r, currentUserId, ownersByUserId.get(r.created_by) ?? null))
    .filter((row): row is ReportsTemplatePanelRow => row != null);

  mapped.sort((a, b) => (a.modifiedIso < b.modifiedIso ? 1 : a.modifiedIso > b.modifiedIso ? -1 : 0));
  return createSuccessResult(mapped);
}

export function reportsTemplatesPanelQueryKey(organisationId: string) {
  return ['reports', 'templates', 'team', 'participant', organisationId] as const;
}
