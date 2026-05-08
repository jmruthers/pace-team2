import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingSpinner,
  toast,
} from '@solvera/pace-core/components';
import { AccessDenied, PagePermissionGuard, useResourcePermissions } from '@solvera/pace-core/rbac';
import { useApprovalRequestDetail } from '@/hooks/useApprovalRequestDetail';
import { useResolveMemberRequest } from '@/hooks/useResolveMemberRequest';
import { getPersonDisplayName, getResolverDisplayName, requestTypeLabel, statusLabel } from '@/lib/approvals/approvals.mappers';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';
import { ApproveResolveDialog, HoldResolveDialog, RejectResolveDialog } from '@/components/approvals/resolveDialogs';

interface ApprovalReviewPanelProps {
  requestId: string | undefined;
  organisationId: string | null;
}

function buildResolvedHeader(request: ApprovalRequestRow): string {
  const actionLabel = statusLabel(request.status);
  const resolvedDate = request.resolvedAt ?? 'unknown date';
  return `${actionLabel} by ${getResolverDisplayName(request)} on ${resolvedDate}.`;
}

function ApprovalReviewPanelContent({ requestId, organisationId }: ApprovalReviewPanelProps) {
  const navigate = useNavigate();
  const hasHandledMissingRequestRef = useRef(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const { canUpdate } = useResourcePermissions('approvals', ['update']);
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
    () => navigate('/approvals')
  );

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
    navigate('/approvals');
  }, [navigate, request, requestErrorMessage, requestId, requestLoading]);

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

  return (
    <main className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Review request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p>Reviewing request from {getPersonDisplayName(request)}</p>
          {!canResolve && (
            <Alert>
              <AlertTitle>Read-only request</AlertTitle>
              <AlertDescription>
                {request.status === 'pending'
                  ? 'You can review this request, but only approvers with update access can resolve it.'
                  : buildResolvedHeader(request)}
              </AlertDescription>
            </Alert>
          )}
          <article className="grid gap-1">
            <h2>Applicant</h2>
            <p>{getPersonDisplayName(request)}</p>
            <p>{request.subjectEmail ?? '—'}</p>
          </article>
          <article className="grid gap-1">
            <h2>Request</h2>
            <p>{requestTypeLabel(request.requestType)}</p>
            <Badge>{statusLabel(request.status)}</Badge>
          </article>
          <article className="grid gap-1">
            <h2>Applicant member number</h2>
            <p>{request.applicantMemberNumber ?? '—'}</p>
          </article>
          {showMemberLink && (
            <nav aria-label="Member actions">
              <Link to={`/members/${request.subjectMemberId}`}>View member 360</Link>
            </nav>
          )}
          {canResolve && (
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form responses</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {formResponsesLoading && <LoadingSpinner label="Loading form responses" />}
          {formResponseErrorMessage != null && (
            <>
              <Alert variant="destructive">
                <AlertTitle>Could not load form responses</AlertTitle>
                <AlertDescription>{formResponseErrorMessage}</AlertDescription>
              </Alert>
              <nav aria-label="Form responses retry">
                <Button type="button" onClick={() => void refetchFormResponses()}>
                  Retry
                </Button>
              </nav>
            </>
          )}
          {!formResponsesLoading && formResponseErrorMessage == null && formResponses.length === 0 && (
            <p>No form responses recorded for this request.</p>
          )}
          {!formResponsesLoading &&
            formResponseErrorMessage == null &&
            formResponses.map((entry) => (
              <article key={entry.fieldKey} className="grid gap-1">
                <h2>{entry.label}</h2>
                <p>{entry.value}</p>
              </article>
            ))}
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
  return (
    <PagePermissionGuard pageName="approvals" operation="read" fallback={<AccessDenied />}>
      <ApprovalReviewPanelContent {...props} />
    </PagePermissionGuard>
  );
}
