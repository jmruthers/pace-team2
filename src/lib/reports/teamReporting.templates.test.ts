import { describe, expect, it } from 'vitest';

import { mapTemplateRowsForClient, type CoreReportTemplateRow } from './teamReporting.templates';

function baseRow(partial: Partial<CoreReportTemplateRow> = {}): CoreReportTemplateRow {
  return {
    id: 'tmpl-1',
    name: 'Test',
    description: null,
    is_private: true,
    organisation_id: 'org-1',
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    app_id: 'team',
    domain_id: 'participant',
    selected_fields: ['core_member.id'],
    filters: [],
    sort_config: [],
    column_config: [],
    ...partial,
  };
}

describe('mapTemplateRowsForClient', () => {
  it('returns null when app_id is null', () => {
    expect(mapTemplateRowsForClient(baseRow({ app_id: null }))).toBeNull();
  });

  it('returns null when domain_id is null', () => {
    expect(mapTemplateRowsForClient(baseRow({ domain_id: null }))).toBeNull();
  });

  it('maps valid rows to ReportingTemplateRecord', () => {
    const record = mapTemplateRowsForClient(baseRow());
    expect(record).not.toBeNull();
    expect(record?.id).toBe('tmpl-1');
    expect(record?.config.exploreKey).toBe('team.participant');
    expect(record?.config.selectedFieldKeys).toEqual(['core_member.id']);
  });
});
