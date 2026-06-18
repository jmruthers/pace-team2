export function formatApprovalSubmittedRelative(createdAt: string | null): string {
  if (createdAt == null || createdAt.trim().length === 0) {
    return '—';
  }
  const submitted = new Date(createdAt);
  if (Number.isNaN(submitted.getTime())) {
    return createdAt;
  }
  const now = Date.now();
  const diffMs = submitted.getTime() - now;
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day');
  }
  return submitted.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
