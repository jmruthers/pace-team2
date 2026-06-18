import type { OrganisationMembershipRole } from '@solvera/pace-core/types';

const MEMBERSHIP_ROLE_LABELS: Record<OrganisationMembershipRole, string> = {
  org_admin: 'Org admin',
  leader: 'Leader',
  member: 'Member',
  supporter: 'Supporter',
};

export function orgInitials(name: string | null | undefined): string {
  if (name == null || name.trim().length === 0) {
    return 'ORG';
  }
  const tokens = name.split(/[\s\-_—]+/u).filter((token) => /[a-z0-9]/iu.test(token));
  if (tokens.length === 0) {
    return 'ORG';
  }
  return tokens
    .map((token) => {
      const match = /[a-z0-9]/iu.exec(token);
      return match != null ? match[0].toUpperCase() : '';
    })
    .join('')
    .slice(0, 3);
}

export function formatMembershipRole(role: OrganisationMembershipRole | string | null | undefined): string {
  if (role == null || role.length === 0) {
    return 'Member';
  }
  if (role in MEMBERSHIP_ROLE_LABELS) {
    return MEMBERSHIP_ROLE_LABELS[role as OrganisationMembershipRole];
  }
  return role;
}

export function organisationDisplayName(org: { display_name?: string | null; name?: string | null }): string {
  const displayName = org.display_name?.trim();
  if (displayName != null && displayName.length > 0) {
    return displayName;
  }
  const name = org.name?.trim();
  if (name != null && name.length > 0) {
    return name;
  }
  return 'Organisation';
}
