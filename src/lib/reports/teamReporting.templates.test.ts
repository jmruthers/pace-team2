import type { ReportingTemplateSaveInput } from '@solvera/pace-core/reporting';
import { describe, expect, it, vi } from 'vitest';

import {
  createTeamReportingTemplateStore,
  mapTemplateRowsForClient,
  type CoreReportTemplateRow,
} from './teamReporting.templates';
import type { TeamReportingSecureClient } from './teamReporting.supabaseTypes';

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

function templateSaveInput(partial: Partial<ReportingTemplateSaveInput> = {}): ReportingTemplateSaveInput {
  const mapped = mapTemplateRowsForClient(baseRow());
  if (mapped == null) {
    throw new Error('fixture row must map');
  }
  return {
    name: 'My report',
    is_private: true,
    config: mapped.config,
    ...partial,
  };
}

interface MockClientState {
  listRows: CoreReportTemplateRow[];
  singleQueue: Array<{ data: unknown; error: unknown }>;
  insertPayloads: unknown[];
  insertResponse: { data: unknown; error: unknown };
  updateResponse: { data: unknown; error: unknown };
  deleteResponse: { error: unknown };
}

function createMockReportingClient(state: MockClientState): TeamReportingSecureClient {
  const single = vi.fn(async () => state.singleQueue.shift() ?? { data: null, error: null });
  const order = vi.fn(async () => ({ data: state.listRows, error: null }));

  const listSelectChain = () => {
    const thirdEq = { order };
    const secondEq = { eq: vi.fn(() => thirdEq) };
    const firstEq = { eq: vi.fn(() => secondEq) };
    return { eq: vi.fn(() => firstEq) };
  };

  const singleSelectChain = () => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        single,
      })),
    })),
  });

  const from = vi.fn((table: string) => {
    if (table !== 'core_report_template') {
      throw new Error(`unexpected table ${table}`);
    }
    return {
      select: vi.fn((columns?: string) => {
        if (columns === '*') {
          return singleSelectChain();
        }
        if (typeof columns === 'string' && columns.includes('created_by') && !columns.includes('selected_fields')) {
          return singleSelectChain();
        }
        return listSelectChain();
      }),
      insert: vi.fn((payload: unknown) => {
        state.insertPayloads.push(payload);
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => state.insertResponse),
          })),
        };
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => state.updateResponse),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(async () => state.deleteResponse),
      })),
    };
  });

  return { from } as unknown as TeamReportingSecureClient;
}

describe('createTeamReportingTemplateStore (TM11)', () => {
  it('TM11 S-24: listTemplates skips orphan rows with null app_id', async () => {
    const state: MockClientState = {
      listRows: [baseRow(), baseRow({ id: 'orphan', app_id: null })],
      singleQueue: [],
      insertPayloads: [],
      insertResponse: { data: baseRow(), error: null },
      updateResponse: { data: baseRow(), error: null },
      deleteResponse: { error: null },
    };
    const store = createTeamReportingTemplateStore({
      getClient: () => createMockReportingClient(state),
      organisationId: 'org-1',
      userId: 'user-1',
    });

    const templates = await store.listTemplates('team.participant');
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe('tmpl-1');
  });

  it('TM11 S-08: insert saveTemplate sets organisation_id and created_by on payload', async () => {
    const state: MockClientState = {
      listRows: [],
      singleQueue: [],
      insertPayloads: [],
      insertResponse: { data: baseRow({ id: 'new-tmpl' }), error: null },
      updateResponse: { data: baseRow(), error: null },
      deleteResponse: { error: null },
    };
    const store = createTeamReportingTemplateStore({
      getClient: () => createMockReportingClient(state),
      organisationId: 'org-1',
      userId: 'user-1',
    });

    const saved = await store.saveTemplate(templateSaveInput({ id: undefined }));
    expect(saved.id).toBe('new-tmpl');
    expect(state.insertPayloads[0]).toMatchObject({
      organisation_id: 'org-1',
      created_by: 'user-1',
      app_id: 'team',
      domain_id: 'participant',
    });
  });

  it('TM11 S-13: saveTemplate update rejects non-creator before update', async () => {
    const state: MockClientState = {
      listRows: [],
      singleQueue: [{ data: { id: 'tmpl-1', created_by: 'other-user', app_id: 'team', domain_id: 'participant' }, error: null }],
      insertPayloads: [],
      insertResponse: { data: baseRow(), error: null },
      updateResponse: { data: baseRow(), error: null },
      deleteResponse: { error: null },
    };
    const store = createTeamReportingTemplateStore({
      getClient: () => createMockReportingClient(state),
      organisationId: 'org-1',
      userId: 'user-1',
    });

    await expect(store.saveTemplate(templateSaveInput({ id: 'tmpl-1' }))).rejects.toThrow(
      'Only the template creator can edit this template.',
    );
  });

  it('TM11 S-13: saveTemplate maps RLS denial to creator-only message', async () => {
    const state: MockClientState = {
      listRows: [],
      singleQueue: [
        { data: { id: 'tmpl-1', created_by: 'user-1', app_id: 'team', domain_id: 'participant' }, error: null },
      ],
      insertPayloads: [],
      insertResponse: { data: baseRow(), error: null },
      updateResponse: { data: null, error: { code: '42501', message: 'permission denied' } },
      deleteResponse: { error: null },
    };
    const store = createTeamReportingTemplateStore({
      getClient: () => createMockReportingClient(state),
      organisationId: 'org-1',
      userId: 'user-1',
    });

    await expect(store.saveTemplate(templateSaveInput({ id: 'tmpl-1' }))).rejects.toThrow(
      'Only the template creator can edit this template.',
    );
  });

  it('throws generic save message when client is null', async () => {
    const store = createTeamReportingTemplateStore({
      getClient: () => null,
      organisationId: 'org-1',
      userId: 'user-1',
    });

    await expect(store.saveTemplate(templateSaveInput())).rejects.toThrow(
      'Could not save template. Please try again.',
    );
  });

  it('throws generic delete message when client is null', async () => {
    const store = createTeamReportingTemplateStore({
      getClient: () => null,
      organisationId: 'org-1',
      userId: 'user-1',
    });

    await expect(store.deleteTemplate('tmpl-1')).rejects.toThrow(
      'Could not delete template. Please try again.',
    );
  });

  it('deleteTemplate rejects non-creator', async () => {
    const state: MockClientState = {
      listRows: [],
      singleQueue: [{ data: { id: 'tmpl-1', created_by: 'other-user' }, error: null }],
      insertPayloads: [],
      insertResponse: { data: baseRow(), error: null },
      updateResponse: { data: baseRow(), error: null },
      deleteResponse: { error: null },
    };
    const store = createTeamReportingTemplateStore({
      getClient: () => createMockReportingClient(state),
      organisationId: 'org-1',
      userId: 'user-1',
    });

    await expect(store.deleteTemplate('tmpl-1')).rejects.toThrow(
      'Only the template creator can edit this template.',
    );
  });
});
