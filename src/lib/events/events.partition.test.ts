import { describe, expect, it, vi } from 'vitest';
import { isUpcomingOrgEvent, partitionOrgEventsByTiming } from '@/lib/events/events.partition';
import type { OrgEventSummaryRow } from '@/lib/events/events.types';

function makeEvent(overrides: Partial<OrgEventSummaryRow> = {}): OrgEventSummaryRow {
  return {
    event_id: 'event-1',
    event_name: 'Camp',
    event_date: '2026-09-01',
    event_days: 1,
    event_venue: 'Hall',
    members_registered_count: 0,
    event_date_sort_key: Date.now(),
    ...overrides,
  };
}

describe('events.partition', () => {
  it('treats events starting today or later as upcoming', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 18, 12, 0, 0));

    expect(isUpcomingOrgEvent(makeEvent({ event_date: '2026-06-18' }))).toBe(true);
    expect(isUpcomingOrgEvent(makeEvent({ event_date: '2026-06-17' }))).toBe(false);

    vi.useRealTimers();
  });

  it('partitions events into upcoming and past buckets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 18, 12, 0, 0));

    const upcoming = makeEvent({ event_id: 'upcoming', event_date: '2026-07-01' });
    const past = makeEvent({ event_id: 'past', event_date: '2026-01-01' });
    const result = partitionOrgEventsByTiming([upcoming, past]);

    expect(result.upcoming.map((row) => row.event_id)).toEqual(['upcoming']);
    expect(result.past.map((row) => row.event_id)).toEqual(['past']);

    vi.useRealTimers();
  });
});
