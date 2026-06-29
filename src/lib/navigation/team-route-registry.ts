import type { NavigationItem } from '@solvera/pace-core/components';

export type TeamRoutePermissionOperation = 'read';

export interface TeamRoutePermissionConfig {
  pageName: string;
  operation: TeamRoutePermissionOperation;
}

export interface TeamRouteDefinition {
  path: string;
  pageName: string;
  /** React page file stem when it differs from RBAC `pageName` (shell audit). */
  pageStem?: string;
}

/** Org-scoped TEAM routes registered for shell read enforcement. */
export const TEAM_ROUTE_REGISTRY: readonly TeamRouteDefinition[] = [
  { path: '/', pageName: 'HomePage', pageStem: 'OrgLandingPage' },
  { path: '/orgs/:orgId', pageName: 'HomePage', pageStem: 'OrgOverviewPage' },
  { path: '/members', pageName: 'MembersPage', pageStem: 'MemberDirectoryPage' },
  { path: '/members/invite', pageName: 'MembersPage', pageStem: 'MemberInvitePage' },
  { path: '/members/:memberId', pageName: 'MembersPage', pageStem: 'Member360Page' },
  { path: '/members/:memberId/roles', pageName: 'MemberRolesPage' },
  { path: '/member-roles', pageName: 'MemberRolesPage', pageStem: 'MemberRolesPlaceholderPage' },
  { path: '/approvals', pageName: 'ApprovalsPage' },
  { path: '/approvals/:requestId', pageName: 'ApprovalsPage', pageStem: 'ApprovalsLegacyRedirectPage' },
  { path: '/communications', pageName: 'CommsLogPage', pageStem: 'CommunicationsPage' },
  { path: '/communications/log', pageName: 'CommsLogPage', pageStem: 'CommunicationsLogPage' },
  { path: '/events', pageName: 'EventsPage', pageStem: 'EventsListPage' },
  { path: '/events/new', pageName: 'EventsPage', pageStem: 'EventNewPage' },
  { path: '/events/:eventId', pageName: 'EventsPage', pageStem: 'EventDetailPage' },
  { path: '/forms', pageName: 'FormsPage', pageStem: 'FormsListPage' },
  { path: '/forms/new', pageName: 'FormsPage', pageStem: 'FormAuthoringPage' },
  { path: '/forms/:formId', pageName: 'FormsPage', pageStem: 'FormAuthoringPage' },
  { path: '/reports', pageName: 'ReportsPage' },
  { path: '/moderation/photos', pageName: 'ModerationPhotosPage', pageStem: 'PhotoModerationPage' },
  { path: '/settings/membership-types', pageName: 'MembershipTypesPage' },
  { path: '/settings/organisations', pageName: 'OrganisationsPage', pageStem: 'SubOrganisationsPage' },
  { path: '/settings/sub-orgs', pageName: 'OrganisationsPage', pageStem: 'SubOrganisationsPage' },
  { path: '/settings/org', pageName: 'OrgSettingsPage', pageStem: 'OrganisationSettingsPage' },
  { path: '/settings/organisation', pageName: 'OrgSettingsPage', pageStem: 'OrganisationSettingsPage' },
  { path: '/settings/people', pageName: 'OrgSettingsPage', pageStem: 'SettingsPeoplePage' },
] as const;

export const TEAM_ROUTE_PERMISSIONS: Record<string, TeamRoutePermissionConfig> = Object.fromEntries(
  TEAM_ROUTE_REGISTRY.map((route) => [
    route.pageName,
    {
      pageName: route.pageName,
      operation: 'read' as const,
    },
  ])
);

function assertTeamRoutePermissionParity(): void {
  for (const route of TEAM_ROUTE_REGISTRY) {
    const mapped = TEAM_ROUTE_PERMISSIONS[route.pageName];
    if (mapped == null) {
      throw new Error(`Missing route permission mapping for "${route.pageName}".`);
    }
    if (mapped.pageName !== route.pageName) {
      throw new Error(
        `Route permission mismatch for "${route.path}": registry "${route.pageName}" does not match mapping "${mapped.pageName}".`
      );
    }
  }
}

assertTeamRoutePermissionParity();

export function teamNavPermissionForPage(pageId: string): string {
  return `read:page.${pageId}`;
}

export function getTeamRouteForPathname(pathname: string): TeamRouteDefinition | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/';

  for (const route of TEAM_ROUTE_REGISTRY) {
    if (route.path === normalized) {
      return route;
    }
  }

  for (const route of TEAM_ROUTE_REGISTRY) {
    if (route.path.includes(':') && matchParamRoute(route.path, normalized)) {
      return route;
    }
  }

  let best: TeamRouteDefinition | undefined;
  let bestLength = -1;

  for (const route of TEAM_ROUTE_REGISTRY) {
    const routePath = route.path;
    if (routePath.includes(':')) {
      continue;
    }
    if (normalized.startsWith(`${routePath}/`) && routePath.length > bestLength) {
      best = route;
      bestLength = routePath.length;
    }
  }

  return best;
}

function matchParamRoute(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => {
    if (part.startsWith(':')) return true;
    return part === pathParts[index];
  });
}

export function getTeamRoutePermissionForPath(pathname: string): TeamRoutePermissionConfig | undefined {
  const route = getTeamRouteForPathname(pathname);
  if (route == null) {
    return undefined;
  }
  return { pageName: route.pageName, operation: 'read' };
}

export function attachTeamNavPermissions(items: readonly NavigationItem[]): NavigationItem[] {
  return items.map((item) => {
    if (item.pageId == null) {
      return { ...item };
    }
    return {
      ...item,
      permissions: [teamNavPermissionForPage(item.pageId)],
    };
  });
}
