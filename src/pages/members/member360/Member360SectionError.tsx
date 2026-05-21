import { Alert, AlertDescription, AlertTitle, Button } from '@solvera/pace-core/components';

export function Member360SectionError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <nav aria-label={`${title} retry`}>
        <Button type="button" onClick={onRetry}>
          Retry
        </Button>
      </nav>
    </section>
  );
}
