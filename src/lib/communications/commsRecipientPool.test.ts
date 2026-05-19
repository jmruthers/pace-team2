import { describe, expect, it } from 'vitest';
import { buildOrgMembersPool } from '@/lib/communications/commsRecipientPool';

describe('buildOrgMembersPool', () => {
  it('omits filters when none selected', () => {
    expect(buildOrgMembersPool('org-1', [], false)).toEqual({
      type: 'org_members',
      organisation_id: 'org-1',
    });
  });

  it('casts membership type ids to strings', () => {
    expect(buildOrgMembersPool('org-1', ['1', '2'], false)).toEqual({
      type: 'org_members',
      organisation_id: 'org-1',
      filters: { member_type_ids: ['1', '2'] },
    });
  });

  it('includes include_inactive when checked', () => {
    expect(buildOrgMembersPool('org-1', [], true)).toEqual({
      type: 'org_members',
      organisation_id: 'org-1',
      filters: { include_inactive: true },
    });
  });
});
