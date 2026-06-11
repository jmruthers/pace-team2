import { Avatar, Badge, Button } from '@solvera/pace-core/components';
import {
  formatRequestSubmittedAt,
  getApprovalApplicantAvatarName,
  hasDistinctApprovalPreferredName,
  requestTypeLabel,
  statusLabel,
} from '@/lib/approvals/approvals.mappers';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';

interface ApprovalReviewApplicantAsideProps {
  request: ApprovalRequestRow;
  applicantName: string;
  membershipIssuingOrgMessage: string | null;
  issuingOrgLoading: boolean;
  transferClosureMessage: string | null;
  showMemberLink: boolean;
  showPlacementsLink: boolean;
  onViewMember: () => void;
  onViewPlacements: () => void;
}

export function ApprovalReviewApplicantAside({
  request,
  applicantName,
  membershipIssuingOrgMessage,
  issuingOrgLoading,
  transferClosureMessage,
  showMemberLink,
  showPlacementsLink,
  onViewMember,
  onViewPlacements,
}: ApprovalReviewApplicantAsideProps) {
  const avatarName = getApprovalApplicantAvatarName(request);
  const showPreferredLine = hasDistinctApprovalPreferredName(request);

  return (
    <aside className="grid gap-6" aria-label="Applicant and request">
      <article className="grid gap-3">
        <h3>Applicant</h3>
        <dl className="grid">
          <dt className="mb-1">Full name</dt>
          <dd className="mb-3">
            <p>{applicantName}</p>
          </dd>
          {showPreferredLine ? (
            <>
              <dt className="mb-1">Preferred name</dt>
              <dd className="mb-3">
                <p>{request.subjectPreferredName}</p>
              </dd>
            </>
          ) : null}
          <dt className="mb-1">Email</dt>
          <dd className="mb-3">
            <p>{request.subjectEmail ?? '—'}</p>
          </dd>
          <dt className="mb-1">Photo</dt>
          <dd>
            <Avatar name={avatarName} />
          </dd>
        </dl>
      </article>

      <article className="grid gap-3">
        <h3>Request</h3>
        <dl className="grid">
          <dt className="mb-1">Request type</dt>
          <dd className="mb-3">
            <p>
              <Badge>{requestTypeLabel(request.requestType)}</Badge>
            </p>
          </dd>
          <dt className="mb-1">Submitted</dt>
          <dd className="mb-3">
            <p>{formatRequestSubmittedAt(request.createdAt)}</p>
          </dd>
          <dt className="mb-1">Target organisation</dt>
          <dd className="mb-3">
            <p>{request.targetOrganisationName ?? '—'}</p>
          </dd>
          {membershipIssuingOrgMessage != null ? (
            <>
              <dt className="mb-1">Membership issuing org</dt>
              <dd className="mb-3">
                <p>{issuingOrgLoading ? 'Loading…' : membershipIssuingOrgMessage}</p>
              </dd>
            </>
          ) : null}
          {transferClosureMessage != null ? (
            <>
              <dt className="mb-1">Transfer closure</dt>
              <dd className="mb-3">
                <p>{transferClosureMessage}</p>
              </dd>
            </>
          ) : null}
          <dt className="mb-1">Source organisation</dt>
          <dd className="mb-3">
            <p>{request.requestType === 'transfer' ? (request.sourceOrganisationName ?? '—') : '—'}</p>
          </dd>
          <dt className="mb-1">Membership type</dt>
          <dd className="mb-3">
            <p>{request.membershipTypeName ?? '—'}</p>
          </dd>
          <dt className="mb-1">Applicant member number</dt>
          <dd className="mb-3">
            <p>{request.applicantMemberNumber ?? '—'}</p>
          </dd>
          <dt className="mb-1">Status</dt>
          <dd>
            <p>
              <Badge>{statusLabel(request.status)}</Badge>
            </p>
          </dd>
        </dl>
      </article>

      {showMemberLink || showPlacementsLink ? (
        <nav aria-label="Member actions" className="grid gap-2">
          {showMemberLink ? (
            <Button type="button" variant="outline" onClick={onViewMember}>
              View member 360 →
            </Button>
          ) : null}
          {showPlacementsLink ? (
            <>
              <Button type="button" variant="outline" onClick={onViewPlacements}>
                View placements →
              </Button>
              <p>Assign a standing role to place this member in the directory.</p>
            </>
          ) : null}
        </nav>
      ) : null}
    </aside>
  );
}
