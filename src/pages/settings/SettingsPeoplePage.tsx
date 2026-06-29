import { usePaceMain } from '@solvera/pace-core/hooks';
import { EmptyState, PageHeader } from '@solvera/pace-core/components';

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
  return <SettingsPeoplePageContent />;
}
