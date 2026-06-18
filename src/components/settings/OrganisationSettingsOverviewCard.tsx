import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from '@solvera/pace-core/components';
import type { Organisation } from '@solvera/pace-core/types';

interface OrganisationSettingsOverviewCardProps {
  organisation: Organisation | null | undefined;
}

export function OrganisationSettingsOverviewCard({ organisation }: OrganisationSettingsOverviewCardProps) {
  const extended = organisation as (Organisation & { slug?: string | null; description?: string | null }) | null | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
        <CardDescription>Profile details for the selected organisation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <section className="grid gap-1">
          <Label htmlFor="org-display-name">Display name</Label>
          <p id="org-display-name">{organisation?.display_name ?? organisation?.name ?? '—'}</p>
        </section>
        <section className="grid gap-1">
          <Label htmlFor="org-slug">Slug</Label>
          <p id="org-slug">{extended?.slug ?? '—'}</p>
        </section>
        <section className="grid gap-1">
          <Label htmlFor="org-description">Description</Label>
          <p id="org-description">{extended?.description ?? '—'}</p>
        </section>
      </CardContent>
    </Card>
  );
}
