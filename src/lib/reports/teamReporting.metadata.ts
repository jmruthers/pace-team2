import { getReportingExplore } from '@solvera/pace-core/reporting';
import type { ReportingFieldMeta } from '@solvera/pace-core/reporting';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

import { apiErr, apiOk, type ApiResult } from '@/lib/apiResult';
import type { TeamReportingSecureClient } from './teamReporting.supabaseTypes';

export const CORE_FIELD_LIST_REPORTING_SELECT =
  'table_name, field_name, friendly_field_name, report_availability, report_domains, aggregate_strategy, aggregate_config';

export interface CoreFieldListReportingRow {
  table_name: string;
  field_name: string;
  friendly_field_name: string | null;
  report_availability: boolean;
  report_domains: string[] | null;
  aggregate_strategy: string | null;
  aggregate_config: Record<string, unknown> | null;
}

function mapRowToReportingFieldMeta(row: CoreFieldListReportingRow): ReportingFieldMeta {
  return {
    fieldKey: `${row.table_name}.${row.field_name}`,
    tableName: row.table_name,
    label: row.friendly_field_name?.trim() ? row.friendly_field_name : row.field_name,
    reportAvailability: row.report_availability,
    reportDomains: row.report_domains,
    aggregateStrategy: row.aggregate_strategy as ReportingFieldMeta['aggregateStrategy'],
    aggregateConfig: row.aggregate_config,
  };
}

/** BR-FIELD-CATALOG: bare `participant` domain tag, not explore-key strings. */
export async function fetchTeamReportFieldMetadata(
  client: TeamReportingSecureClient,
): Promise<ApiResult<ReportingFieldMeta[]>> {
  const explore = getReportingExplore('team.participant');
  if (explore == null) {
    return apiErr({ message: 'Reporting explore "team.participant" is not registered.' });
  }
  const domainId = explore.domainId;

  const { data, error } = await client
    .from('core_field_list')
    .select(CORE_FIELD_LIST_REPORTING_SELECT)
    .eq('report_availability', true)
    .contains('report_domains', [domainId])
    .order('table_name', { ascending: true })
    .order('field_name', { ascending: true });

  if (error != null) {
    return apiErr({ message: HandleSupabaseError(error, 'core_field_list').message, cause: error });
  }

  const rows = (data ?? []) as CoreFieldListReportingRow[];
  return apiOk(rows.map(mapRowToReportingFieldMeta));
}

export function createTeamReportingMetadataProvider(getClient: () => TeamReportingSecureClient | null) {
  return {
    getFields: async () => {
      const client = getClient();
      if (client == null) return [];
      const result = await fetchTeamReportFieldMetadata(client);
      if (result.ok === false) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  };
}
