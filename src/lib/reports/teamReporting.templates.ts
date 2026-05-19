import {
  deserializeReportTemplateConfig,
  serializeReportTemplateConfig,
} from '@solvera/pace-core/reporting';
import type {
  ReportingTemplateRecord,
  ReportingTemplateSaveInput,
  ReportingTemplateStore,
  SerializedReportTemplateConfig,
} from '@solvera/pace-core/reporting';
import { HandleSupabaseError } from '@solvera/pace-core/utils';

import type { TeamReportingSecureClient } from './teamReporting.supabaseTypes';

export interface CoreReportTemplateRow {
  id: string;
  name: string | null;
  description: string | null;
  is_private: boolean;
  organisation_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  app_id: string | null;
  domain_id: string | null;
  selected_fields: unknown;
  filters: unknown;
  sort_config: unknown;
  column_config: unknown;
}

const TEMPLATE_LIST_SELECT =
  'id, name, description, is_private, organisation_id, created_by, created_at, updated_at, app_id, domain_id, selected_fields, filters, sort_config, column_config';

function assertCreatorEditAllowed(row: CoreReportTemplateRow, userId: string): void {
  if (row.created_by !== userId) {
    throw new Error('Only the template creator can edit this template.');
  }
}

function mapRowToReportingTemplateRecord(row: CoreReportTemplateRow): ReportingTemplateRecord {
  const serialized: SerializedReportTemplateConfig = {
    app_id: row.app_id ?? '',
    domain_id: row.domain_id ?? '',
    selected_fields: row.selected_fields as SerializedReportTemplateConfig['selected_fields'],
    filters: row.filters as SerializedReportTemplateConfig['filters'],
    sort_config: row.sort_config as SerializedReportTemplateConfig['sort_config'],
    column_config: row.column_config as SerializedReportTemplateConfig['column_config'],
  };
  const config = deserializeReportTemplateConfig(serialized);
  return {
    id: row.id,
    name: row.name ?? '',
    is_private: row.is_private,
    created_by: row.created_by,
    description: row.description ?? undefined,
    config,
  };
}

export function mapTemplateRowsForClient(row: CoreReportTemplateRow): ReportingTemplateRecord | null {
  if (row.app_id == null || row.domain_id == null) {
    return null;
  }
  try {
    return mapRowToReportingTemplateRecord(row);
  } catch {
    return null;
  }
}

function isRlsOrPermissionDenied(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const rec = error as Record<string, unknown>;
  const code = rec.code;
  if (code === '42501' || code === 'PGRST301') return true;
  const msg = typeof rec.message === 'string' ? rec.message.toLowerCase() : '';
  return msg.includes('permission') || msg.includes('rls') || msg.includes('row-level security');
}

export interface CreateTeamReportingTemplateStoreOptions {
  getClient: () => TeamReportingSecureClient | null;
  organisationId: string;
  userId: string;
}

export function createTeamReportingTemplateStore(
  options: CreateTeamReportingTemplateStoreOptions,
): ReportingTemplateStore {
  const { getClient, organisationId, userId } = options;

  return {
    listTemplates: async () => {
      const client = getClient();
      if (client == null) return [];

      const { data, error } = await client
        .from('core_report_template')
        .select(TEMPLATE_LIST_SELECT)
        .eq('organisation_id', organisationId)
        .eq('app_id', 'team')
        .eq('domain_id', 'participant')
        .order('updated_at', { ascending: false });

      if (error != null) {
        throw new Error(HandleSupabaseError(error, 'core_report_template').message);
      }

      const rows = (data ?? []) as CoreReportTemplateRow[];
      return rows
        .map(mapTemplateRowsForClient)
        .filter((row): row is ReportingTemplateRecord => row != null);
    },

    loadTemplate: async (templateId) => {
      const client = getClient();
      if (client == null) return null;

      const { data, error } = await client
        .from('core_report_template')
        .select('*')
        .eq('id', templateId)
        .eq('organisation_id', organisationId)
        .single();

      if (error != null) {
        throw new Error(HandleSupabaseError(error, 'core_report_template').message);
      }
      if (data == null) return null;
      const row = data as CoreReportTemplateRow;
      if (row.app_id == null || row.domain_id == null) return null;
      return mapRowToReportingTemplateRecord(row);
    },

    saveTemplate: async (template: ReportingTemplateSaveInput): Promise<ReportingTemplateRecord> => {
      const client = getClient();
      if (client == null) {
        throw new Error('Could not save template. Please try again.');
      }

      const serialized = serializeReportTemplateConfig(template.config);
      const name = template.name.trim() === '' ? 'team.participant template' : template.name.trim();

      if (template.id == null) {
        const insertPayload = {
          app_id: serialized.app_id,
          domain_id: serialized.domain_id,
          organisation_id: organisationId,
          created_by: userId,
          is_private: template.is_private,
          name,
          description: template.description ?? null,
          selected_fields: serialized.selected_fields,
          filters: serialized.filters,
          sort_config: serialized.sort_config,
          column_config: serialized.column_config,
        };
        const { data, error } = await client
          .from('core_report_template')
          .insert(insertPayload)
          .select(TEMPLATE_LIST_SELECT)
          .single();
        if (error != null) {
          throw new Error('Could not save template. Please try again.');
        }
        const row = data as CoreReportTemplateRow;
        return mapRowToReportingTemplateRecord(row);
      }

      const { data: existing, error: loadError } = await client
        .from('core_report_template')
        .select('id, created_by, app_id, domain_id')
        .eq('id', template.id)
        .eq('organisation_id', organisationId)
        .single();
      if (loadError != null) {
        throw new Error('Could not save template. Please try again.');
      }
      assertCreatorEditAllowed(existing as CoreReportTemplateRow, userId);

      const updatePayload = {
        is_private: template.is_private,
        name,
        description: template.description ?? null,
        selected_fields: serialized.selected_fields,
        filters: serialized.filters,
        sort_config: serialized.sort_config,
        column_config: serialized.column_config,
      };
      const { data, error } = await client
        .from('core_report_template')
        .update(updatePayload)
        .eq('id', template.id)
        .select(TEMPLATE_LIST_SELECT)
        .single();
      if (error != null) {
        if (isRlsOrPermissionDenied(error)) {
          throw new Error('Only the template creator can edit this template.');
        }
        throw new Error('Could not save template. Please try again.');
      }
      const row = data as CoreReportTemplateRow;
      return mapRowToReportingTemplateRecord(row);
    },

    deleteTemplate: async (templateId) => {
      const client = getClient();
      if (client == null) {
        throw new Error('Could not delete template. Please try again.');
      }
      const { data: existing, error: loadError } = await client
        .from('core_report_template')
        .select('id, created_by')
        .eq('id', templateId)
        .eq('organisation_id', organisationId)
        .single();
      if (loadError != null) {
        throw new Error('Could not delete template. Please try again.');
      }
      assertCreatorEditAllowed(existing as CoreReportTemplateRow, userId);

      const { error } = await client.from('core_report_template').delete().eq('id', templateId);
      if (error != null) {
        if (isRlsOrPermissionDenied(error)) {
          throw new Error('Only the template creator can edit this template.');
        }
        throw new Error('Could not delete template. Please try again.');
      }
    },
  };
}
