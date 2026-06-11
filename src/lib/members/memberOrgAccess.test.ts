import { describe, expect, it } from 'vitest';
import { isMemberAccessibleInOrganisation } from '@/lib/members/memberOrgAccess';

describe('isMemberAccessibleInOrganisation', () => {
  it('allows flat-org membership when organisation ids match', () => {
    expect(isMemberAccessibleInOrganisation('org-1', 'org-1', false)).toBe(true);
  });

  it('allows hierarchical membership via active placement at selected org', () => {
    expect(isMemberAccessibleInOrganisation('root-org', 'child-org', true)).toBe(true);
  });

  it('denies access when issuing org differs and no placement exists', () => {
    expect(isMemberAccessibleInOrganisation('root-org', 'child-org', false)).toBe(false);
  });
});
