import { describe, expect, it } from 'vitest';
import {
  formatRoleDate,
  getMemberRolesDisplayName,
  getRoleStatusLabel,
  getRoleStatusVariant,
  isUniqueConstraintRace,
  roleMatchesSearch,
  toDateOnlyValue,
} from './memberRoles.display';

describe('memberRoles.display', () => {
  it('prefers preferred name when present', () => {
    expect(
      getMemberRolesDisplayName({
        id: 'member-1',
        organisationId: 'org-1',
        membershipTypeId: null,
        firstName: 'Jane',
        lastName: 'Doe',
        preferredName: 'JD',
      })
    ).toBe('JD Doe');
  });

  it('formats null role dates as em dash', () => {
    expect(formatRoleDate(null)).toBe('—');
  });

  it('returns active status for rows without end date', () => {
    const row = {
      id: 'role-1',
      memberId: 'member-1',
      roleId: 12,
      organisationId: 'org-1',
      startDate: '2026-05-01',
      endDate: null,
      roleName: 'Leader',
      title: null,
    };
    expect(getRoleStatusLabel(row)).toBe('Active');
    expect(getRoleStatusVariant(row)).toBe('soft-main-normal');
  });

  it('matches search against role name case-insensitively', () => {
    const row = {
      id: 'role-1',
      memberId: 'member-1',
      roleId: 12,
      organisationId: 'org-1',
      startDate: '2026-05-01',
      endDate: null,
      roleName: 'First Aid',
      title: null,
    };
    expect(roleMatchesSearch(row, 'aid')).toBe(true);
    expect(roleMatchesSearch(row, 'leader')).toBe(false);
  });

  it('converts UTC dates to date-only values', () => {
    const date = new Date(Date.UTC(2026, 4, 8));
    expect(toDateOnlyValue(date)).toBe('2026-05-08');
  });

  it('detects active uniqueness index errors', () => {
    const error = { message: 'duplicate key value violates unique constraint "core_member_role_active_unique"' };
    expect(isUniqueConstraintRace(error)).toBe(true);
  });
});
