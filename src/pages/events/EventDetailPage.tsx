import { PAGE_NAMES } from '@/lib/rbac/pageNames';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataTableColumn } from '@solvera/pace-core/components';
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
  DataTable,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@solvera/pace-core/components';
import { usePaceMain } from '@solvera/pace-core/hooks';
import { ChevronLeft } from '@solvera/pace-core/icons';
import { useOrganisationsContext } from '@solvera/pace-core/providers';
import { useEventAttendeesData } from '@/hooks/useEventAttendeesData';
import {
  attendeeApplicationStatusBadgeVariant,
  attendeeApplicationStatusLabel,
  formatEventDateSpan,
  formatNullableVenue,
  getAttendeeDisplayName,
} from '@/lib/events/events.display';
import type { OrgEventAttendeeRow } from '@/lib/events/events.types';
import { EVENTS_DATA_TABLE_FEATURES } from '@/pages/events/eventsTableFeatures';

function EventNotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <main className="grid min-h-[50vh] place-items-center">
      <section className="grid gap-3 justify-items-center">
        <h1>Event not found</h1>
        <p>We couldn&apos;t find this event for your current organisation.</p>
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden />
          Back to events
        </Button>
      </section>
    </main>
  );
}

function EventOrgMismatchState({ onBack }: { onBack: () => void }) {
  return (
    <main className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>This event is not in your current organisation</AlertTitle>
        <AlertDescription>Switch back, or return to the events list.</AlertDescription>
      </Alert>
      <nav aria-label="Back to events list">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to events
        </Button>
      </nav>
    </main>
  );
}

function EventDetailErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>Could not load event</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <nav aria-label="Retry event">
        <Button type="button" onClick={onRetry}>
          Retry
        </Button>
      </nav>
    </main>
  );
}

function EventDetailPageContent() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { selectedOrganisation } = useOrganisationsContext();
  const organisationId = selectedOrganisation?.id ?? null;
  const [activeTab, setActiveTab] = useState('attendees');

  const {
    attendees,
    rawCount,
    header,
    isLoading,
    isFetching,
    isSuccess,
    showOrgMismatch,
    loadErrorMessage,
    refetchAttendees,
  } = useEventAttendeesData(organisationId, eventId);

  const printTitle = header?.event_name ?? 'Event';
  usePaceMain({ printTitle, ariaLabel: printTitle });

  const columns = useMemo<DataTableColumn<OrgEventAttendeeRow>[]>(
    () => [
      {
        id: 'last_name',
        accessorKey: 'last_name',
        header: 'Name',
        sortable: true,
        searchable: true,
        cell: ({ row }) => getAttendeeDisplayName(row),
      },
      {
        id: 'first_name',
        accessorKey: 'first_name',
        header: 'First name',
        sortable: true,
        searchable: true,
        hidden: true,
      },
      {
        id: 'preferred_name',
        accessorKey: 'preferred_name',
        header: 'Preferred name',
        sortable: true,
        searchable: true,
        hidden: true,
      },
      {
        id: 'application_status',
        accessorKey: 'application_status',
        header: 'Application status',
        sortable: true,
        cell: ({ row }) => (
          <Badge variant={attendeeApplicationStatusBadgeVariant(row.application_status)}>
            {attendeeApplicationStatusLabel(row.application_status)}
          </Badge>
        ),
      },
    ],
    [],
  );

  const onBackToEvents = () => navigate('/events');

  if (isLoading) {
    return (
      <main className="grid min-h-[40vh] place-items-center">
        <LoadingSpinner label="Loading event" />
      </main>
    );
  }

  if (loadErrorMessage != null && attendees.length === 0) {
    return (
      <EventDetailErrorState
        message={loadErrorMessage}
        onRetry={() => void refetchAttendees()}
      />
    );
  }

  if (isSuccess && attendees.length === 0) {
    if (showOrgMismatch) {
      return <EventOrgMismatchState onBack={onBackToEvents} />;
    }
    return <EventNotFoundState onBack={onBackToEvents} />;
  }

  if (header == null) {
    return <EventNotFoundState onBack={onBackToEvents} />;
  }

  return (
    <main className="grid gap-4">
      <PageHeader
        title={header.event_name}
        subtitle={formatEventDateSpan(header.event_date, header.event_days)}
        actions={
          <Button type="button" variant="outline" onClick={onBackToEvents}>
            <ChevronLeft size={16} aria-hidden />
            Back to events
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Registered</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{rawCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Venue</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{formatNullableVenue(header.event_venue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{header.event_days == null ? '—' : `${header.event_days} days`}</p>
          </CardContent>
        </Card>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="attendees">Attendees</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="comms">Comms log</TabsTrigger>
        </TabsList>
        <TabsContent value="attendees">
      <DataTable<OrgEventAttendeeRow>
        data={attendees}
        columns={columns}
        rbac={{ pageName: PAGE_NAMES.events }}
        description={`${rawCount} attendees`}
        isLoading={isFetching && attendees.length > 0}
        loadingSpinnerLabel="Loading table"
        getRowId={(row) => row.member_id}
        initialPageSize={25}
        initialSorting={[
          { id: 'last_name', desc: false },
          { id: 'first_name', desc: false },
        ]}
        emptyState={{
          title: 'No applicants from your organisation',
          description:
            'Members of your organisation have no applications recorded for this event.',
        }}
        onRowActivate={(row) => navigate(`/members/${row.member_id}`)}
        features={EVENTS_DATA_TABLE_FEATURES}
      />
        </TabsContent>
        <TabsContent value="details">
          <EmptyState title="Event details" description="Detailed event configuration will appear in a later slice." />
        </TabsContent>
        <TabsContent value="forms">
          <EmptyState title="Event forms" description="Form assignments for this event will appear in a later slice." />
        </TabsContent>
        <TabsContent value="activities">
          <EmptyState title="Activities" description="Activity bookings for this event will appear in a later slice." />
        </TabsContent>
        <TabsContent value="comms">
          <EmptyState title="Comms log" description="Communications sent for this event will appear in a later slice." />
        </TabsContent>
      </Tabs>
    </main>
  );
}

export function EventDetailPage() {
  return <EventDetailPageContent />;
}
