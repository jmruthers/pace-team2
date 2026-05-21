import { describe, expect, it } from 'vitest';
import {
  applicationStatusBadgeVariant,
  applicationStatusLabel,
  cardActiveBadgeVariant,
  contactTierBadgeVariant,
  contactTierLabel,
  filterApplications,
  filterCards,
  filterContacts,
  membershipStatusBadgeVariant,
} from './member360.display.badges';
import { formatPhoneRows, getDisplayName } from './member360.display.format';

describe('member360 display helpers', () => {
  it('composes display names with preferred name fallback', () => {
    expect(getDisplayName('Ava', 'Adams', 'Av')).toBe('Av Adams');
    expect(getDisplayName('Ava', 'Adams', null)).toBe('Ava Adams');
  });

  it('formats phone rows and tier/status labels', () => {
    expect(
      formatPhoneRows([
        { id: '1', personId: 'p', phoneNumber: '0400 000 000', phoneTypeName: 'Mobile' },
      ])
    ).toBe('Mobile: 0400 000 000');
    expect(contactTierLabel('full')).toBe('Full');
    expect(contactTierBadgeVariant('notify')).toBe('soft-sec-muted');
    expect(cardActiveBadgeVariant(true)).toBe('soft-main-normal');
    expect(membershipStatusBadgeVariant('Revoked')).toBe('soft-acc-normal');
  });

  it('maps application statuses and filters by query', () => {
    expect(applicationStatusLabel('under_review')).toBe('Under review');
    expect(applicationStatusBadgeVariant('approved')).toBe('soft-main-normal');

    const contacts = filterContacts(
      [
        {
          id: 'c1',
          personId: 'p1',
          contactPersonId: 'cp1',
          contactTypeName: 'Parent / Guardian',
          permissionType: 'full',
          firstName: 'Alex',
          lastName: 'River',
          preferredName: null,
          email: null,
          residentialAddressId: null,
          postalAddressId: null,
        },
      ],
      'alex'
    );
    expect(contacts).toHaveLength(1);

    const cards = filterCards([{ cardIdentifier: 'PACE-001' }], '001');
    expect(cards).toHaveLength(1);

    const applications = filterApplications(
      [{ id: 'a1', status: 'submitted', eventId: 'e1', eventName: 'Winter Gala', eventDate: null }],
      'winter'
    );
    expect(applications).toHaveLength(1);
  });
});
