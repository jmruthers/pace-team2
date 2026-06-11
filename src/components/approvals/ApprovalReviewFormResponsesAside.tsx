import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  LoadingSpinner,
} from '@solvera/pace-core/components';
import type { ApprovalFormResponseEntry } from '@/lib/approvals/approvals.types';

interface ApprovalReviewFormResponsesAsideProps {
  formResponses: ApprovalFormResponseEntry[];
  formResponsesLoading: boolean;
  formResponseErrorMessage: string | null;
  onRetry: () => void;
  onConfigureForms: () => void;
}

export function ApprovalReviewFormResponsesAside({
  formResponses,
  formResponsesLoading,
  formResponseErrorMessage,
  onRetry,
  onConfigureForms,
}: ApprovalReviewFormResponsesAsideProps) {
  return (
    <aside className="grid gap-3 lg:border-l lg:border-border lg:pl-8" aria-label="Form responses">
      <h3>Form responses</h3>
      {formResponsesLoading ? <LoadingSpinner label="Loading form responses" /> : null}
      {formResponseErrorMessage != null ? (
        <>
          <Alert variant="destructive">
            <AlertTitle>Could not load form responses</AlertTitle>
            <AlertDescription>{formResponseErrorMessage}</AlertDescription>
          </Alert>
          <nav aria-label="Form responses retry">
            <Button type="button" onClick={onRetry}>
              Retry
            </Button>
          </nav>
        </>
      ) : null}
      {!formResponsesLoading && formResponseErrorMessage == null && formResponses.length === 0 ? (
        <section className="grid gap-2">
          <p>No form configured for this request type.</p>
          <p>Configure your org signup form at /forms.</p>
          <nav>
            <Button type="button" variant="link" onClick={onConfigureForms}>
              Configure org signup form
            </Button>
          </nav>
        </section>
      ) : null}
      {!formResponsesLoading &&
        formResponseErrorMessage == null &&
        formResponses.map((entry) => (
          <p key={entry.fieldKey}>
            {entry.label} → {entry.value}
          </p>
        ))}
    </aside>
  );
}
