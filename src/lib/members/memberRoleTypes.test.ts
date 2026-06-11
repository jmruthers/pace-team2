import { describe, expect, it } from 'vitest';
import { filterRoleTypesForMembership } from '@/lib/members/memberRoleTypes';

describe('filterRoleTypesForMembership', () => {
  const roleTypes = [
    { id: 1, name: 'Youth role', membershipTypeId: 10 },
    { id: 2, name: 'Adult role', membershipTypeId: 20 },
    { id: 3, name: 'Any role', membershipTypeId: null },
  ];

  it('returns all role types when membership type is null', () => {
    expect(filterRoleTypesForMembership(roleTypes, null)).toEqual(roleTypes);
  });

  it('keeps matching membership type and uncategorised role types', () => {
    expect(filterRoleTypesForMembership(roleTypes, 10)).toEqual([
      { id: 1, name: 'Youth role', membershipTypeId: 10 },
      { id: 3, name: 'Any role', membershipTypeId: null },
    ]);
  });
});
