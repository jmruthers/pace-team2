import { usePaceMain } from '@solvera/pace-core/hooks';
import { EmptyState, PageHeader } from '@solvera/pace-core/components';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';

import { PAGE_NAMES } from '@/lib/rbac/pageNames';

function MemberRolesPlaceholderPageContent() {
  usePaceMain({ printTitle: 'Member roles', ariaLabel: 'Member roles' });

  return (
    <main className="grid gap-6">
      <PageHeader
        title="Member roles"
        subtitle="Appointments and leaders across all units."
        breadcrumbItems={[
          { label: 'Organisations', href: '/' },
          { label: 'Member roles' },
        ]}
      />
      <EmptyState
        title="Member roles is coming soon"
        description="The org-wide member roles surface will be delivered in TEAM-04."
      />
    </main>
  );
}

export function MemberRolesPlaceholderPage() {
  return (
    <PagePermissionGuard
      pageName={PAGE_NAMES.memberRoles}
      operation="read"
      fallback={<AccessDenied message="You do not have permission to view this page." />}
    >
      <MemberRolesPlaceholderPageContent />
    </PagePermissionGuard>
  );
}
