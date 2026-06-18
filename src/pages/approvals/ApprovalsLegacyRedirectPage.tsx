import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { Navigate, useParams } from 'react-router-dom';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';

/** Legacy deep links map to in-page selection on `/approvals`. */
export function ApprovalsLegacyRedirectPage() {
  const { requestId } = useParams();
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.approvals} operation="read" fallback={<AccessDenied />}>
      <Navigate to="/approvals" replace state={{ requestId }} />
    </PagePermissionGuard>
  );
}
