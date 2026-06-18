import type { ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingSpinner,
} from '@solvera/pace-core/components';
import {
  getApprovalApplicantAvatarName,
  getPersonDisplayName,
  requestTypeLabel,
} from '@/lib/approvals/approvals.mappers';
import { formatApprovalSubmittedRelative } from '@/lib/approvals/approvals.relative';
import type { ApprovalRequestRow } from '@/lib/approvals/approvals.types';

interface ApprovalQueueListProps {
  view: 'open' | 'closed';
  rows: ApprovalRequestRow[];
  loading: boolean;
  selectedRequestId: string | null;
  onSelect: (requestId: string) => void;
  emptyState: ReactNode;
}

export function ApprovalQueueList({
  view,
  rows,
  loading,
  selectedRequestId,
  onSelect,
  emptyState,
}: ApprovalQueueListProps) {
  const listTitle = view === 'open' ? 'Awaiting decision' : 'Recently resolved';
  const countLabel = `${rows.length} ${view === 'open' ? 'items' : 'resolved'}`;

  return (
    <Card>
      <CardHeader className="grid grid-cols-[1fr_auto] items-baseline gap-2">
        <CardTitle>{listTitle}</CardTitle>
        <small>{countLabel}</small>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {loading ? (
            <li>
              <section className="grid place-items-center py-8">
                <LoadingSpinner label="Loading requests" />
              </section>
            </li>
          ) : null}
          {!loading && rows.length === 0 ? <li>{emptyState}</li> : null}
          {!loading
            ? rows.map((row) => {
                const isActive = row.id === selectedRequestId;
                const membershipLine = [row.membershipTypeName, row.targetOrganisationName]
                  .filter((part) => part != null && part.trim().length > 0)
                  .join(' · ');
                return (
                  <li key={row.id}>
                    <Button
                      type="button"
                      variant={isActive ? 'default' : 'ghost'}
                      aria-pressed={isActive}
                      onClick={() => onSelect(row.id)}
                    >
                      <article className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 text-left">
                        <Avatar name={getApprovalApplicantAvatarName(row)} />
                        <section className="grid min-w-0 gap-1">
                          <span>{getPersonDisplayName(row)}</span>
                          <p className="grid grid-flow-col auto-cols-max items-center gap-1">
                            <Badge variant="outline-sec-normal">
                              {requestTypeLabel(row.requestType)}
                            </Badge>
                            {membershipLine.length > 0 ? <small>{membershipLine}</small> : null}
                          </p>
                        </section>
                        <small>{formatApprovalSubmittedRelative(row.createdAt)}</small>
                      </article>
                    </Button>
                  </li>
                );
              })
            : null}
        </ul>
      </CardContent>
    </Card>
  );
}
