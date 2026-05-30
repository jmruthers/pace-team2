import { describe, expect, it } from 'vitest';

import { mapMemberRow, parseInteger, toLookupRows } from './member360.mappers';
import type { MemberFetchRaw } from './member360.supabase';

function baseMemberRaw(partial: Partial<MemberFetchRaw> = {}): MemberFetchRaw {
  return {
    id: 'member-1',
    person_id: 'person-1',
    organisation_id: 'org-1',
    membership_type_id: 10,
    membership_number: 'M-100',
    membership_status: 'Active',
    valid_from: '2026-01-01',
    valid_to: null,
    core_person: {
      first_name: 'Alex',
      last_name: 'Member',
      preferred_name: 'Al',
      email: 'alex@example.test',
      date_of_birth: '1990-05-15',
      gender_id: 1,
      pronoun_id: 2,
      user_id: 'user-1',
      residential_address_id: 'addr-r',
      postal_address_id: 'addr-p',
    },
    core_membership_type: { id: 10, name: 'Full' },
    core_gender_type: { id: 1, name: 'Female' },
    core_pronoun_type: { id: 2, name: 'She/her' },
    residential_address: { id: 'addr-r', full_address: '1 Main St' },
    postal_address: { id: 'addr-p', full_address: 'PO Box 1' },
    ...partial,
  };
}

describe('mapMemberRow (TM03/TM04)', () => {
  it('maps person, membership, and lookup display fields', () => {
    const profile = mapMemberRow(baseMemberRaw());

    expect(profile.id).toBe('member-1');
    expect(profile.firstName).toBe('Alex');
    expect(profile.preferredName).toBe('Al');
    expect(profile.membershipTypeName).toBe('Full');
    expect(profile.genderName).toBe('Female');
    expect(profile.residentialAddress).toBe('1 Main St');
    expect(profile.postalAddress).toBe('PO Box 1');
  });

  it('defaults membership status to Provisional when absent', () => {
    const profile = mapMemberRow(
      baseMemberRaw({ membership_status: undefined as unknown as MemberFetchRaw['membership_status'] }),
    );
    expect(profile.membershipStatus).toBe('Provisional');
  });

  it('handles missing joins with empty strings and nulls', () => {
    const profile = mapMemberRow(
      baseMemberRaw({
        core_person: null,
        core_membership_type: null,
        core_gender_type: null,
        core_pronoun_type: null,
        residential_address: null,
        postal_address: null,
      }),
    );

    expect(profile.firstName).toBe('');
    expect(profile.preferredName).toBeNull();
    expect(profile.membershipTypeName).toBeNull();
    expect(profile.residentialAddress).toBeNull();
  });
});

describe('toLookupRows', () => {
  it('filters rows without usable names', () => {
    expect(
      toLookupRows([
        { id: 1, name: '  Alpha  ' },
        { id: 2, name: '   ' },
        { id: 3, name: null },
      ]),
    ).toEqual([{ id: 1, name: '  Alpha  ' }]);
  });
});

describe('parseInteger', () => {
  it('returns null for blank or non-numeric input', () => {
    expect(parseInteger('')).toBeNull();
    expect(parseInteger('abc')).toBeNull();
  });

  it('parses integer strings', () => {
    expect(parseInteger('42')).toBe(42);
  });
});
