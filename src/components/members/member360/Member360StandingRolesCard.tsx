import { Button, Card, CardContent, CardHeader, CardTitle } from '@solvera/pace-core/components';
import { ChevronRight } from '@solvera/pace-core/icons';

interface Member360StandingRolesCardProps {
  onViewRoles: () => void;
}

export function Member360StandingRolesCard({ onViewRoles }: Member360StandingRolesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standing roles</CardTitle>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" onClick={onViewRoles}>
          View roles ›
          <ChevronRight size={16} aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}
