import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { Member360PageContent } from '@/pages/members/member360/Member360PageContent';

export function Member360Page() {
  return (
    <PagePermissionGuard pageName="members" operation="read" fallback={<AccessDenied />}>
      <Member360PageContent />
    </PagePermissionGuard>
  );
}
