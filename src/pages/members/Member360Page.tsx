import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { Member360PageContent } from '@/components/members/member360/Member360PageContent';

export function Member360Page() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.members} operation="read" fallback={<AccessDenied />}>
      <Member360PageContent />
    </PagePermissionGuard>
  );
}
