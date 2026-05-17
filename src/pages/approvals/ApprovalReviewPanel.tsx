import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
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
import {
  formatRequestSubmittedAt,
  formatResolvedDateHeading,
  getApprovalApplicantAvatarName,
  getPersonDisplayName,
  getResolverDisplayName,
  hasDistinctApprovalPreferredName,
  requestTypeLabel,
  statusLabel,
} from '@/lib/approvals/approvals.mappers';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';
import { ApproveResolveDialog, HoldResolveDialog, RejectResolveDialog } from '@/components/approvals/resolveDialogs';

interface ApprovalReviewPanelProps {
  requestId: string | undefined;
  organisationId: string | null;
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
  const applicantName = getPersonDisplayName(request);
  const avatarName = getApprovalApplicantAvatarName(request);
  const resolveWithApplicantToast = { applicantDisplayNameForToast: applicantName };
  const showPreferredLine = hasDistinctApprovalPreferredName(request);

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
            <aside className="grid gap-6" aria-label="Applicant and request">
              <article className="grid gap-3">
                <h3>Applicant</h3>
                {/* eslint-disable pace-core-compliance/prefer-semantic-html -- WHATWG: div wrappers group dt/dd pairs inside dl */}
                <dl className="grid gap-3">
                  <div className="grid gap-1">
                    <dt>Full name</dt>
                    <dd>
                      <p>{applicantName}</p>
                    </dd>
                  </div>
                  {showPreferredLine ? (
                    <div className="grid gap-1">
                      <dt>Preferred name</dt>
                      <dd>
                        <p>{request.subjectPreferredName}</p>
                      </dd>
                    </div>
                  ) : null}
                  <div className="grid gap-1">
                    <dt>Email</dt>
                    <dd>
                      <p>{request.subjectEmail ?? '—'}</p>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Photo</dt>
                    <dd>
                      <Avatar name={avatarName} />
                    </dd>
                  </div>
                </dl>
                {/* eslint-enable pace-core-compliance/prefer-semantic-html */}
              </article>

              <article className="grid gap-3">
                <h3>Request</h3>
                {/* eslint-disable pace-core-compliance/prefer-semantic-html -- WHATWG: div wrappers group dt/dd pairs inside dl */}
                <dl className="grid gap-3">
                  <div className="grid gap-1">
                    <dt>Request type</dt>
                    <dd>
                      <p>
                        <Badge>{requestTypeLabel(request.requestType)}</Badge>
                      </p>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Submitted</dt>
                    <dd>
                      <p>{formatRequestSubmittedAt(request.createdAt)}</p>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Target organisation</dt>
                    <dd>
                      <p>{request.targetOrganisationName ?? '—'}</p>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Source organisation</dt>
                    <dd>
                      <p>{request.requestType === 'transfer' ? (request.sourceOrganisationName ?? '—') : '—'}</p>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Membership type</dt>
                    <dd>
                      <p>{request.membershipTypeName ?? '—'}</p>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Applicant member number</dt>
                    <dd>
                      <p>{request.applicantMemberNumber ?? '—'}</p>
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt>Status</dt>
                    <dd>
                      <p>
                        <Badge>{statusLabel(request.status)}</Badge>
                      </p>
                    </dd>
                  </div>
                </dl>
                {/* eslint-enable pace-core-compliance/prefer-semantic-html */}
              </article>

              {showMemberLink ? (
                <nav aria-label="Member actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/members/${request.subjectMemberId}`)}
                  >
                    View member 360 →
                  </Button>
                </nav>
              ) : null}
            </aside>

            <aside className="grid gap-3 lg:border-l lg:border-border lg:pl-8" aria-label="Form responses">
              <h3>Form responses</h3>
              {formResponsesLoading ? <LoadingSpinner label="Loading form responses" /> : null}
              {formResponseErrorMessage != null ? (
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
              ) : null}
              {!formResponsesLoading && formResponseErrorMessage == null && formResponses.length === 0 ? (
                <section className="grid gap-2">
                  <p>No form configured for this request type.</p>
                  <p>Configure your org signup form at /forms.</p>
                  <nav>
                    <Button type="button" variant="link" onClick={() => navigate('/forms')}>
                      Configure org signup form
                    </Button>
                  </nav>
                </section>
              ) : null}
              {!formResponsesLoading &&
                formResponseErrorMessage == null &&
                formResponses.map((entry) => (
                  <p key={entry.fieldKey}>
                    {entry.label} → {entry.value}
                  </p>
                ))}
            </aside>
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
  return (
    <PagePermissionGuard pageName="approvals" operation="read" fallback={<AccessDenied />}>
      <ApprovalReviewPanelContent {...props} />
    </PagePermissionGuard>
  );
}
