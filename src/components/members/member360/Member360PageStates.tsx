import { Alert, AlertDescription, AlertTitle, Button, LoadingSpinner } from '@solvera/pace-core/components';
import { ChevronLeft } from '@solvera/pace-core/icons';
import { Member360NotFound } from '@/components/members/member360/Member360NotFound';

export function Member360LoadingState() {
  return (
    <main className="grid min-h-[60vh] place-items-center">
      <LoadingSpinner label="Loading member" />
    </main>
  );
}

export function Member360LoadErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>Could not load member</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <nav aria-label="Retry member">
        <Button type="button" onClick={onRetry}>
          Retry
        </Button>
      </nav>
    </main>
  );
}

export function Member360OrgMismatchState({ onBack }: { onBack: () => void }) {
  return (
    <main className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>This member is not in the current organisation</AlertTitle>
        <AlertDescription>Switch back, or return to the members directory.</AlertDescription>
      </Alert>
      <nav aria-label="Back to members">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to members
        </Button>
      </nav>
    </main>
  );
}

export function Member360BackNav({ onBack }: { onBack: () => void }) {
  return (
    <nav aria-label="Back to members">
      <Button type="button" variant="outline" onClick={onBack}>
        <ChevronLeft size={16} aria-hidden />
        Back to members
      </Button>
    </nav>
  );
}

export { Member360NotFound };
