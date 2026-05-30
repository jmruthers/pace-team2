import { describe, expect, it } from 'vitest';

import {
  getApprovalApplicantAvatarName,
  getPersonDisplayName,
  hasDistinctApprovalPreferredName,
  mapFormResponseEntries,
  mapRequestRow,
  statusLabel,
} from './approvals.mappers';

describe('mapRequestRow (TM06)', () => {
  it('normalizes array joins to a single subject person', () => {
    const row = mapRequestRow({
      id: 'req-1',
      organisation_id: 'org-1',
      request_type: 'join',
      status: 'pending',
      subject_person: [
        {
          id: 'person-1',
          first_name: 'Alex',
          last_name: 'Member',
          preferred_name: 'Al',
          email: 'alex@example.test',
        },
      ],
      subject_member: { id: 'member-1', deleted_at: null },
    });

    expect(row.subjectFirstName).toBe('Alex');
    expect(row.subjectPreferredName).toBe('Al');
    expect(row.subjectMemberDeletedAt).toBeNull();
  });

  it('maps deleted member timestamp from join', () => {
    const row = mapRequestRow({
      id: 'req-2',
      organisation_id: 'org-1',
      request_type: 'transfer',
      status: 'approved',
      subject_member: { id: 'member-2', deleted_at: '2026-05-01T00:00:00Z' },
    });

    expect(row.subjectMemberDeletedAt).toBe('2026-05-01T00:00:00Z');
  });
});

describe('applicant display helpers (TM06)', () => {
  const baseRow = mapRequestRow({
    id: 'req-3',
    organisation_id: 'org-1',
    request_type: 'join',
    status: 'pending',
    subject_person: {
      first_name: 'Sam',
      last_name: 'Taylor',
      preferred_name: 'Sammy',
    },
  });

  it('getPersonDisplayName prefers preferred then first name', () => {
    expect(getPersonDisplayName(baseRow)).toBe('Sammy Taylor');
  });

  it('getApprovalApplicantAvatarName uses preferred over first', () => {
    expect(getApprovalApplicantAvatarName(baseRow)).toBe('Sammy Taylor');
  });

  it('hasDistinctApprovalPreferredName is true when preferred differs from first', () => {
    expect(hasDistinctApprovalPreferredName(baseRow)).toBe(true);
  });

  it('returns Unknown applicant when names are empty', () => {
    const empty = mapRequestRow({
      id: 'req-4',
      organisation_id: 'org-1',
      request_type: 'join',
      status: 'pending',
    });
    expect(getPersonDisplayName(empty)).toBe('Unknown applicant');
  });
});

describe('statusLabel', () => {
  it('formats on_hold for review panel copy', () => {
    expect(statusLabel('on_hold')).toBe('On hold');
  });
});

describe('mapFormResponseEntries (TM06)', () => {
  it('stringifies text before number and boolean', () => {
    const entries = mapFormResponseEntries({
      form: {
        fields: [
          { field_key: 'note', label: 'Note', sort_order: 1 },
          { field_key: 'count', label: 'Count', sort_order: 2 },
          { field_key: 'active', label: 'Active', sort_order: 3 },
        ],
      },
      values: [
        { field_key: 'note', value_text: '  hello  ' },
        { field_key: 'count', value_number: 42 },
        { field_key: 'active', value_boolean: true },
      ],
    });

    expect(entries.map((e) => e.value)).toEqual(['  hello  ', '42', 'Yes']);
    expect(entries.map((e) => e.label)).toEqual(['Note', 'Count', 'Active']);
  });

  it('sorts responses by sort_order then label', () => {
    const entries = mapFormResponseEntries({
      form: {
        fields: [
          { field_key: 'b', label: 'Bravo', sort_order: 2 },
          { field_key: 'a', label: 'Alpha', sort_order: 1 },
        ],
      },
      values: [
        { field_key: 'b', value_text: 'second' },
        { field_key: 'a', value_text: 'first' },
      ],
    });

    expect(entries.map((e) => e.fieldKey)).toEqual(['a', 'b']);
  });

  it('returns em dash when no value fields are set', () => {
    const entries = mapFormResponseEntries({
      form: { fields: [{ field_key: 'empty', label: 'Empty', sort_order: 1 }] },
      values: [{ field_key: 'empty' }],
    });

    expect(entries[0]?.value).toBe('—');
  });

  it('returns empty list when raw is null', () => {
    expect(mapFormResponseEntries(null)).toEqual([]);
  });
});
