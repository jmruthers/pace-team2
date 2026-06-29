import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AttentionSection,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  HeroBadge,
  PageHeader,
} from '@solvera/pace-core/components';
import { usePaceMain, useUnifiedAuth } from '@solvera/pace-core/hooks';
import type { Organisation } from '@solvera/pace-core/types';
import { createOrganisationId } from '@solvera/pace-core/types';
import { useOrgLandingApprovalCounts } from '@/hooks/useOrgLandingApprovalCounts';
import { formatMembershipRole, orgInitials, organisationDisplayName } from '@/lib/shell/orgDisplay';

interface OrgLandingPageProps {
  onPickOrganisation: (org: Organisation) => void;
}

function resolveMembershipRole(
  orgId: string,
  memberships: ReturnType<typeof useUnifiedAuth>['userMemberships'],
): string {
  const membership = memberships.find((entry) => entry.organisation_id === orgId);
  return formatMembershipRole(membership?.role);
}

function OrgLandingPageContent({ onPickOrganisation }: OrgLandingPageProps) {
  usePaceMain({ printTitle: 'Organisations', ariaLabel: 'Choose an organisation' });

  const { organisations, userMemberships } = useUnifiedAuth();
  const orgList = organisations;
  const many = orgList.length > 1;
  const organisationIds = useMemo(() => orgList.map((org) => org.id), [orgList]);
  const pendingByOrg = useOrgLandingApprovalCounts(organisationIds);

  const attentionItems = useMemo(() => {
    return pendingByOrg.map((entry) => {
      const org = orgList.find((candidate) => candidate.id === entry.organisationId);
      if (org == null) {
        return null;
      }
      const label = organisationDisplayName(org);
      const requestLabel = entry.count === 1 ? 'request' : 'requests';
      return {
        id: `org-attention-${org.id}`,
        tone: 'warn' as const,
        title: label,
        kind: 'Approvals',
        sub: `${entry.count} pending join and transfer ${requestLabel}`,
        onClick: () => onPickOrganisation(org),
      };
    }).filter((item): item is NonNullable<typeof item> => item != null);
  }, [onPickOrganisation, orgList, pendingByOrg]);

  return (
    <main className="grid gap-6">
      <PageHeader
        title={many ? 'Choose an organisation' : 'Your organisation'}
        subtitle={
          many
            ? `You administer ${orgList.length} organisations. Pick one to manage its members, communications and reporting.`
            : 'Open your organisation to manage members, communications and reporting.'
        }
        breadcrumbItems={[
          { label: 'TEAM', href: '/' },
          { label: 'Organisations' },
        ]}
      />

      <section
        className={many ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3' : 'grid gap-4'}
        aria-label="Organisations"
      >
        {orgList.map((org) => {
          const name = organisationDisplayName(org);
          const pendingCount = pendingByOrg.find((entry) => entry.organisationId === org.id)?.count ?? 0;

          return (
            <Link
              key={org.id}
              to={`/orgs/${org.id}`}
              className="contents no-underline"
              onClick={() => onPickOrganisation(org)}
            >
              <Card fill>
                <CardHeader className="grid gap-3">
                  <HeroBadge code={orgInitials(name)} />
                  <CardTitle>{name}</CardTitle>
                  {org.description != null && org.description.length > 0 ? <p>{org.description}</p> : null}
                </CardHeader>
                <CardContent className="grid gap-2">
                  <p>{resolveMembershipRole(org.id, userMemberships)}</p>
                  {pendingCount > 0 ? (
                    <p>{pendingCount} pending approval{pendingCount === 1 ? '' : 's'}</p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      {attentionItems.length > 0 ? (
        <AttentionSection
          title="Member requests"
          items={attentionItems}
          emptyTitle="No pending requests"
          emptyDescription="No pending join or transfer requests right now."
        />
      ) : null}
    </main>
  );
}

export function OrgLandingPage(props: OrgLandingPageProps) {
  return <OrgLandingPageContent {...props} />;
}

export function pickOrganisation(
  org: Organisation,
  switchOrganisation: (orgId: ReturnType<typeof createOrganisationId>) => void,
  navigate: ReturnType<typeof useNavigate>,
): void {
  switchOrganisation(createOrganisationId(org.id));
  navigate(`/orgs/${org.id}`);
}
