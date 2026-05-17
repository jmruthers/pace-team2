import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DataTable,
  Label,
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
import type { DataTableColumn } from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { ApprovalReviewPanel } from './ApprovalReviewPanel';
import { useApprovalsData } from '@/hooks/useApprovalsData';
import { getPersonDisplayName, requestTypeLabel, statusLabel } from '@/lib/approvals/approvals.mappers';
import type { ApprovalRequestRow, ApprovalRequestTypeFilter } from '@/lib/approvals/approvals.types';

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
  const { requestId } = useParams();
  const { selectedOrganisation } = useOrganisationsContext();
  const [activeView, setActiveView] = useState<ApprovalsView>('open');
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
    if (previousOrganisationId.current == null) {
      previousOrganisationId.current = organisationId;
      return;
    }
    if (previousOrganisationId.current === organisationId) {
      return;
    }
    previousOrganisationId.current = organisationId;
    if (organisationId == null) {
      return;
    }
    toast({
      title: `Switched organisations. Showing approvals for ${organisationName}.`,
      variant: 'default',
      duration: 5000,
    });
  }, [organisationId, organisationName]);

  const openColumns = useMemo<DataTableColumn<ApprovalRequestRow>[]>(
    () => [
      {
        id: 'applicant',
        accessorKey: 'subjectLastName',
        header: 'Applicant',
        sortable: true,
        searchable: true,
        cell: ({ row }) => (
          <Button type="button" variant="link" onClick={() => navigate(`/approvals/${row.id}`)}>
            {getPersonDisplayName(row)}
          </Button>
        ),
      },
      {
        id: 'type',
        accessorKey: 'requestType',
        header: 'Request type',
        sortable: true,
        cell: ({ row }) => requestTypeLabel(row.requestType),
      },
      {
        id: 'submitted',
        accessorKey: 'createdAt',
        header: 'Submitted',
        sortable: true,
        cell: ({ row }) => row.createdAt ?? '—',
      },
      {
        id: 'sourceOrg',
        accessorKey: 'sourceOrganisationName',
        header: 'Source org',
        sortable: true,
        cell: ({ row }) => row.requestType === 'transfer' ? row.sourceOrganisationName ?? '—' : '—',
      },
      {
        id: 'membershipType',
        accessorKey: 'membershipTypeName',
        header: 'Membership type',
        sortable: true,
        cell: ({ row }) => row.membershipTypeName ?? '—',
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        sortable: true,
        cell: ({ row }) => statusLabel(row.status),
      },
    ],
    [navigate]
  );

  const closedColumns = useMemo<DataTableColumn<ApprovalRequestRow>[]>(
    () => [
      {
        id: 'applicant',
        accessorKey: 'subjectLastName',
        header: 'Applicant',
        sortable: true,
        searchable: true,
        cell: ({ row }) => (
          <Button type="button" variant="link" onClick={() => navigate(`/approvals/${row.id}`)}>
            {getPersonDisplayName(row)}
          </Button>
        ),
      },
      {
        id: 'type',
        accessorKey: 'requestType',
        header: 'Request type',
        sortable: true,
        cell: ({ row }) => requestTypeLabel(row.requestType),
      },
      {
        id: 'submitted',
        accessorKey: 'createdAt',
        header: 'Submitted',
        sortable: true,
        cell: ({ row }) => row.createdAt ?? '—',
      },
      {
        id: 'resolved',
        accessorKey: 'resolvedAt',
        header: 'Resolved',
        sortable: true,
        cell: ({ row }) => row.resolvedAt ?? '—',
      },
      {
        id: 'outcome',
        accessorKey: 'status',
        header: 'Outcome',
        sortable: true,
        cell: ({ row }) => statusLabel(row.status),
      },
      {
        id: 'resolvedBy',
        accessorKey: 'resolverLastName',
        header: 'Resolved by',
        sortable: true,
        cell: ({ row }) => `${row.resolverPreferredName ?? row.resolverFirstName ?? ''} ${row.resolverLastName ?? ''}`.trim() || '—',
      },
    ],
    [navigate]
  );

  const renderQueue = (view: ApprovalsView) => {
    const rows = view === 'open' ? openRequests : closedRequests;
    const loading = view === 'open' ? openLoading : closedLoading;
    const errorMessage = view === 'open' ? openErrorMessage : closedErrorMessage;
    const retry = view === 'open' ? refetchOpen : refetchClosed;

    if (errorMessage != null) {
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
    }

    const openEmptyDescription: ReactNode = (
      <section className="grid gap-2">
        <p>New join and transfer requests appear here once submitted via your org signup form.</p>
        <p>
          <Button type="button" variant="link" onClick={() => navigate('/forms')}>
            Configure org signup form
          </Button>
        </p>
      </section>
    );

    return (
      <DataTable<ApprovalRequestRow>
        data={rows}
        columns={view === 'open' ? openColumns : closedColumns}
        rbac={{ pageName: 'approvals' }}
        description={`${rows.length} ${view}`}
        isLoading={loading}
        getRowId={(row) => row.id}
        initialPageSize={25}
        initialSorting={[{ id: view === 'open' ? 'createdAt' : 'resolvedAt', desc: view === 'closed' }]}
        emptyState={view === 'open'
          ? {
              title: 'No requests waiting for review.',
              description: openEmptyDescription,
            }
          : {
              title: 'No closed requests yet.',
              description: 'Resolved requests appear here for audit.',
            }}
        onRowActivate={(row) => navigate(`/approvals/${row.id}`)}
        features={{
          import: false,
          export: false,
          hierarchical: false,
          grouping: false,
          creation: false,
          editing: false,
          deletion: false,
          deleteSelected: false,
          selection: false,
          filtering: true,
          search: true,
          sorting: true,
          pagination: true,
          columnVisibility: true,
          columnReordering: true,
        }}
      />
    );
  };

  const showQueueOnly = !isMdLayout && requestId == null;
  const showDetailOnly = !isMdLayout && requestId != null;

  return (
    <main className="grid gap-4">
      <section className="grid gap-3">
        <h1>Approvals</h1>
        <Label htmlFor="request-type-filter" className="grid gap-1">
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
      </section>

      {(isMdLayout || showQueueOnly) && (
        <section className={isMdLayout ? 'grid gap-4 md:grid-cols-[420px_1fr]' : 'grid gap-4'}>
          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as ApprovalsView)}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
            <TabsContent value="open">{renderQueue('open')}</TabsContent>
            <TabsContent value="closed">{renderQueue('closed')}</TabsContent>
          </Tabs>
          {isMdLayout && (
            <ApprovalReviewPanel
              requestId={requestId}
              organisationId={organisationId}
            />
          )}
        </section>
      )}

      {showDetailOnly && (
        <ApprovalReviewPanel
          requestId={requestId}
          organisationId={organisationId}
        />
      )}
    </main>
  );
}

export function ApprovalsPage() {
  return (
    <PagePermissionGuard pageName="approvals" operation="read" fallback={<AccessDenied />}>
      <ApprovalsPageContent />
    </PagePermissionGuard>
  );
}
