export type OrgEventApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export interface OrgEventSummaryRow extends Record<string, unknown> {
  event_id: string;
  event_name: string;
  event_date: string | null;
  event_days: number | null;
  event_venue: string | null;
  members_registered_count: number;
  /** Descending sort key; null event_date maps to -Infinity (NULLS LAST). */
  event_date_sort_key: number;
}

export interface OrgEventAttendeeRow extends Record<string, unknown> {
  member_id: string;
  person_id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  application_status: OrgEventApplicationStatus;
  event_id: string;
  event_name: string;
  event_date: string | null;
  event_days: number | null;
  event_venue: string | null;
}

export interface OrgEventHeader {
  event_id: string;
  event_name: string;
  event_date: string | null;
  event_days: number | null;
  event_venue: string | null;
}
