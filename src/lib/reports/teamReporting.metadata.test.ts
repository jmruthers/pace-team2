import { describe, expect, it, vi } from 'vitest';

import { CORE_FIELD_LIST_REPORTING_SELECT, fetchTeamReportFieldMetadata } from './teamReporting.metadata';
import type { TeamReportingSecureClient } from './teamReporting.supabaseTypes';

describe('fetchTeamReportFieldMetadata', () => {
  it('queries core_field_list with report_domains containing bare participant', async () => {
    const contains = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          contains,
        }),
      }),
    });
    const client = { from } as unknown as TeamReportingSecureClient;

    await fetchTeamReportFieldMetadata(client);

    expect(from).toHaveBeenCalledWith('core_field_list');
    const selectMock = from.mock.results[0]?.value.select as ReturnType<typeof vi.fn>;
    expect(selectMock).toHaveBeenCalledWith(CORE_FIELD_LIST_REPORTING_SELECT);
    const eqMock = selectMock.mock.results[0]?.value.eq as ReturnType<typeof vi.fn>;
    expect(eqMock).toHaveBeenCalledWith('report_availability', true);
    expect(contains).toHaveBeenCalledWith('report_domains', ['participant']);
  });

  it('maps rows to fieldKey table_name.field_name', async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            contains: () => ({
              order: () => ({
                order: async () => ({
                  data: [
                    {
                      table_name: 'core_member',
                      field_name: 'id',
                      friendly_field_name: null,
                      report_availability: true,
                      report_domains: ['participant'],
                      aggregate_strategy: null,
                      aggregate_config: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as TeamReportingSecureClient;

    const result = await fetchTeamReportFieldMetadata(client);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data[0]?.fieldKey).toBe('core_member.id');
    expect(result.data[0]?.label).toBe('id');
  });
});
