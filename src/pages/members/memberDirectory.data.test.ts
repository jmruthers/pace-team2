import { describe, expect, it } from 'vitest';
import { matchPendingRequests } from '@/lib/members/memberDirectory.display';
import { getPickerBannerState, readManualPickPayload } from '@/lib/members/memberDirectory.picker';
import {
  type MemberDirectoryRow,
} from '@/lib/members/memberDirectory.types';

describe('memberDirectory shared', () => {
  it('matches pending rows only for open join/transfer requests and uses latest request', () => {
    const members: MemberDirectoryRow[] = [
      {
        id: 'member-1',
        personId: 'person-1',
        membershipNumber: 'A001',
        membershipStatus: 'Provisional',
        membershipTypeId: 1,
        membershipTypeName: 'Adult',
        organisationId: 'org-1',
        firstName: 'Ava',
        lastName: 'Zeal',
        preferredName: null,
        email: 'ava@example.com',
      },
      {
        id: 'member-2',
        personId: 'person-2',
        membershipNumber: 'A002',
        membershipStatus: 'Provisional',
        membershipTypeId: 1,
        membershipTypeName: 'Adult',
        organisationId: 'org-1',
        firstName: 'Ben',
        lastName: 'York',
        preferredName: null,
        email: 'ben@example.com',
      },
      {
        id: 'member-3',
        personId: 'person-3',
        membershipNumber: 'A003',
        membershipStatus: 'Provisional',
        membershipTypeId: null,
        membershipTypeName: null,
        organisationId: 'org-1',
        firstName: 'Cara',
        lastName: 'Xen',
        preferredName: null,
        email: 'cara@example.com',
      },
    ];

    const requests = [
      {
        id: 'req-old',
        organisation_id: 'org-1',
        subject_member_id: 'member-1',
        subject_person_id: null,
        request_type: 'join' as const,
        status: 'pending' as const,
        created_at: '2026-05-01T08:00:00.000Z',
      },
      {
        id: 'req-latest',
        organisation_id: 'org-1',
        subject_member_id: 'member-1',
        subject_person_id: null,
        request_type: 'transfer' as const,
        status: 'on_hold' as const,
        created_at: '2026-05-07T08:00:00.000Z',
      },
      {
        id: 'req-by-person',
        organisation_id: 'org-1',
        subject_member_id: null,
        subject_person_id: 'person-2',
        request_type: 'join' as const,
        status: 'pending' as const,
        created_at: '2026-05-06T08:00:00.000Z',
      },
    ];

    const matched = matchPendingRequests(members, requests);

    expect(matched).toHaveLength(2);
    expect(matched.find((row) => row.id === 'member-1')?.requestType).toBe('transfer');
    expect(matched.find((row) => row.id === 'member-1')?.requestedAt).toBe('2026-05-07T08:00:00.000Z');
    expect(matched.find((row) => row.id === 'member-2')?.requestType).toBe('join');
    expect(matched.some((row) => row.id === 'member-3')).toBe(false);
  });

  it('hydrates picker selection only when org matches payload', () => {
    const payload = JSON.stringify({
      organisationId: 'org-1',
      memberIds: ['member-1', 'member-2'],
      updatedAt: 1715000000,
    });

    expect(readManualPickPayload(payload, 'org-1')).toEqual(['member-1', 'member-2']);
    expect(readManualPickPayload(payload, 'org-2')).toEqual([]);
    expect(readManualPickPayload(null, 'org-1')).toEqual([]);
    expect(readManualPickPayload('not-json', 'org-1')).toEqual([]);
  });

  it('maps picker boundary states for done button and banner copy', () => {
    expect(getPickerBannerState(0)).toMatchObject({
      variant: 'default',
      title: 'Selecting members for a comms send',
      doneEnabled: false,
      showEmptyHelper: true,
    });
    expect(getPickerBannerState(500)).toMatchObject({
      variant: 'default',
      doneEnabled: true,
    });
    expect(getPickerBannerState(501)).toMatchObject({
      title: 'Large audience',
      doneEnabled: true,
    });
    expect(getPickerBannerState(2000)).toMatchObject({
      title: 'Large audience',
      doneEnabled: true,
    });
    expect(getPickerBannerState(2001)).toMatchObject({
      variant: 'destructive',
      title: 'Selection too large',
      doneEnabled: false,
    });
  });
});
