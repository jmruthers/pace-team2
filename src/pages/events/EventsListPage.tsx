import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DataTableColumn } from '@solvera/pace-core/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DataTable,
  LoadingSpinner,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { useOrgEventsData } from '@/hooks/useOrgEventsData';
import {
  formatEventDateSpan,
  formatNullableVenue,
} from '@/lib/events/events.display';
import type { OrgEventSummaryRow } from '@/lib/events/events.types';
import { EVENTS_DATA_TABLE_FEATURES } from '@/pages/events/eventsTableFeatures';

function EventsListPageContent() {
  usePaceMain({ printTitle: 'Events', ariaLabel: 'Events' });

  const navigate = useNavigate();
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;

  const {
    events,
    rawCount,
    isLoading,
    isFetching,
    loadErrorMessage,
    refetchEvents,
  } = useOrgEventsData(organisationId);

  const columns = useMemo<DataTableColumn<OrgEventSummaryRow>[]>(
    () => [
      {
        id: 'event_name',
        accessorKey: 'event_name',
        header: 'Event name',
        sortable: true,
        searchable: true,
      },
      {
        id: 'event_date_sort_key',
        accessorKey: 'event_date_sort_key',
        header: 'Event date sort',
        sortable: true,
        hidden: true,
      },
      {
        id: 'event_date',
        accessorKey: 'event_date',
        header: 'Event date',
        sortable: true,
        cell: ({ row }) => formatEventDateSpan(row.event_date, row.event_days),
      },
      {
        id: 'event_venue',
        accessorKey: 'event_venue',
        header: 'Event venue',
        sortable: true,
        cell: ({ row }) => formatNullableVenue(row.event_venue),
      },
      {
        id: 'members_registered_count',
        accessorKey: 'members_registered_count',
        header: 'Members registered',
        sortable: true,
        cell: ({ row }) => String(row.members_registered_count),
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <main className="grid min-h-[40vh] place-items-center">
        <LoadingSpinner label="Loading events" />
      </main>
    );
  }

  if (loadErrorMessage != null && events.length === 0) {
    return (
      <main className="grid gap-3">
        <Alert variant="destructive">
          <AlertTitle>Could not load events</AlertTitle>
          <AlertDescription>{loadErrorMessage}</AlertDescription>
        </Alert>
        <nav aria-label="Retry events">
          <Button type="button" onClick={() => void refetchEvents()}>
            Retry
          </Button>
        </nav>
      </main>
    );
  }

  return (
    <main className="grid gap-4">
      <section className="grid gap-3">
        <h1>Events</h1>
      </section>

      <DataTable<OrgEventSummaryRow>
        data={events}
        columns={columns}
        rbac={{ pageName: 'events' }}
        description={`${rawCount} events`}
        isLoading={isFetching && events.length > 0}
        loadingSpinnerLabel="Loading table"
        getRowId={(row) => row.event_id}
        initialPageSize={25}
        initialSorting={[{ id: 'event_date_sort_key', desc: true }]}
        emptyState={{
          title: 'No registered-member events',
          description:
            'Events appear here once a member of your organisation has an application or registration.',
        }}
        onRowActivate={(row) => navigate(`/events/${row.event_id}`)}
        features={EVENTS_DATA_TABLE_FEATURES}
      />
    </main>
  );
}

export function EventsListPage() {
  return (
    <PagePermissionGuard pageName="events" operation="read" fallback={<AccessDenied />}>
      <EventsListPageContent />
    </PagePermissionGuard>
  );
}
