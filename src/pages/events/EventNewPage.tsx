import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, PageHeader } from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { PAGE_NAMES } from '@/lib/rbac/pageNames';

function EventNewPageContent() {
  usePaceMain({ printTitle: 'Create event', ariaLabel: 'Create event' });
  const navigate = useNavigate();

  return (
    <main className="grid gap-6">
      <PageHeader
        title="Create event"
        subtitle="Set up a new event for your organisation."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/events')}>
            Back to events
          </Button>
        }
      />
      <EmptyState
        title="Event creation is coming soon"
        description="The create-event flow will be delivered in a later TEAM slice."
      />
    </main>
  );
}

export function EventNewPage() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.events} operation="create" fallback={<AccessDenied />}>
      <EventNewPageContent />
    </PagePermissionGuard>
  );
}
