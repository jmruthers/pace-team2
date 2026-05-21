import {
  applicationStatusBadgeVariant,
  applicationStatusLabel,
} from '@/lib/members/member360.display.badges';
import type { ApplicationStatus } from '@/lib/members/member360.types';
import type {
  OrgEventAttendeeRow,
  OrgEventHeader,
  OrgEventSummaryRow,
} from '@/lib/events/events.types';

const EM_DASH = '—';

const DATE_LOCALE = 'en-GB';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

function parseIsoDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (match == null) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function formatShortDateFromDate(date: Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, DATE_FORMAT).format(date);
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function coerceInteger(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function coerceString(value: unknown): string {
  return value == null ? '' : String(value);
}

function coerceNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function coerceApplicationStatus(value: unknown): OrgEventAttendeeRow['application_status'] {
  const status = coerceString(value);
  if (
    status === 'submitted'
    || status === 'under_review'
    || status === 'approved'
    || status === 'rejected'
    || status === 'withdrawn'
  ) {
    return status;
  }
  return 'submitted';
}

/** Sort key for event_date DESC with NULLS LAST (pace-core sortData puts nulls first on desc). */
function eventDateSortKey(eventDate: string | null): number {
  if (eventDate == null || eventDate.trim().length === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = parseIsoDateOnly(eventDate);
  return parsed == null ? Number.NEGATIVE_INFINITY : parsed.getTime();
}

export function formatEventDateSpan(eventDate: string | null, eventDays: number | null): string {
  if (eventDate == null || eventDate.trim().length === 0) {
    return EM_DASH;
  }

  const start = parseIsoDateOnly(eventDate);
  if (start == null) {
    return EM_DASH;
  }

  const days = eventDays ?? 1;
  if (days <= 1) {
    return formatShortDateFromDate(start);
  }

  const end = addCalendarDays(start, days - 1);
  return `${formatShortDateFromDate(start)} – ${formatShortDateFromDate(end)}`;
}

export function formatNullableVenue(venue: string | null): string {
  if (venue == null || venue.trim().length === 0) {
    return EM_DASH;
  }
  return venue;
}

export function getAttendeeDisplayName(
  row: Pick<OrgEventAttendeeRow, 'preferred_name' | 'first_name' | 'last_name'>,
): string {
  const preferred = row.preferred_name?.trim();
  if (preferred != null && preferred.length > 0) {
    return `${preferred} ${row.last_name}`.trim();
  }
  return `${row.first_name} ${row.last_name}`.trim();
}

export function attendeeApplicationStatusLabel(status: OrgEventAttendeeRow['application_status']): string {
  return applicationStatusLabel(status as ApplicationStatus);
}

export function attendeeApplicationStatusBadgeVariant(
  status: OrgEventAttendeeRow['application_status'],
) {
  return applicationStatusBadgeVariant(status as ApplicationStatus);
}

export function mapEventSummaryRow(raw: Record<string, unknown>): OrgEventSummaryRow {
  const event_date = coerceNullableString(raw.event_date);
  return {
    event_id: coerceString(raw.event_id),
    event_name: coerceString(raw.event_name),
    event_date,
    event_days: coerceInteger(raw.event_days),
    event_venue: coerceNullableString(raw.event_venue),
    members_registered_count: coerceInteger(raw.members_registered_count) ?? 0,
    event_date_sort_key: eventDateSortKey(event_date),
  };
}

export function mapEventAttendeeRow(raw: Record<string, unknown>): OrgEventAttendeeRow {
  return {
    member_id: coerceString(raw.member_id),
    person_id: coerceString(raw.person_id),
    first_name: coerceString(raw.first_name),
    last_name: coerceString(raw.last_name),
    preferred_name: coerceNullableString(raw.preferred_name),
    application_status: coerceApplicationStatus(raw.application_status),
    event_id: coerceString(raw.event_id),
    event_name: coerceString(raw.event_name),
    event_date: coerceNullableString(raw.event_date),
    event_days: coerceInteger(raw.event_days),
    event_venue: coerceNullableString(raw.event_venue),
  };
}

export function coerceEventSummaryList(data: unknown): OrgEventSummaryRow[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => mapEventSummaryRow(row));
}

export function coerceEventAttendeeList(data: unknown): OrgEventAttendeeRow[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => mapEventAttendeeRow(row));
}

export function headerFromAttendeeRows(rows: OrgEventAttendeeRow[]): OrgEventHeader | null {
  const first = rows[0];
  if (first == null) {
    return null;
  }
  return {
    event_id: first.event_id,
    event_name: first.event_name,
    event_date: first.event_date,
    event_days: first.event_days,
    event_venue: first.event_venue,
  };
}
