import { usePaceMain } from '@solvera/pace-core/hooks';
import { EmptyState, PageHeader } from '@solvera/pace-core/components';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';

import { PAGE_NAMES } from '@/lib/rbac/pageNames';

function SettingsPeoplePageContent() {
  usePaceMain({ printTitle: 'People & access', ariaLabel: 'People and access settings' });

  return (
    <main className="grid gap-6">
      <PageHeader
        title="People & access"
        subtitle="Staff, admins and delegated permissions."
        breadcrumbItems={[
          { label: 'Organisations', href: '/' },
          { label: 'People & access' },
        ]}
      />
      <EmptyState
        title="People & access is coming soon"
        description="This settings surface will be delivered in a later TEAM slice."
      />
    </main>
  );
}

export function SettingsPeoplePage() {
  return (
    <PagePermissionGuard
      pageName={PAGE_NAMES.orgSettings}
      operation="read"
      fallback={<AccessDenied message="You do not have permission to view this page." />}
    >
      <SettingsPeoplePageContent />
    </PagePermissionGuard>
  );
}
