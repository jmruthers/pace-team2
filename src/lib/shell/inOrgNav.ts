import type { NavigationItem } from '@solvera/pace-core/components';
import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { attachTeamNavPermissions } from '@/lib/navigation/team-route-registry';

export const IN_ORG_PAGE_LABELS: Record<string, string> = {
  members: 'Members',
  approvals: 'Approvals',
  events: 'Events',
  communications: 'Communications',
  forms: 'Forms',
  reports: 'Reports',
  moderation: 'Moderation',
  settings: 'Settings',
  'member-roles': 'Member roles',
};

const SETTINGS_SECTION_LABELS: Record<string, string> = {
  organisation: 'Organisation details',
  org: 'Organisation details',
  people: 'People & access',
  'membership-types': 'Membership types',
  'sub-orgs': 'Sub-organisations',
  organisations: 'Sub-organisations',
};

export function buildInOrgNavItems(selectedOrganisationId: string): NavigationItem[] {
  return attachTeamNavPermissions([
    {
      id: 'nav-overview',
      label: 'Overview',
      href: `/orgs/${selectedOrganisationId}`,
      icon: 'LayoutDashboard',
      pageId: PAGE_NAMES.home,
    },
    {
      id: 'nav-members',
      label: 'Members',
      href: '/members',
      icon: 'Users',
      pageId: PAGE_NAMES.members,
    },
    {
      id: 'nav-communications',
      label: 'Communications',
      href: '/communications',
      icon: 'MessageSquare',
      pageId: PAGE_NAMES.commsLog,
    },
    {
      id: 'nav-reports',
      label: 'Reports',
      href: '/reports',
      icon: 'BarChart2',
      pageId: PAGE_NAMES.reports,
    },
  ]);
}

export function resolveInOrgPageLabel(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const [first, second, third] = segments;

  if (first === 'orgs') {
    return null;
  }

  if (first === 'settings') {
    return SETTINGS_SECTION_LABELS[second ?? ''] ?? IN_ORG_PAGE_LABELS.settings;
  }

  if (first === 'members') {
    if (second == null) {
      return IN_ORG_PAGE_LABELS.members;
    }
    if (second === 'invite') {
      return 'Invite member';
    }
    if (third === 'roles') {
      return 'Standing roles';
    }
    return 'Member 360';
  }

  if (first === 'member-roles') {
    return IN_ORG_PAGE_LABELS['member-roles'];
  }

  if (first === 'forms') {
    return second != null ? 'Form authoring' : IN_ORG_PAGE_LABELS.forms;
  }

  if (first === 'events') {
    return second != null ? 'Event detail' : IN_ORG_PAGE_LABELS.events;
  }

  if (first === 'approvals') {
    return IN_ORG_PAGE_LABELS.approvals;
  }

  if (first === 'communications') {
    return second === 'log' ? 'Send log' : IN_ORG_PAGE_LABELS.communications;
  }

  if (first === 'moderation') {
    return IN_ORG_PAGE_LABELS.moderation;
  }

  return IN_ORG_PAGE_LABELS[first] ?? null;
}

export function isOrganisationLandingPath(pathname: string): boolean {
  return pathname === '/';
}

export function isOrganisationOverviewPath(pathname: string): boolean {
  return /^\/orgs\/[^/]+\/?$/u.test(pathname);
}

export function shouldShowOrgContextBar(pathname: string): boolean {
  if (isOrganisationLandingPath(pathname) || isOrganisationOverviewPath(pathname)) {
    return false;
  }
  return resolveInOrgPageLabel(pathname) != null;
}
