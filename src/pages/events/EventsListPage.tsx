import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DataTableColumn } from '@solvera/pace-core/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DataTable,
  LoadingSpinner,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { AccessDenied, PagePermissionGuard } from '@solvera/pace-core/rbac';
import { useOrgEventsData } from '@/hooks/useOrgEventsData';
import {
  formatEventDateSpan,
  formatNullableVenue,
} from '@/lib/events/events.display';
import { partitionOrgEventsByTiming } from '@/lib/events/events.partition';
import type { OrgEventSummaryRow } from '@/lib/events/events.types';
import { EVENTS_DATA_TABLE_FEATURES } from '@/pages/events/eventsTableFeatures';

type EventsView = 'upcoming' | 'past';

function EventsListPageContent() {
  usePaceMain({ printTitle: 'Events', ariaLabel: 'Events' });

  const navigate = useNavigate();
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;
  const [activeView, setActiveView] = useState<EventsView>('upcoming');

  const {
    events,
    rawCount,
    isLoading,
    isFetching,
    loadErrorMessage,
    refetchEvents,
  } = useOrgEventsData(organisationId);

  const { upcoming, past } = useMemo(() => partitionOrgEventsByTiming(events), [events]);

  const columns = useMemo<DataTableColumn<OrgEventSummaryRow>[]>(
    () => [
      {
        id: 'event',
        accessorKey: 'event_name',
        header: 'Event',
        sortable: true,
        searchable: true,
        cell: ({ row }) => (
          <section className="grid gap-1">
            <strong>{row.event_name}</strong>
            <small>{formatNullableVenue(row.event_venue)}</small>
          </section>
        ),
      },
      {
        id: 'event_date_sort_key',
        accessorKey: 'event_date_sort_key',
        header: 'Event date sort',
        sortable: true,
        hidden: true,
      },
      {
        id: 'event_days',
        accessorKey: 'event_days',
        header: 'Days',
        sortable: true,
        cell: ({ row }) => (row.event_days == null ? '—' : String(row.event_days)),
      },
      {
        id: 'event_date',
        accessorKey: 'event_date',
        header: 'Dates',
        sortable: true,
        cell: ({ row }) => formatEventDateSpan(row.event_date, row.event_days),
      },
      {
        id: 'members_registered_count',
        accessorKey: 'members_registered_count',
        header: 'Registered',
        sortable: true,
        cell: ({ row }) => String(row.members_registered_count),
      },
    ],
    [],
  );

  const renderEventsTable = (rows: OrgEventSummaryRow[], view: EventsView) => (
    <DataTable<OrgEventSummaryRow>
      data={rows}
      columns={columns}
      rbac={{ pageName: PAGE_NAMES.events }}
      description={`${rows.length} ${view} events`}
      isLoading={isFetching && events.length > 0}
      loadingSpinnerLabel="Loading table"
      getRowId={(row) => row.event_id}
      initialPageSize={25}
      initialSorting={[{ id: 'event_date_sort_key', desc: view === 'upcoming' }]}
      emptyState={{
        title: view === 'upcoming' ? 'No upcoming events' : 'No past events',
        description:
          view === 'upcoming'
            ? 'Events with a start date from today appear here once members register.'
            : 'Past events appear here after their start date.',
      }}
      onRowActivate={(row) => navigate(`/events/${row.event_id}`)}
      features={EVENTS_DATA_TABLE_FEATURES}
    />
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
      <PageHeader
        title="Events"
        subtitle={`${rawCount} events with members from your organisation.`}
        actions={
          <Button type="button" onClick={() => navigate('/events/new')}>
            Create event
          </Button>
        }
      />

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as EventsView)}>
        <TabsList>
          <TabsTrigger value="upcoming" count={upcoming.length}>
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" count={past.length}>
            Past
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">{renderEventsTable(upcoming, 'upcoming')}</TabsContent>
        <TabsContent value="past">{renderEventsTable(past, 'past')}</TabsContent>
      </Tabs>
    </main>
  );
}

export function EventsListPage() {
  return (
    <PagePermissionGuard pageName={PAGE_NAMES.events} operation="read" fallback={<AccessDenied />}>
      <EventsListPageContent />
    </PagePermissionGuard>
  );
}
