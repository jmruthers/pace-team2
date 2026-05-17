import type { OrgWorkflowType } from '@/lib/forms/orgForms.types';

/** BR-P — TEAM list/search labels for org-scoped workflow types. */
export function workflowTypeTeamLabel(workflowType: string): string {
  const labels: Record<OrgWorkflowType, string> = {
    org_signup: 'Org signup',
    information_collection: 'Information collection',
    consent_capture: 'Consent capture',
    generic: 'Generic',
  };
  if (workflowType in labels) {
    return labels[workflowType as OrgWorkflowType];
  }
  return workflowType;
}

const STATUS_LABEL_TITLE = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
} as const;

type BadgeStatusWord = (typeof STATUS_LABEL_TITLE)[keyof typeof STATUS_LABEL_TITLE];

export function statusBadgeLabel(status: string): BadgeStatusWord {
  if (status === 'published') {
    return STATUS_LABEL_TITLE.published;
  }
  if (status === 'closed') {
    return STATUS_LABEL_TITLE.closed;
  }
  return STATUS_LABEL_TITLE.draft;
}

export function formatFormsUpdatedCell(iso: string, locale?: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return new Intl.DateTimeFormat(locale ?? undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return '—';
  }
}
