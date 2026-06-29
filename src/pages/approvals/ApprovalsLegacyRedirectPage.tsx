import { Navigate, useParams } from 'react-router-dom';

/** Legacy deep links map to in-page selection on `/approvals`. */
export function ApprovalsLegacyRedirectPage() {
  const { requestId } = useParams();
  return <Navigate to="/approvals" replace state={{ requestId }} />;
}
