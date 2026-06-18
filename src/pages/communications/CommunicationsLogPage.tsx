import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, PageHeader } from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { PAGE_NAMES } from '@/lib/rbac/pageNames';

function CommunicationsLogPageContent() {
  usePaceMain({ printTitle: 'Send log', ariaLabel: 'Communications send log' });
  const navigate = useNavigate();

  return (
    <main className="grid gap-6">
      <PageHeader
        title="Send log"
        subtitle="Review messages sent from your organisation."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/communications')}>
            Back to compose
          </Button>
        }
      />
      <EmptyState
        title="Send log is coming soon"
        description="Recent sends and delivery history will appear here."
      />
    </main>
  );
}

export function CommunicationsLogPage() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.commsLog} operation="read" fallback={<AccessDenied />}>
      <CommunicationsLogPageContent />
    </PagePermissionGuard>
  );
}
