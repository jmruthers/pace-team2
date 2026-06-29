import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AttentionSection,
  Button,
  Card,
  CardContent,
  CardGrid,
  CardGridItem,
  CardHeader,
  CardTitle,
  EmptyState,
  EntityHero,
  EventCard,
  HeroBadge,
  PageHeader,
} from '@solvera/pace-core/components';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import { filterUpcomingEventsForLanding } from '@solvera/pace-core/events';
import { createOrganisationId } from '@solvera/pace-core/types';
import { useApprovalsOpenCount } from '@/hooks/useApprovalsData';
import { useOrgEventsData } from '@/hooks/useOrgEventsData';
import type { OrgEventSummaryRow } from '@/lib/events/events.types';
import { formatMembershipRole, orgInitials, organisationDisplayName } from '@/lib/shell/orgDisplay';

const SETUP_LAUNCHERS = [
  {
    key: 'org',
    title: 'Organisation details',
    description: 'Name, billing, banking and tax settings.',
    href: '/settings/organisation',
  },
  {
    key: 'people',
    title: 'People & access',
    description: 'Staff, admins and delegated permissions.',
    href: '/settings/people',
  },
  {
    key: 'roles',
    title: 'Member roles',
    description: 'Appointments and leaders across all units.',
    href: '/member-roles',
  },
  {
    key: 'types',
    title: 'Membership types',
    description: 'Tiers, age ranges, fees and renewal.',
    href: '/settings/membership-types',
  },
  {
    key: 'units',
    title: 'Sub-organisations',
    description: 'Units and groups beneath this organisation.',
    href: '/settings/sub-orgs',
  },
  {
    key: 'forms',
    title: 'Forms',
    description: 'Author and publish org and event forms.',
    href: '/forms',
  },
] as const;

export function OrgOverviewPage() {
  return <OrgOverviewPageContent />;
}

function OrgOverviewPageContent() {
  const navigate = useNavigate();
  const { orgId } = useParams<{ orgId: string }>();
  const { organisations, switchOrganisation, getUserRole, userMemberships } = useUnifiedAuth();

  const org = useMemo(() => {
    if (orgId == null) {
      return null;
    }
    return organisations.find((candidate) => candidate.id === orgId) ?? null;
  }, [orgId, organisations]);

  useEffect(() => {
    if (orgId == null || org == null) {
      return;
    }
    switchOrganisation(createOrganisationId(orgId));
  }, [org, orgId, switchOrganisation]);

  const organisationId = org?.id ?? null;
  const orgName = org != null ? organisationDisplayName(org) : 'Organisation';
  usePaceMain({ printTitle: orgName, ariaLabel: `${orgName} overview` });

  const pendingApprovals = useApprovalsOpenCount(organisationId);
  const { events, isLoading: eventsLoading } = useOrgEventsData(organisationId);

  const upcomingEvents = useMemo(() => {
    return filterUpcomingEventsForLanding(events).slice(0, 6) as OrgEventSummaryRow[];
  }, [events]);

  const membershipRole = useMemo(() => {
    if (organisationId == null) {
      return formatMembershipRole(getUserRole());
    }
    const membership = userMemberships.find((entry) => entry.organisation_id === organisationId);
    return formatMembershipRole(membership?.role ?? getUserRole());
  }, [getUserRole, organisationId, userMemberships]);

  if (org == null) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <section className="grid gap-3 justify-items-center">
          <h1>Organisation not found</h1>
          <p>That organisation is not one you administer.</p>
          <Button type="button" variant="default" onClick={() => navigate('/')}>
            Back to organisations
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="grid gap-6">
      <PageHeader
          title={orgName}
          subtitle="Membership, communications and reporting for this organisation."
          breadcrumbItems={[
            { label: 'Organisations', href: '/' },
            { label: orgName },
          ]}
          actions={(
            <>
              <Button type="button" variant="outline" onClick={() => navigate('/settings/organisation')}>
                Edit organisation
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/')}>
                Switch organisation
              </Button>
            </>
          )}
        />

        <EntityHero
          media={<HeroBadge code={orgInitials(orgName)} />}
          title={orgName}
          meta={[
            { text: membershipRole },
            ...(org.description != null && org.description.length > 0 ? [{ text: org.description }] : []),
          ]}
          actions={(
            <>
              <Button type="button" variant="default" onClick={() => navigate('/members')}>
                View members
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/approvals')}>
                Review approvals
              </Button>
            </>
          )}
        />

        <article className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Organisation key metrics">
          <Card>
            <CardHeader>
              <CardTitle>Awaiting approval</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{pendingApprovals}</p>
              <p>{pendingApprovals > 0 ? 'Needs review' : 'All caught up'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming events</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{upcomingEvents.length}</p>
              <p>In the next 90 days</p>
            </CardContent>
          </Card>
        </article>

        <AttentionSection
          title="Member requests"
          items={
            pendingApprovals > 0
              ? [{
                  id: 'overview-approvals',
                  tone: 'warn',
                  title: `${pendingApprovals} pending request${pendingApprovals === 1 ? '' : 's'}`,
                  kind: 'Approvals',
                  sub: 'Review join and transfer requests for this organisation.',
                  onClick: () => navigate('/approvals'),
                }]
              : []
          }
          emptyTitle="No pending requests"
          emptyDescription="No pending join or transfer requests right now."
        />

        <CardGrid heading="Organisation setup" headingId="organisation-setup-heading" columns={{ md: 2, lg: 3 }}>
          {SETUP_LAUNCHERS.map((launcher) => (
            <CardGridItem key={launcher.key} href={launcher.href}>
              <Card fill>
                <CardHeader>
                  <CardTitle>{launcher.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{launcher.description}</p>
                </CardContent>
              </Card>
            </CardGridItem>
          ))}
        </CardGrid>

        <article className="grid gap-4">
          <header className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <h2>Events</h2>
            <p>{upcomingEvents.length} upcoming</p>
            <Link to="/events">Browse all</Link>
          </header>

          {eventsLoading ? (
            <p>Loading events…</p>
          ) : upcomingEvents.length > 0 ? (
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map((event) => (
                <EventCard
                  key={event.event_id}
                  link={`/events/${event.event_id}`}
                  event={{
                    event_name: event.event_name,
                    event_date: event.event_date,
                    event_venue: event.event_venue ?? null,
                    event_code: null,
                  }}
                  imageGlyph={orgInitials(event.event_name)}
                  imageTag={
                    event.event_days != null && event.event_days > 1
                      ? `${event.event_days}-day`
                      : undefined
                  }
                  footer={<span>{event.members_registered_count} registered</span>}
                />
              ))}
            </section>
          ) : (
            <EmptyState
              compact
              title="No upcoming events"
              description="No upcoming events scheduled for this organisation."
            />
          )}
        </article>
    </main>
  );
}
