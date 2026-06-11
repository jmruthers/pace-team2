import type { ReactElement, ReactNode } from 'react';
import {
  Member360LoadErrorState,
  Member360LoadingState,
  Member360NotFound,
  Member360OrgMismatchState,
} from '@/components/members/member360/Member360PageStates';

interface Member360GuardViewProps {
  memberLoading: boolean;
  memberErrorMessage: string | null;
  memberMissing: boolean;
  identityValuesMissing: boolean;
  isOrgMismatch: boolean;
  onRetryMember: () => void;
  onBackToMembers: () => void;
  children: ReactNode;
}

export function Member360GuardView({
  memberLoading,
  memberErrorMessage,
  memberMissing,
  identityValuesMissing,
  isOrgMismatch,
  onRetryMember,
  onBackToMembers,
  children,
}: Member360GuardViewProps): ReactElement {
  if (memberLoading) {
    return <Member360LoadingState />;
  }
  if (memberErrorMessage != null) {
    return <Member360LoadErrorState message={memberErrorMessage} onRetry={onRetryMember} />;
  }
  if (memberMissing || identityValuesMissing) {
    return <Member360NotFound />;
  }
  if (isOrgMismatch) {
    return <Member360OrgMismatchState onBack={onBackToMembers} />;
  }
  return <>{children}</>;
}
