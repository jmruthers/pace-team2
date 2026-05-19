import { buildReportingQueryPlan } from '@solvera/pace-core/reporting';
import { describe, expect, it, vi } from 'vitest';

import {
  TEAM_REPORTING_ROW_CAP,
  buildTeamParticipantSelect,
  createTeamReportingExecutionAdapter,
} from './teamReporting.execution';
import type { TeamReportingSecureClient } from './teamReporting.supabaseTypes';

const teamFields = [
  {
    fieldKey: 'core_member.id',
    tableName: 'core_member',
    label: 'Member id',
    reportAvailability: true,
    reportDomains: ['participant'],
  },
  {
    fieldKey: 'core_person.first_name',
    tableName: 'core_person',
    label: 'First name',
    reportAvailability: true,
    reportDomains: ['participant'],
  },
];

describe('buildTeamParticipantSelect', () => {
  it('includes only member columns when no joined tables are required', () => {
    const { plan } = buildReportingQueryPlan({
      exploreKey: 'team.participant',
      selectedFieldKeys: ['core_member.id'],
      filters: [],
      sorts: [],
      scopeValue: 'org-1',
      fields: teamFields,
    });
    const select = buildTeamParticipantSelect(plan);
    expect(select).toBe('id, person_id, organisation_id');
    expect(select).not.toContain('core_person');
  });

  it('embeds core_person when person fields are selected', () => {
    const { plan } = buildReportingQueryPlan({
      exploreKey: 'team.participant',
      selectedFieldKeys: ['core_member.id', 'core_person.first_name'],
      filters: [],
      sorts: [],
      scopeValue: 'org-1',
      fields: teamFields,
    });
    const select = buildTeamParticipantSelect(plan);
    expect(select).toContain('core_person!inner');
    expect(select).toContain('first_name');
    expect(select).toContain('organisation_id');
  });
});

describe('createTeamReportingExecutionAdapter', () => {
  it('applies limit 10000 and returns row count for truncation detection', async () => {
    const { request } = buildReportingQueryPlan({
      exploreKey: 'team.participant',
      selectedFieldKeys: ['core_member.id'],
      filters: [],
      sorts: [],
      scopeValue: 'org-1',
      fields: teamFields,
    });

    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const is = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ is });

    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq }),
    });
    const client = { from } as unknown as TeamReportingSecureClient;

    const adapter = createTeamReportingExecutionAdapter(() => client);
    const result = await adapter.execute(request);

    expect(limit).toHaveBeenCalledWith(TEAM_REPORTING_ROW_CAP);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalCount).toBe(0);
      expect(result.data.truncated).toBe(false);
    }
  });

  it('sets truncated when row count equals the cap', async () => {
    const { request } = buildReportingQueryPlan({
      exploreKey: 'team.participant',
      selectedFieldKeys: ['core_member.id'],
      filters: [],
      sorts: [],
      scopeValue: 'org-1',
      fields: teamFields,
    });

    const capRows = Array.from({ length: TEAM_REPORTING_ROW_CAP }, (_, i) => ({
      id: `member-${i}`,
      person_id: `person-${i}`,
      organisation_id: 'org-1',
    }));
    const limit = vi.fn().mockResolvedValue({ data: capRows, error: null });
    const is = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ is });

    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) };
    const adapter = createTeamReportingExecutionAdapter(() => client as unknown as TeamReportingSecureClient);
    const result = await adapter.execute(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(TEAM_REPORTING_ROW_CAP);
      expect(result.data.truncated).toBe(true);
    }
  });
});
