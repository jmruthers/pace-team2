import { Breadcrumb } from '@solvera/pace-core/components';
import { organisationDisplayName } from '@/lib/shell/orgDisplay';

interface OrgContextBarProps {
  org: { id: string; display_name?: string | null; name?: string | null };
  pageLabel: string;
}

export function OrgContextBar({ org, pageLabel }: OrgContextBarProps) {
  const orgName = organisationDisplayName(org);

  return (
    <section className="mx-auto w-full max-w-(--app-width) px-4 pb-2">
      <Breadcrumb
        items={[
          { label: 'Organisations', href: '/' },
          { label: orgName, href: `/orgs/${org.id}` },
          { label: pageLabel },
        ]}
      />
    </section>
  );
}
