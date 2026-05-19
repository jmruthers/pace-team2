import { describe, expect, it, vi } from 'vitest';

import {
  fetchTeamReportTemplatesPanelRows,
  mapRawTemplatePanelRow,
  type RawTemplatePanelRow,
} from './teamReporting.templatesPanel';
import type { TeamReportingSecureClient } from './teamReporting.supabaseTypes';

describe('teamReporting.templatesPanel', () => {
  it('maps null app_id/domain_id rows out of the defensive client list path', async () => {
    const templatesSelectChain = vi.fn(async () => ({
      data: [
        {
          id: 'skip-me',
          name: 'Orphan',
          updated_at: '2026-01-02T12:00:00.000Z',
          created_at: '2026-01-02T11:00:00.000Z',
          created_by: 'creator-1',
          is_private: true,
          app_id: null,
          domain_id: null,
        },
        {
          id: 'keep-me',
          name: 'Valid',
          updated_at: '2026-02-03T09:30:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          created_by: 'creator-1',
          is_private: false,
          app_id: 'team',
          domain_id: 'participant',
        },
      ],
      error: null,
    }));

    const personInChain = vi.fn(async () => ({
      data: [
        {
          user_id: 'creator-1',
          preferred_name: null,
          first_name: 'Sam',
          last_name: 'Lee',
        },
      ],
      error: null,
    }));

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'core_report_template') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    order: templatesSelectChain,
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'core_person') {
          return {
            select: vi.fn(() => ({
              in: personInChain,
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as unknown as TeamReportingSecureClient;

    const outcome = await fetchTeamReportTemplatesPanelRows(client, 'org-1', 'user-current');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('expected success');
    expect(outcome.data.map((r) => r.id)).toEqual(['keep-me']);
    expect(outcome.data[0]?.ownerDisplay).toBe('Sam Lee');
  });

  it('mapRawTemplatePanelRow returns null when app_id or domain_id missing', () => {
    const base: Omit<RawTemplatePanelRow, 'app_id' | 'domain_id'> = {
      id: 't1',
      name: 'N',
      updated_at: null,
      created_at: '2026-01-02T11:00:00.000Z',
      created_by: 'creator-1',
      is_private: true,
      owner: null,
    };

    expect(
      mapRawTemplatePanelRow(
        { ...base, app_id: null, domain_id: 'participant' } as RawTemplatePanelRow,
        'u1',
      ),
    ).toBeNull();
    expect(
      mapRawTemplatePanelRow(
        { ...base, app_id: 'team', domain_id: null } as RawTemplatePanelRow,
        'u1',
      ),
    ).toBeNull();
  });
});
