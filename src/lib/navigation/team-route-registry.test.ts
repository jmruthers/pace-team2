import { describe, expect, it } from 'vitest';
import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import {
  TEAM_ROUTE_REGISTRY,
  TEAM_ROUTE_PERMISSIONS,
  getTeamRouteForPathname,
  getTeamRoutePermissionForPath,
} from '@/lib/navigation/team-route-registry';

describe('team-route-registry', () => {
  it('keeps route registry and permission map in parity', () => {
    for (const route of TEAM_ROUTE_REGISTRY) {
      const mapped = TEAM_ROUTE_PERMISSIONS[route.pageName];
      expect(mapped).toBeDefined();
      expect(mapped?.pageName).toBe(route.pageName);
      expect(mapped?.operation).toBe('read');
    }
  });

  it('resolves org-prefixed and feature route permissions', () => {
    expect(getTeamRouteForPathname('/orgs/org-1')?.pageName).toBe(PAGE_NAMES.home);
    expect(getTeamRouteForPathname('/members/member-1')?.pageName).toBe(PAGE_NAMES.members);
    expect(getTeamRouteForPathname('/members/member-1/roles')?.pageName).toBe(PAGE_NAMES.memberRoles);
    expect(getTeamRouteForPathname('/approvals/request-1')?.pageName).toBe(PAGE_NAMES.approvals);
    expect(getTeamRouteForPathname('/communications/log')?.pageName).toBe(PAGE_NAMES.commsLog);
    expect(getTeamRouteForPathname('/events/event-1')?.pageName).toBe(PAGE_NAMES.events);
    expect(getTeamRouteForPathname('/forms/form-1')?.pageName).toBe(PAGE_NAMES.forms);
    expect(getTeamRouteForPathname('/settings/people')?.pageName).toBe(PAGE_NAMES.orgSettings);
  });

  it('resolves route path permissions for shell routes', () => {
    expect(getTeamRoutePermissionForPath('/members')).toEqual({
      pageName: PAGE_NAMES.members,
      operation: 'read',
    });
    expect(getTeamRoutePermissionForPath('/approvals')).toEqual({
      pageName: PAGE_NAMES.approvals,
      operation: 'read',
    });
    expect(getTeamRoutePermissionForPath('/')).toEqual({
      pageName: PAGE_NAMES.home,
      operation: 'read',
    });
    expect(getTeamRoutePermissionForPath('/unknown-route')).toBeUndefined();
  });
});
