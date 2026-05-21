import type {
  AdditionalContactRow,
  ApplicationStatus,
  ContactPermissionType,
  MemberApplicationRow,
  MembershipStatus,
} from './member360.types';

type BadgeVariant =
  | 'soft-main-normal'
  | 'soft-sec-normal'
  | 'soft-sec-muted'
  | 'soft-acc-normal';

const APPLICATION_STATUS_COPY: Record<Exclude<ApplicationStatus, 'draft'>, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function membershipStatusBadgeVariant(status: MembershipStatus): BadgeVariant {
  switch (status) {
    case 'Active':
      return 'soft-main-normal';
    case 'Revoked':
      return 'soft-acc-normal';
    case 'Provisional':
      return 'soft-sec-normal';
    case 'Suspended':
    case 'Lapsed':
    case 'Resigned':
      return 'soft-sec-muted';
    default:
      return 'soft-sec-normal';
  }
}

export function cardActiveBadgeVariant(isActive: boolean): BadgeVariant {
  return isActive ? 'soft-main-normal' : 'soft-sec-muted';
}

export function contactTierLabel(permissionType: ContactPermissionType): string {
  if (permissionType === 'full') {
    return 'Full';
  }
  if (permissionType === 'notify') {
    return 'Notify';
  }
  return 'None';
}

export function contactTierBadgeVariant(permissionType: ContactPermissionType): BadgeVariant {
  return permissionType === 'full' ? 'soft-sec-normal' : 'soft-sec-muted';
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  if (status === 'draft') {
    return 'Draft';
  }
  return APPLICATION_STATUS_COPY[status];
}

export function applicationStatusBadgeVariant(status: ApplicationStatus): BadgeVariant {
  if (status === 'approved') {
    return 'soft-main-normal';
  }
  if (status === 'rejected') {
    return 'soft-acc-normal';
  }
  if (status === 'withdrawn') {
    return 'soft-sec-muted';
  }
  return 'soft-sec-normal';
}

export function filterContacts(rows: AdditionalContactRow[], query: string): AdditionalContactRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return rows;
  }

  return rows.filter((row) => {
    const searchable = [
      row.firstName ?? '',
      row.lastName ?? '',
      row.preferredName ?? '',
      row.contactTypeName ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function filterCards<T extends { cardIdentifier: string }>(rows: T[], query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return rows;
  }

  return rows.filter((row) => row.cardIdentifier.toLowerCase().includes(normalizedQuery));
}

export function filterApplications(rows: MemberApplicationRow[], query: string): MemberApplicationRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return rows;
  }

  return rows.filter((row) => (row.eventName ?? '').toLowerCase().includes(normalizedQuery));
}
