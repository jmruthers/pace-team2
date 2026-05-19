import { describe, expect, it } from 'vitest';
import {
  attendeeApplicationStatusBadgeVariant,
  attendeeApplicationStatusLabel,
  formatEventDateSpan,
  formatNullableVenue,
  getAttendeeDisplayName,
  mapEventSummaryRow,
} from '@/lib/events/events.display';

describe('events.display', () => {
  describe('mapEventSummaryRow', () => {
    it('assigns -Infinity event_date_sort_key when event_date is null', () => {
      const row = mapEventSummaryRow({
        event_id: 'x',
        event_name: 'TBD',
        event_date: null,
        event_days: null,
        event_venue: null,
        members_registered_count: 0,
      });
      expect(row.event_date_sort_key).toBe(Number.NEGATIVE_INFINITY);
    });

    it('orders null event_date last under descending event_date_sort_key sort', () => {
      const rows = [
        mapEventSummaryRow({
          event_id: 'a',
          event_name: 'A',
          event_date: '2026-05-01',
          event_days: 1,
          event_venue: null,
          members_registered_count: 1,
        }),
        mapEventSummaryRow({
          event_id: 'b',
          event_name: 'B',
          event_date: null,
          event_days: null,
          event_venue: null,
          members_registered_count: 1,
        }),
        mapEventSummaryRow({
          event_id: 'c',
          event_name: 'C',
          event_date: '2026-05-10',
          event_days: 1,
          event_venue: null,
          members_registered_count: 1,
        }),
      ];

      const sorted = [...rows].sort(
        (a, b) => b.event_date_sort_key - a.event_date_sort_key,
      );

      expect(sorted.map((row) => row.event_id)).toEqual(['c', 'a', 'b']);
    });
  });

  describe('formatEventDateSpan', () => {
    it('returns em dash when event_date is null', () => {
      expect(formatEventDateSpan(null, 3)).toBe('—');
    });

    it('returns a single short date when event_days is null or <= 1', () => {
      const single = formatEventDateSpan('2026-05-05', null);
      expect(single).toMatch(/5 May 2026/);
      expect(single).not.toContain('–');

      const oneDay = formatEventDateSpan('2026-05-05', 1);
      expect(oneDay).toMatch(/5 May 2026/);
      expect(oneDay).not.toContain('–');
    });

    it('returns an inclusive date range when event_days > 1', () => {
      const range = formatEventDateSpan('2026-05-05', 3);
      expect(range).toMatch(/5 May 2026/);
      expect(range).toMatch(/7 May 2026/);
      expect(range).toContain('–');
    });
  });

  describe('formatNullableVenue', () => {
    it('returns em dash for null or empty venue', () => {
      expect(formatNullableVenue(null)).toBe('—');
      expect(formatNullableVenue('   ')).toBe('—');
    });

    it('returns venue text when present', () => {
      expect(formatNullableVenue('Town Hall')).toBe('Town Hall');
    });
  });

  describe('getAttendeeDisplayName', () => {
    it('prefers preferred_name plus last_name when preferred_name is non-empty', () => {
      expect(
        getAttendeeDisplayName({
          preferred_name: 'Sam',
          first_name: 'Samantha',
          last_name: 'Doe',
        }),
      ).toBe('Sam Doe');
    });

    it('falls back to first_name plus last_name when preferred_name is empty', () => {
      expect(
        getAttendeeDisplayName({
          preferred_name: null,
          first_name: 'Samantha',
          last_name: 'Doe',
        }),
      ).toBe('Samantha Doe');

      expect(
        getAttendeeDisplayName({
          preferred_name: '  ',
          first_name: 'Samantha',
          last_name: 'Doe',
        }),
      ).toBe('Samantha Doe');
    });
  });

  describe('application status badge mapping', () => {
    it('maps statuses to expected labels and badge variants', () => {
      expect(attendeeApplicationStatusLabel('submitted')).toBe('Submitted');
      expect(attendeeApplicationStatusLabel('under_review')).toBe('Under review');
      expect(attendeeApplicationStatusLabel('approved')).toBe('Approved');
      expect(attendeeApplicationStatusLabel('rejected')).toBe('Rejected');
      expect(attendeeApplicationStatusLabel('withdrawn')).toBe('Withdrawn');

      expect(attendeeApplicationStatusBadgeVariant('approved')).toBe('soft-main-normal');
      expect(attendeeApplicationStatusBadgeVariant('rejected')).toBe('soft-acc-normal');
      expect(attendeeApplicationStatusBadgeVariant('withdrawn')).toBe('soft-sec-muted');
      expect(attendeeApplicationStatusBadgeVariant('submitted')).toBe('soft-sec-normal');
      expect(attendeeApplicationStatusBadgeVariant('under_review')).toBe('soft-sec-normal');
    });
  });
});
