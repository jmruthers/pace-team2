import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  EmptyState,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { ApprovalQueueList } from '@/components/approvals/ApprovalQueueList';
import { ApprovalReviewPanel } from '@/components/approvals/ApprovalReviewPanel';
import { useApprovalsData } from '@/hooks/useApprovalsData';
import type { ApprovalRequestTypeFilter } from '@/lib/approvals/approvals.types';

type ApprovalsView = 'open' | 'closed';

function useMdLayout(): boolean {
  const [isMdLayout, setIsMdLayout] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const update = () => setIsMdLayout(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMdLayout;
}

function ApprovalsPageContent() {
  usePaceMain({ printTitle: 'Approvals', ariaLabel: 'Approvals queue' });
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedOrganisation } = useOrganisationsContext();
  const [activeView, setActiveView] = useState<ApprovalsView>('open');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(() => {
    const stateRequestId = (location.state as { requestId?: string } | null)?.requestId;
    return stateRequestId != null && stateRequestId.length > 0 ? stateRequestId : null;
  });
  const [requestTypeFilter, setRequestTypeFilter] = useState<ApprovalRequestTypeFilter>('all');
  const previousOrganisationId = useRef<string | null>(null);
  const isMdLayout = useMdLayout();
  const organisationId = selectedOrganisation?.id ?? null;
  const organisationName = selectedOrganisation?.display_name ?? selectedOrganisation?.name ?? 'Organisation';

  const {
    openRequests,
    closedRequests,
    openErrorMessage,
    closedErrorMessage,
    openLoading,
    closedLoading,
    refetchOpen,
    refetchClosed,
  } = useApprovalsData(organisationId, requestTypeFilter);

  useEffect(() => {
    const stateRequestId = (location.state as { requestId?: string } | null)?.requestId;
    if (stateRequestId != null && stateRequestId.length > 0) {
      navigate('/approvals', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (previousOrganisationId.current == null) {
      previousOrganisationId.current = organisationId;
      return;
    }
    if (previousOrganisationId.current === organisationId) {
      return;
    }
    previousOrganisationId.current = organisationId;
    setSelectedRequestId(null);
    if (organisationId == null) {
      return;
    }
    toast({
      title: `Switched organisations. Showing approvals for ${organisationName}.`,
      variant: 'default',
      duration: 5000,
    });
  }, [organisationId, organisationName]);

  const clearSelection = () => setSelectedRequestId(null);

  const advanceSelectionAfterResolve = () => {
    const nextOpen = openRequests.filter((row) => row.id !== selectedRequestId);
    setSelectedRequestId(nextOpen[0]?.id ?? null);
  };

  const handleSelectRequest = (requestId: string) => {
    setSelectedRequestId(requestId);
  };

  const handleTabChange = (value: string) => {
    setActiveView(value as ApprovalsView);
    setSelectedRequestId(null);
  };

  const renderQueueError = (view: ApprovalsView, errorMessage: string, retry: () => void) => {
    const errorTitle = view === 'open' ? 'Could not load requests' : 'Could not load closed requests';
    return (
      <section className="grid gap-3">
        <Alert variant="destructive">
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <nav aria-label={`${view} requests retry`}>
          <Button type="button" onClick={() => void retry()}>
            Retry
          </Button>
        </nav>
      </section>
    );
  };

  const openEmptyDescription =
    'New join and transfer requests appear here once submitted via your org signup form.';

  const renderQueueList = (view: ApprovalsView) => {
    const rows = view === 'open' ? openRequests : closedRequests;
    const loading = view === 'open' ? openLoading : closedLoading;
    const errorMessage = view === 'open' ? openErrorMessage : closedErrorMessage;
    const retry = view === 'open' ? refetchOpen : refetchClosed;

    if (errorMessage != null) {
      return renderQueueError(view, errorMessage, retry);
    }

    return (
      <ApprovalQueueList
        view={view}
        rows={rows}
        loading={loading}
        selectedRequestId={selectedRequestId}
        onSelect={handleSelectRequest}
        emptyState={
          view === 'open' ? (
            <EmptyState title="All caught up" description={openEmptyDescription} />
          ) : (
            <EmptyState
              title="No closed requests yet."
              description="Resolved requests appear here for audit."
            />
          )
        }
      />
    );
  };

  const showQueueOnly = !isMdLayout && selectedRequestId == null;
  const showDetailOnly = !isMdLayout && selectedRequestId != null;

  return (
    <main className="grid gap-4">
      <PageHeader
        title="Approvals"
        subtitle="Review join and transfer requests submitted to your branch."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              toast({ title: 'Approval rules are not configured yet.', variant: 'default' });
            }}
          >
            Approval rules
          </Button>
        }
      />

      <Label htmlFor="request-type-filter" className="grid gap-1 w-fit">
        Request type
        <Select
          value={requestTypeFilter}
          onValueChange={(value) => setRequestTypeFilter((value as ApprovalRequestTypeFilter) ?? 'all')}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="join">Join</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </Label>

      {(isMdLayout || showQueueOnly) && (
        <section className={isMdLayout ? 'grid gap-4 md:grid-cols-[420px_1fr]' : 'grid gap-4'}>
          <Tabs value={activeView} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="open" count={openRequests.length}>
                Open queue
              </TabsTrigger>
              <TabsTrigger value="closed" count={closedRequests.length}>
                Resolved
              </TabsTrigger>
            </TabsList>
            <TabsContent value="open">{renderQueueList('open')}</TabsContent>
            <TabsContent value="closed">{renderQueueList('closed')}</TabsContent>
          </Tabs>
          {isMdLayout && (
            <ApprovalReviewPanel
              requestId={selectedRequestId ?? undefined}
              organisationId={organisationId}
              onAfterResolve={advanceSelectionAfterResolve}
              onLeaveQueue={clearSelection}
            />
          )}
        </section>
      )}

      {showDetailOnly && (
        <ApprovalReviewPanel
          requestId={selectedRequestId ?? undefined}
          organisationId={organisationId}
          onAfterResolve={advanceSelectionAfterResolve}
          onLeaveQueue={clearSelection}
        />
      )}
    </main>
  );
}

export function ApprovalsPage() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.approvals} operation="read" fallback={<AccessDenied />}>
      <ApprovalsPageContent />
    </PagePermissionGuard>
  );
}
