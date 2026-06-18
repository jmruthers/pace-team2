import type { OrgEventSummaryRow } from '@/lib/events/events.types';

function startOfTodayLocal(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

export function isUpcomingOrgEvent(row: OrgEventSummaryRow): boolean {
  if (row.event_date == null || row.event_date.trim().length === 0) {
    return false;
  }
  const eventStart = new Date(row.event_date);
  if (Number.isNaN(eventStart.getTime())) {
    return false;
  }
  eventStart.setHours(0, 0, 0, 0);
  return eventStart.getTime() >= startOfTodayLocal();
}

export function partitionOrgEventsByTiming(events: OrgEventSummaryRow[]): {
  upcoming: OrgEventSummaryRow[];
  past: OrgEventSummaryRow[];
} {
  const upcoming: OrgEventSummaryRow[] = [];
  const past: OrgEventSummaryRow[] = [];
  for (const event of events) {
    if (isUpcomingOrgEvent(event)) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  }
  return { upcoming, past };
}
