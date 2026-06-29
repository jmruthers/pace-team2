import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingSpinner,
  toast,
} from '@solvera/pace-core/components';
import { useResourcePermissions } from '@solvera/pace-core/rbac';
import { useApprovalRequestDetail } from '@/hooks/useApprovalRequestDetail';
import { useIssuingOrganisation } from '@/hooks/useIssuingOrganisation';
import { useResolveMemberRequest } from '@/hooks/useResolveMemberRequest';
import {
  buildMembershipIssuingOrgMessage,
  buildTransferClosureMessage,
} from '@/lib/approvals/approvals.optionA.copy';
import {
  formatResolvedDateHeading,
  getPersonDisplayName,
  getResolverDisplayName,
  statusLabel,
} from '@/lib/approvals/approvals.mappers';
import {
  ApprovalReviewApplicantAside,
} from '@/components/approvals/ApprovalReviewApplicantAside';
import { ApprovalReviewFormResponsesAside } from '@/components/approvals/ApprovalReviewFormResponsesAside';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';
import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { ApproveResolveDialog, HoldResolveDialog, RejectResolveDialog } from '@/components/approvals/ResolveDialogs';

interface ApprovalReviewPanelProps {
  requestId: string | undefined;
  organisationId: string | null;
  onAfterResolve?: () => void;
  onLeaveQueue?: () => void;
}

function buildClosedReadOnlyTitle(request: ApprovalRequestRow): string {
  return `${statusLabel(request.status)} by ${getResolverDisplayName(request)} on ${formatResolvedDateHeading(request.resolvedAt)}`;
}

function buildClosedReadOnlyDescription(request: ApprovalRequestRow): string {
  const note = (request.reviewNotes ?? '').trim();
  if (note.length === 0) {
    return 'No note recorded.';
  }
  return note;
}

function ApprovalReviewPanelContent({
  requestId,
  organisationId,
  onAfterResolve,
  onLeaveQueue,
}: ApprovalReviewPanelProps) {
  const navigate = useNavigate();
  const leaveQueue = useCallback(
    () => (onLeaveQueue != null ? onLeaveQueue() : navigate('/approvals')),
    [navigate, onLeaveQueue],
  );
  const afterResolve = useCallback(
    () => (onAfterResolve != null ? onAfterResolve() : leaveQueue()),
    [leaveQueue, onAfterResolve],
  );
  const hasHandledMissingRequestRef = useRef(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const { canUpdate } = useResourcePermissions(PAGE_NAMES.approvals, ['update']);
  const {
    request,
    requestLoading,
    requestErrorMessage,
    formResponses,
    formResponsesLoading,
    formResponseErrorMessage,
    refetchRequest,
    refetchFormResponses,
  } = useApprovalRequestDetail(requestId, organisationId);
  const { resolveRequest, resolvePending } = useResolveMemberRequest(
    organisationId,
    requestId,
    afterResolve
  );

  const resolveFromOrganisationId =
    request?.targetOrganisationId ?? request?.organisationId ?? organisationId;

  const {
    issuingOrganisationName,
    showIssuingContext,
    issuingOrgLoading,
  } = useIssuingOrganisation({
    selectedOrganisationId: organisationId,
    resolveFromOrganisationId,
    knownIssuingOrganisationId: request?.subjectMemberOrganisationId ?? null,
  });

  useEffect(() => {
    if (requestLoading || requestErrorMessage != null || requestId == null) {
      hasHandledMissingRequestRef.current = false;
      return;
    }
    if (request != null || hasHandledMissingRequestRef.current) {
      return;
    }
    hasHandledMissingRequestRef.current = true;
    toast({
      title: 'Request not found in this organisation.',
      variant: 'default',
    });
    leaveQueue();
  }, [leaveQueue, request, requestErrorMessage, requestId, requestLoading]);

  if (requestId == null) {
    return (
      <section className="grid place-items-center min-h-[40vh]">
        <article>
          <h2>Select a request to review</h2>
          <p>Click a row in the queue to open the review panel.</p>
        </article>
      </section>
    );
  }

  if (requestLoading) {
    return (
      <section className="grid place-items-center min-h-[40vh]">
        <LoadingSpinner label="Loading request" />
      </section>
    );
  }

  if (requestErrorMessage != null) {
    return (
      <section className="grid gap-3">
        <Alert variant="destructive">
          <AlertTitle>Could not load request</AlertTitle>
          <AlertDescription>{requestErrorMessage}</AlertDescription>
        </Alert>
        <nav aria-label="Request retry">
          <Button type="button" onClick={() => void refetchRequest()}>
            Retry
          </Button>
        </nav>
      </section>
    );
  }

  if (request == null) {
    return null;
  }

  const canResolve = canUpdate && request.status === 'pending';
  const showMemberLink = request.subjectMemberId != null && request.subjectMemberDeletedAt == null;
  const applicantName = getPersonDisplayName(request);
  const resolveWithApplicantToast = { applicantDisplayNameForToast: applicantName };
  const membershipIssuingOrgMessage = showIssuingContext
    ? buildMembershipIssuingOrgMessage(issuingOrganisationName)
    : null;
  const transferClosureMessage =
    request.requestType === 'transfer' && request.status === 'pending'
      ? buildTransferClosureMessage(request.sourceOrganisationName)
      : null;
  const showPlacementsLink =
    request.status === 'approved' &&
    request.subjectMemberId != null &&
    request.subjectMemberDeletedAt == null;

  return (
    <main className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Review request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p>Reviewing request from {applicantName}</p>

          {request.status !== 'pending' && (
            <Alert variant="default">
              <AlertTitle>{buildClosedReadOnlyTitle(request)}</AlertTitle>
              <AlertDescription>{buildClosedReadOnlyDescription(request)}</AlertDescription>
            </Alert>
          )}

          {request.status === 'pending' && !canResolve && (
            <Alert variant="default">
              <AlertTitle>Read-only request</AlertTitle>
              <AlertDescription>
                You can review this request, but only approvers with update access can resolve it.
              </AlertDescription>
            </Alert>
          )}

          {canResolve ? (
            <nav aria-label="Resolve actions" className="grid justify-end">
              <section className="grid grid-flow-col auto-cols-max gap-2">
                <Button type="button" variant="destructive" onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
                <Button type="button" variant="outline" onClick={() => setHoldOpen(true)}>
                  Put on hold
                </Button>
                <Button type="button" onClick={() => setApproveOpen(true)}>
                  Approve
                </Button>
              </section>
            </nav>
          ) : null}

          <section className="grid gap-6 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-8">
            <ApprovalReviewApplicantAside
              request={request}
              applicantName={applicantName}
              membershipIssuingOrgMessage={membershipIssuingOrgMessage}
              issuingOrgLoading={issuingOrgLoading}
              transferClosureMessage={transferClosureMessage}
              showMemberLink={showMemberLink}
              showPlacementsLink={showPlacementsLink}
              onViewMember={() => navigate(`/members/${request.subjectMemberId}`)}
              onViewPlacements={() => navigate(`/members/${request.subjectMemberId}/roles`)}
            />
            <ApprovalReviewFormResponsesAside
              formResponses={formResponses}
              formResponsesLoading={formResponsesLoading}
              formResponseErrorMessage={formResponseErrorMessage}
              onRetry={() => void refetchFormResponses()}
              onConfigureForms={() => navigate('/forms')}
            />
          </section>
        </CardContent>
      </Card>

      <ApproveResolveDialog
        request={request}
        open={approveOpen}
        onOpenChange={setApproveOpen}
        pending={resolvePending}
        onSubmit={async ({ memberNumber }) => {
          const outcome = await resolveRequest({
            requestId: request.id,
            status: 'approved',
            memberNumber: memberNumber ?? null,
            ...resolveWithApplicantToast,
          });
          return outcome == null || outcome.keepDialogOpen === false;
        }}
      />
      <RejectResolveDialog
        request={request}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        pending={resolvePending}
        onSubmit={async ({ reviewNotes }) => {
          const outcome = await resolveRequest({
            requestId: request.id,
            status: 'rejected',
            reviewNotes: reviewNotes ?? null,
          });
          return outcome == null || outcome.keepDialogOpen === false;
        }}
      />
      <HoldResolveDialog
        request={request}
        open={holdOpen}
        onOpenChange={setHoldOpen}
        pending={resolvePending}
        onSubmit={async ({ reviewNotes }) => {
          const outcome = await resolveRequest({
            requestId: request.id,
            status: 'on_hold',
            reviewNotes: reviewNotes ?? null,
          });
          return outcome == null || outcome.keepDialogOpen === false;
        }}
      />
    </main>
  );
}

export function ApprovalReviewPanel(props: ApprovalReviewPanelProps) {
  return <ApprovalReviewPanelContent {...props} />;
}
