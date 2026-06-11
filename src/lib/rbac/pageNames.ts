/** Canonical rbac_app_pages.page_name values (PascalCase *Page). */
export const PAGE_NAMES = {
  home: 'HomePage',
  members: 'MembersPage',
  memberRoles: 'MemberRolesPage',
  approvals: 'ApprovalsPage',
  membershipTypes: 'MembershipTypesPage',
  organisations: 'OrganisationsPage',
  orgSettings: 'OrgSettingsPage',
  forms: 'FormsPage',
  events: 'EventsPage',
  reports: 'ReportsPage',
  moderationPhotos: 'ModerationPhotosPage',
  commsLog: 'CommsLogPage',
  memberProfile: 'MemberProfilePage',
} as const;

export type PageName = (typeof PAGE_NAMES)[keyof typeof PAGE_NAMES];
